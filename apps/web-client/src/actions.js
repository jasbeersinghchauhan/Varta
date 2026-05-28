import { AppState } from './state.js';
import { apiRequest, SERVER_URL, refreshAccessToken } from './api.js';
import { UI } from './ui.js';

let ws = null;
let peerConnection = null;
let localStream = null;
const rtcConfig = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };
let iceCandidateQueue = [];

export const Actions = {
    async init() {
        UI.renderActiveChat();
        AppState.user = await apiRequest("/users/me");
        if (AppState.user) {
            document.querySelector("#profileAvatar").src = AppState.user.avatar_url || "/public/default-avatar.svg";
            document.querySelector("#profileName").textContent = AppState.user.username;
            document.querySelector("#profileEmail").textContent = AppState.user.email;
            await this.fetchConversations();
            this.connectWebSocket();
        }
    },

    async logout() {
        try {
            await fetch(`${SERVER_URL}/logout`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${AppState.tokens.access}` },
                body: JSON.stringify({ refreshToken: AppState.tokens.refresh })
            });
        } catch (e) {
            console.error("Logout API failed", e);
        }
        sessionStorage.clear();
        localStorage.clear();
        window.location.replace("/index.html");
    },

    async fetchConversations(silent = false) {
        if (!silent) {
            AppState.conversations.status = 'loading';
            UI.renderConversations();
        }

        try {
            const data = await apiRequest("/conversations");
            AppState.conversations.data = Array.isArray(data) ? data : [];
            AppState.conversations.status = AppState.conversations.data.length ? 'success' : 'empty';
        } catch (e) {
            if (!silent) {
                AppState.conversations.status = 'loading';
                UI.renderConversations();
            }
        }
        UI.renderConversations();
    },

    async selectConversation(conv) {
        if (window.innerWidth <= 900) document.querySelector(".app").classList.add("chat-active");

        AppState.activeChat.partner = conv;
        AppState.activeChat.status = 'loading';
        AppState.activeChat.inputText = "";
        UI.renderConversations(); // Updates highlighted state in sidebar
        UI.renderActiveChat();

        const chatId = conv.id || conv.conversation_id;
        if (!chatId || chatId === "undefined") {
            AppState.activeChat.status = 'empty';
            AppState.activeChat.messages = [];
            UI.renderActiveChat();
            return;
        }

        try {
            const msgs = await apiRequest(`/messages/${chatId}`);
            AppState.activeChat.messages = msgs || [];
            AppState.activeChat.status = msgs?.length ? 'success' : 'empty';
            if (msgs?.length) AppState.activeChat.oldestCursor = msgs[0].created_at;
        } catch (e) {
            AppState.activeChat.status = 'error';
        }
        UI.renderActiveChat();
    },

    updateInput(text) {
        AppState.activeChat.inputText = text;
        UI.syncInputState();
    },

    sendMessage() {
        const text = AppState.activeChat.inputText.trim();
        if (!text || !AppState.activeChat.partner || !ws || ws.readyState !== 1) return;

        const tempMsg = { id: Date.now(), content: text, is_sender: true, pending: true };
        AppState.activeChat.messages.push(tempMsg);
        AppState.activeChat.status = 'success';
        AppState.activeChat.inputText = "";
        UI.renderActiveChat();

        const partnerId = AppState.activeChat.partner.user_id;
        const chatToUpdate = AppState.conversations.data.find(c => c.user_id === partnerId);

        if (chatToUpdate) {
            chatToUpdate.last_message = text;

            AppState.conversations.data = [
                chatToUpdate,
                ...AppState.conversations.data.filter(c => c.user_id !== partnerId)
            ];

            UI.renderConversations();
        }

        ws.send(JSON.stringify({ type: "send_message", to: AppState.activeChat.partner.user_id, content: text }));
        setTimeout(() => { tempMsg.pending = false; UI.renderActiveChat(); }, 500);
    },

    editMessage(newText) {
        const msgId = AppState.activeChat.selectedMessageId;
        if (!msgId || !newText || !ws) return;

        ws.send(JSON.stringify({
            type: "edit_message",
            to: AppState.activeChat.partner.user_id,
            messageId: msgId,
            conversationId: AppState.activeChat.partner.id || AppState.activeChat.partner.conversation_id,
            content: newText
        }));

        const msg = AppState.activeChat.messages.find(m => (m.id || m.messageId) == msgId);
        if (msg) {
            msg.content = newText;
            msg.text_content = newText;
            msg.edited_at = new Date().toISOString();
        }
        UI.renderActiveChat();
        this.closeModals();
    },

    deleteMessage() {
        const msgId = AppState.activeChat.selectedMessageId;
        if (!msgId || !ws) return;

        if (confirm("Are you sure you want to delete this message?")) {
            ws.send(JSON.stringify({
                type: "delete_message",
                to: AppState.activeChat.partner.user_id,
                messageId: msgId,
                conversationId: AppState.activeChat.partner.id || AppState.activeChat.partner.conversation_id
            }));

            const msg = AppState.activeChat.messages.find(m => (m.id || m.messageId) == msgId);
            if (msg) msg.deleted_at = new Date().toISOString();
            UI.renderActiveChat();
        }
    },

    openModal(modalName) {
        AppState.ui.activeModal = modalName;
        UI.renderModals();
    },

    closeModals() {
        AppState.ui.activeModal = null;
        UI.renderModals();
    },

    openMessageMenu(e, msgId, currentText) {
        AppState.activeChat.selectedMessageId = msgId;
        AppState.activeChat.selectedMessageText = currentText.replace(" (edited)", "");

        const menu = document.querySelector("#messageMenu");
        menu.style.position = 'fixed';
        menu.style.left = `${Math.min(e.clientX, window.innerWidth - 170)}px`;
        menu.style.top = `${Math.min(e.clientY, window.innerHeight - 100)}px`;
        menu.classList.remove("hidden");
    },

    async fetchCallLogs() {
        this.openModal('callLogs');

        document.querySelector("#callLogsList").innerHTML = `
            <div style="text-align:center; padding: 20px; color: var(--text-muted);">
                <span class="loader-spinner"></span><br><br>Loading logs...
            </div>`;

        try {
            const logs = await apiRequest("/calls");
            UI.renderCallLogs(logs);
        } catch (e) {
            document.querySelector("#callLogsList").innerHTML = `<div style="text-align:center; color: #EF4444;">Failed to load logs.</div>`;
        }
    },

    connectWebSocket() {
        const wsURL = SERVER_URL.replace(/^http/, "ws");
        ws = new WebSocket(`${wsURL}?token=${AppState.tokens.access}`);

        ws.onmessage = async (event) => {
            const data = JSON.parse(event.data);

            if (data.type === "new_message") {
                if (AppState.activeChat.partner?.user_id === data.senderId) {
                    AppState.activeChat.messages.push(data);
                    AppState.activeChat.status = 'success';
                    UI.renderActiveChat();
                }
                const chatToUpdate = AppState.conversations.data.find(c => c.user_id === data.senderId);
                if (chatToUpdate) {
                    chatToUpdate.last_message = data.content; // Update the snippet text

                    // Move this chat to the top of the array since it's the most recent
                    AppState.conversations.data = [
                        chatToUpdate,
                        ...AppState.conversations.data.filter(c => c.user_id !== data.senderId)
                    ];

                    UI.renderConversations();
                }
            } else if (data.type === "message_edited") {
                const msg = AppState.activeChat.messages.find(m => (m.id || m.messageId) === data.messageId);
                if (msg) {
                    msg.content = data.content;
                    msg.text_content = data.content;
                    msg.edited_at = new Date().toISOString();
                    UI.renderActiveChat();
                }
            } else if (data.type === "message_deleted") {
                const msg = AppState.activeChat.messages.find(m => (m.id || m.messageId) === data.messageId);
                if (msg) {
                    msg.deleted_at = new Date().toISOString();
                    UI.renderActiveChat();
                }
            } else if (data.type === "user_status") {
                this.fetchConversations(); // Re-render online statuses
            } else if (data.type === "webrtc_offer") {
                AppState.call.pendingOffer = data;
                AppState.call.isAudioCall = data.callType === "audio";
                document.querySelector("#incomingCallName").textContent = `${data.callerName || 'Someone'} is calling...`;
                this.openModal('incomingCall');
            } else if (data.type === "webrtc_answer") {
                if (peerConnection) await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
                while (iceCandidateQueue.length > 0) await peerConnection.addIceCandidate(iceCandidateQueue.shift());
            } else if (data.type === "webrtc_ice_candidate") {
                const candidate = new RTCIceCandidate(data.candidate);
                if (peerConnection?.remoteDescription) await peerConnection.addIceCandidate(candidate);
                else iceCandidateQueue.push(candidate);
            } else if (data.type === "webrtc_end_call") {
                this.endCall(false);
            }
        };

        ws.onclose = async (e) => {
            if (e.code === 4001) {
                const newToken = await refreshAccessToken();
                if (newToken) this.connectWebSocket();
            } else {
                setTimeout(() => this.connectWebSocket(), 3000);
            }
        };
    },

    async startCall(isAudioOnly = false) {
        if (!AppState.activeChat.partner) return UI.showMessage("Select a chat first", "error");

        AppState.call.isAudioCall = isAudioOnly;
        AppState.call.partnerId = AppState.activeChat.partner.user_id;

        document.querySelector("#videoWrapper").classList.toggle("hidden", isAudioOnly);
        document.querySelector("#audioWrapper").classList.toggle("hidden", !isAudioOnly);
        document.querySelector("#cameraBtn").style.display = isAudioOnly ? "none" : "";
        document.querySelector("#videoCallStatus").textContent = "Calling...";
        this.openModal('videoCall');

        try {
            localStream = await navigator.mediaDevices.getUserMedia({ video: !isAudioOnly, audio: true });
            document.querySelector("#localVideo").srcObject = localStream;

            this.setupPeerConnection(AppState.call.partnerId);
            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);

            ws.send(JSON.stringify({
                type: "webrtc_offer", to: AppState.call.partnerId, offer: offer,
                callType: isAudioOnly ? "audio" : "video",
                callerName: AppState.user.username, callerAvatar: AppState.user.avatar_url
            }));
        } catch (err) {
            UI.showMessage("Microphone/Camera access denied", "error");
            this.endCall(false);
        }
    },

    async acceptCall() {
        this.closeModals();
        const data = AppState.call.pendingOffer;
        if (!data) return;

        AppState.call.partnerId = data.senderId;
        document.querySelector("#videoWrapper").classList.toggle("hidden", AppState.call.isAudioCall);
        document.querySelector("#audioWrapper").classList.toggle("hidden", !AppState.call.isAudioCall);
        document.querySelector("#cameraBtn").style.display = AppState.call.isAudioCall ? "none" : "";
        this.openModal('videoCall');

        try {
            localStream = await navigator.mediaDevices.getUserMedia({ video: !AppState.call.isAudioCall, audio: true });
            document.querySelector("#localVideo").srcObject = localStream;

            this.setupPeerConnection(AppState.call.partnerId);
            await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));

            while (iceCandidateQueue.length > 0) await peerConnection.addIceCandidate(iceCandidateQueue.shift());

            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);

            ws.send(JSON.stringify({ type: "webrtc_answer", to: AppState.call.partnerId, answer: answer }));
        } catch (err) {
            this.endCall();
        }
        AppState.call.pendingOffer = null;
    },

    setupPeerConnection(targetId) {
        peerConnection = new RTCPeerConnection(rtcConfig);
        peerConnection.onicecandidate = (e) => {
            if (e.candidate) ws.send(JSON.stringify({ type: "webrtc_ice_candidate", to: targetId, candidate: e.candidate }));
        };
        peerConnection.ontrack = (e) => {
            document.querySelector("#remoteVideo").srcObject = e.streams[0];
        };
        if (localStream) localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
    },

    endCall(notifyRemote = true) {
        if (notifyRemote && AppState.call.partnerId && ws) {
            ws.send(JSON.stringify({ type: "webrtc_end_call", to: AppState.call.partnerId }));
        }
        if (peerConnection) { peerConnection.close(); peerConnection = null; }
        if (localStream) { localStream.getTracks().forEach(t => t.stop()); localStream = null; }

        iceCandidateQueue = [];
        AppState.call.partnerId = null;
        this.closeModals();
    }
};