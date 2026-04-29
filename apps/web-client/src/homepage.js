"use strict";

// CONFIG
// Automatically switch between local and live server
const isLocalhost =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";
const SERVER_URL = isLocalhost
    ? "http://localhost:3000"
    : "https://varta-0w6d.onrender.com";

let accessToken = sessionStorage.getItem("accessToken");
let refreshToken = localStorage.getItem("refreshToken");

if (!accessToken && !refreshToken) {
    window.location.replace("/index.html");
}

let ws = null;
const rtcConfig = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" }
    ]
}
let iceCandidateQueue = [];
let selectedMessageId = null;
let pendingCallOffer = null;

let peerConnection = null;
let localStream = null;

let currentConversationId = null;
let currentReceiverId = null;
let currentUserId = null;
let currentCallPartnerId = null;
let oldestMessageTimestamp = null;
let isBulkLoading = false;

// DOM
const app = document.querySelector(".app");
const backBtn = document.querySelector("#backBtn");
const conversationList = document.querySelector("#conversationList");
const logoutBtn = document.querySelector("#logoutBtn");

const chatAvatar = document.querySelector("#chatAvatar");
const chatUsername = document.querySelector("#chatUsername");
const chatUserEmail = document.querySelector("#chatUserEmail");

const profileBtn = document.querySelector("#profileBtn");
const profileModal = document.querySelector("#profileModal");
const closeProfile = document.querySelector("#closeProfile");

const profileAvatar = document.querySelector("#profileAvatar");
const profileName = document.querySelector("#profileName");
const profileEmail = document.querySelector("#profileEmail");

const messagesDiv = document.querySelector("#messages");

const messageInput = document.querySelector("#messageInput");
const sendBtn = document.querySelector("#sendBtn");

const addContactBtn = document.querySelector("#addContactBtn");
const addContactModal = document.querySelector("#addContactModal");
const contactEmail = document.querySelector("#contactEmail");
const cancelAddContact = document.querySelector("#cancelAddContact");
const confirmAddContact = document.querySelector("#confirmAddContact");

const globalLoader = document.querySelector("#globalLoader");

const mainMenuBtn = document.querySelector("#mainMenuBtn");
const headerProfileBtn = document.querySelector("#headerProfileBtn");

const contactMenu = document.querySelector("#contactMenu");
const contactProfileModal = document.querySelector("#contactProfileModal");
const closeContactProfile = document.querySelector("#closeContactProfile");
const contactProfileAvatar = document.querySelector("#contactProfileAvatar");
const contactProfileName = document.querySelector("#contactProfileName");
const contactProfileEmail = document.querySelector("#contactProfileEmail");


const videoModal = document.querySelector("#videoModal");
const localVideo = document.querySelector("#localVideo");
const callStatus = document.querySelector("#callStatus");
const remoteVideo = document.querySelector("#remoteVideo");
const endCallBtn = document.querySelector("#endCallBtn");
const videoCallBtn = document.querySelector("#videoCall");
const muteBtn = document.querySelector("#muteBtn");
const cameraBtn = document.querySelector("#cameraBtn");

const incomingCallModal = document.querySelector("#incomingCallModal");
const incomingCallName = document.querySelector("#incomingCallName");
const acceptCallBtn = document.querySelector("#acceptCallBtn");
const rejectCallBtn = document.querySelector("#rejectCallBtn");

const messageMenu = document.querySelector("#messageMenu");
const editMsgBtn = document.querySelector("#editMsgBtn");
const deleteMsgBtn = document.querySelector("#deleteMsgBtn");
const editMessageModal = document.querySelector("#editMessageModal");
const editMessageInput = document.querySelector("#editMessageInput");
const cancelEditMsg = document.querySelector("#cancelEditMsg");
const confirmEditMsg = document.querySelector("#confirmEditMsg");

const callHistoryBtn = document.querySelector("#callHistoryBtn");
const callLogsModal = document.querySelector("#callLogsModal");
const callLogsList = document.querySelector("#callLogsList");
const closeCallLogs = document.querySelector("#closeCallLogs");

sendBtn.disabled = true;

function showLoader() {
    globalLoader.classList.remove("hidden");
}

function hideLoader() {
    globalLoader.classList.add("hidden");
}

function openChat() {
    if (window.innerWidth <= 900) {
        app.classList.add("chat-active");
        // Push a fake state to the browser history so the back button has something to pop
        history.pushState({ chatOpen: true }, "");
    }
}

backBtn.addEventListener("click", () => {
    history.back();
});

// Intercept browser back button
window.addEventListener("popstate", () => {
    if (app.classList.contains("chat-active")) {
        app.classList.remove("chat-active");
    }
});

let isFetchingOldMessages = false;
messagesDiv.addEventListener("scroll", async () => {
    if (
        messagesDiv.scrollTop === 0 &&
        oldestMessageTimestamp &&
        currentConversationId &&
        !isFetchingOldMessages
    ) {
        isFetchingOldMessages = true;
        isBulkLoading = true;

        const loaderEl = document.createElement("div");
        loaderEl.id = "historyLoader";
        loaderEl.innerHTML = `Loading older messages...`;
        loaderEl.style.textAlign = "center";
        loaderEl.style.padding = "10px";
        loaderEl.style.fontSize = "12px";
        loaderEl.style.color = "var(--text-muted)";
        const previousScrollHeight = messagesDiv.scrollHeight;

        messagesDiv.prepend(loaderEl);

        try {
            const moreMessages = await apiRequest(
                `/messages/${currentConversationId}?cursor=${oldestMessageTimestamp}`,
            );

            if (document.getElementById("historyLoader")) {
                loaderEl.remove();
            }

            if (moreMessages && moreMessages.length > 0) {
                oldestMessageTimestamp = moreMessages[0].created_at;
                const previousScrollHeight = messagesDiv.scrollHeight;

                const fragment = document.createDocumentFragment();

                moreMessages.reverse().forEach((msg) => {
                    const el = createMessageElement(msg);
                    fragment.appendChild(el);
                });
                messagesDiv.prepend(fragment);

                requestAnimationFrame(() => {
                    messagesDiv.scrollTop = messagesDiv.scrollHeight - previousScrollHeight;
                });
            }
        } catch (error) {
            console.error("Failed to fetch older messages:", error);
            if (document.getElementById("historyLoader")) {
                loaderEl.remove();
            }
        } finally {
            isFetchingOldMessages = false;
            isBulkLoading = false;
        }
    }
});

// TOKEN MANAGEMENT
async function refreshAccessToken() {
    if (!refreshToken) {
        window.location.replace("/index.html");
        return null;
    }

    try {
        const response = await fetch(`${SERVER_URL}/refresh`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refreshToken }),
        });

        if (!response.ok) throw new Error("Session expired");

        const data = await response.json();

        accessToken = data.accessToken;
        refreshToken = data.refreshToken;

        sessionStorage.setItem("accessToken", accessToken);
        localStorage.setItem("refreshToken", refreshToken);

        return accessToken;
    } catch (err) {
        sessionStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        window.location.replace("/index.html");
        return null;
    }
}

// API HELPER
async function apiRequest(endpoint, options = {}, retry = true) {
    let response = await fetch(`${SERVER_URL}${endpoint}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
            ...(options.headers || {}),
        },
    });

    if (response.status === 401 && retry) {
        const newToken = await refreshAccessToken();

        if (newToken) {
            response = await fetch(`${SERVER_URL}${endpoint}`, {
                ...options,
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${newToken}`,
                    ...(options.headers || {}),
                },
            });
        } else {
            return null;
        }
    }

    if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
    }

    const text = await response.text();
    return text ? JSON.parse(text) : {};
}

// USER PROFILE
async function loadUserProfile() {
    showLoader();

    const user = await apiRequest("/users/me");

    if (!user) {
        hideLoader();
        return;
    }

    currentUserId = user.id;

    const avatar = user.avatar_url || "/public/default-avatar.svg";

    const firstName = user.username.split(" ")[0];
    chatUsername.textContent = `Welcome, ${firstName}`;
    chatUserEmail.textContent = "Select a conversation to start messaging";
    chatAvatar.src = "/public/varta-logo.svg";

    profileAvatar.src = avatar;
    profileName.textContent = user.username;
    profileEmail.textContent = user.email;

    hideLoader();
}

// CONVERSATIONS
async function loadConversations() {
    conversationList.innerHTML = `<div style="padding: 24px; text-align: center; color: var(--text-muted); font-size: 14px;">
                                    Loading chats...
                                </div>`;
    const conversations = await apiRequest("/conversations");

    if (!Array.isArray(conversations)) {
        conversationList.innerHTML = "Failed to load chats";
        return;
    }

    conversationList.innerHTML = "";

    conversations.forEach((conv) => {
        const item = document.createElement("div");
        item.className = "conversation";

        item.dataset.user_id = conv.user_id;

        const avatar = conv.avatar_url || "/public/default-avatar.svg";
        const statusClass = conv.is_online ? "online" : "offline";
        item.innerHTML = `
        <div class="avatar-container">
            <img src="${avatar}" />
            <span class="status-dot ${statusClass}"></span>
        </div>
        <div class="conversation-info">
            <div class="conversation-name">${conv.username}</div>
            <div class="conversation-preview">${conv.last_message || ""}</div>
        </div>
        `;

        item.addEventListener("click", () => {
            openChat();
            openConversation(conv);
        });

        conversationList.appendChild(item);
    });
}

// OPEN CONVERSATION
async function openConversation(conv) {
    messageInput.disabled = false;
    messageInput.placeholder = "Type a message...";

    currentConversationId = conv.id;
    currentReceiverId = conv.user_id;

    chatUsername.textContent = conv.username;
    chatUserEmail.textContent = conv.email || "";
    chatAvatar.src = conv.avatar_url || "/public/default-avatar.svg";

    const headerStatus = document.querySelector("#chatHeaderStatusDot");
    if (headerStatus) {
        headerStatus.className = `status-dot ${conv.is_online ? "online" : "offline"}`;
    }

    messagesDiv.innerHTML = `<div style="text-align:center; padding: 20px; color: var(--text-muted); font-size: 14px;">
                                Loading messages...
                            </div>`;

    isBulkLoading = true;
    const messages = await apiRequest(`/messages/${conv.id}`);

    messagesDiv.innerHTML = "";

    if (!messages || messages.length === 0) {
        messagesDiv.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: var(--text-muted);">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 12px; opacity: 0.5;"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                <p>No messages yet.</p>
                <p style="font-size: 12px;">Send a message to start the conversation.</p>
            </div>
        `;
        oldestMessageTimestamp = null;
        isBulkLoading = false;
        return;
    }

    oldestMessageTimestamp = messages[0].created_at;
    const fragment = document.createDocumentFragment();

    messages.forEach((msg) => {
        const el = createMessageElement(msg);
        fragment.appendChild(el);
    });

    messagesDiv.appendChild(fragment);
    if (messagesDiv.lastElementChild) {
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }
    isBulkLoading = false;
}

// RENDER MESSAGE
function createMessageElement(msg) {
    const el = document.createElement("div");
    const isSender =
        msg.is_sender === true ||
        msg.sender_id === currentUserId ||
        msg.senderId === currentUserId;

    el.className = isSender ? "message sent" : "message received";
    el.dataset.messageId = msg.id || msg.messageId;

    if (!isBulkLoading) {
        el.classList.add("animate");
    }

    if (msg.deleted_at) {
        el.textContent = "This message was deleted.";
        el.style.fontStyle = "italic";
        el.style.opacity = "0.7";
    } else {
        el.textContent = msg.text_content || msg.content;
        if (msg.edited_at) {
            el.textContent += " (edited)";
        }
    }
    if (isSender) {
        el.addEventListener("contextmenu", (e) => {
            e.preventDefault();
            if (msg.deleted_at || el.textContent === "This message was deleted.") return;

            selectedMessageId = el.dataset.messageId;

            const menuWidth = 160;
            let xPos = e.clientX;
            if (xPos + menuWidth > window.innerWidth) {
                xPos = window.innerWidth - menuWidth - 10;
            }

            messageMenu.style.position = 'fixed';
            messageMenu.style.left = `${xPos}px`;
            messageMenu.style.top = `${e.clientY}px`;
            messageMenu.classList.remove("hidden");
        });
    }
    return el;
}

function renderMessage(msg, smoothScroll = true) {
    const el = createMessageElement(msg);
    messagesDiv.appendChild(el);

    if (smoothScroll) {
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }
    return el;
}

function createPeerConnection(targetUserId) {
    peerConnection = new RTCPeerConnection(rtcConfig);

    peerConnection.onconnectionstatechange = () => {
        if (peerConnection.connectionState === "connected") {
            callStatus.textContent = "Connected";
        }
    };

    peerConnection.onicecandidate = (event) => {
        if (event.candidate && ws.readyState === 1) {
            ws.send(JSON.stringify({
                type: "webrtc_ice_candidate",
                to: targetUserId,
                candidate: event.candidate
            }));
        }
    };

    peerConnection.ontrack = (event) => {
        remoteVideo.srcObject = event.streams[0];
    };

    if (localStream) {
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });
    }
}

function closeCall() {
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    iceCandidateQueue = [];
    callStatus.textContent = "Call ended";

    localVideo.srcObject = null;
    remoteVideo.srcObject = null;
    currentCallPartnerId = null;

    setTimeout(() => {
        videoModal.classList.add("hidden");
    }, 500);
}

callHistoryBtn?.addEventListener("click", async () => {
    callLogsList.innerHTML = `<div style="text-align:center; color:var(--text-muted);">Loading logs...</div>`;
    callLogsModal.classList.remove("hidden");

    try {
        const logs = await apiRequest("/calls");
        callLogsList.innerHTML = "";

        if (!logs || logs.length === 0) {
            callLogsList.innerHTML = `<div style="text-align:center; color:var(--text-muted);">No recent calls.</div>`;
            return;
        }

        logs.forEach(log => {
            const date = new Date(log.started_at).toLocaleString();
            const isMissed = log.call_status === 'missed';
            const statusColor = isMissed ? '#EF4444' : 'var(--secondary-green)';

            const div = document.createElement("div");
            div.style = "display: flex; justify-content: space-between; align-items: center; padding: 10px; background: var(--input-bg); border-radius: 8px;";

            div.innerHTML = `
                <div style="display: flex; align-items: center; gap: 10px;">
                    <img src="${log.avatar_url || '/public/default-avatar.svg'}" style="width: 36px; height: 36px; border-radius: 50%; object-fit: cover; background: var(--border-color);">
                    <div style="text-align: left;">
                        <div style="font-weight: 600; font-size: 14px;">${log.contact_name}</div>
                        <div style="font-size: 12px; color: var(--text-muted);">${date}</div>
                    </div>
                </div>
                <div style="font-size: 13px; text-align: right;">
                    <div style="color: ${statusColor}; font-weight: 600; text-transform: capitalize;">${log.call_status}</div>
                    ${log.duration_sec ? `<div style="color: var(--text-muted);">${log.duration_sec}s</div>` : ''}
                </div>
            `;
            callLogsList.appendChild(div);
        });
    } catch (error) {
        callLogsList.innerHTML = `<div style="text-align:center; color:#EF4444;">Failed to load call logs.</div>`;
    }
});

closeCallLogs?.addEventListener("click", () => {
    callLogsModal.classList.add("hidden");
});

// SEND MESSAGE
async function sendMessage() {
    const text = messageInput.value.trim();

    if (!text || !currentConversationId) return;

    if (!ws || ws.readyState !== 1) {
        console.warn("Socket not ready");
        return;
    }

    const payload = {
        type: "send_message",
        to: currentReceiverId,
        content: text,
    };

    renderMessage(
        {
            is_sender: true,
            content: text,
        },
        true,
    );

    ws.send(JSON.stringify(payload));

    messageInput.value = "";
    sendBtn.disabled = true;
}

sendBtn.addEventListener("click", sendMessage);

messageInput.addEventListener("input", () => {
    sendBtn.disabled = !messageInput.value.trim();
});

messageInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        e.preventDefault();
        sendMessage();
    }
});

editMsgBtn.addEventListener("click", () => {
    messageMenu.classList.add("hidden");
    const msgEl = document.querySelector(`[data-message-id="${selectedMessageId}"]`);

    let text = msgEl.textContent.replace(" (edited)", "");
    editMessageInput.value = text;
    editMessageModal.classList.remove("hidden");
});

cancelEditMsg.addEventListener("click", () => {
    editMessageModal.classList.add("hidden");
});

confirmEditMsg.addEventListener("click", () => {
    const newText = editMessageInput.value.trim();
    if (newText && ws && ws.readyState === 1) {
        ws.send(JSON.stringify({
            type: "edit_message",
            to: currentReceiverId,
            messageId: selectedMessageId,
            conversationId: currentConversationId,
            content: newText
        }));
    }
    editMessageModal.classList.add("hidden");
});

deleteMsgBtn.addEventListener("click", () => {
    messageMenu.classList.add("hidden");

    setTimeout(() => {
        if (confirm("Are you sure you want to delete this message?") && ws && ws.readyState === 1) {
            ws.send(JSON.stringify({
                type: "delete_message",
                to: currentReceiverId,
                messageId: selectedMessageId,
                conversationId: currentConversationId
            }));
        }
    }, 10);
});

// WEBSOCKET
let reconnectAttempts = 0;

function connectWebSocket() {
    const wsURL = SERVER_URL.replace(/^http/, "ws");

    ws = new WebSocket(`${wsURL}?token=${accessToken}`);

    ws.onopen = () => {
        console.log("WebSocket connected");
        reconnectAttempts = 0;
    };

    ws.onmessage = async (event) => {
        const data = JSON.parse(event.data);

        if (data.type === "new_message") {
            const isNotMe = data.senderId !== currentUserId;
            if (data.conversationId === currentConversationId && isNotMe) {
                renderMessage(data, true);
            }
        } else if (data.type === "message_edited") {
            if (data.conversationId === currentConversationId) {
                const msgElement = document.querySelector(`[data-message-id="${data.messageId}"]`);
                if (msgElement) {
                    msgElement.textContent = data.content + " (edited)";
                }
            }
        } else if (data.type === "message_deleted") {
            if (data.conversationId === currentConversationId) {
                const msgElement = document.querySelector(`[data-message-id="${data.messageId}"]`);
                if (msgElement) {
                    msgElement.textContent = "This message was deleted.";
                    msgElement.style.fontStyle = "italic";
                    msgElement.style.opacity = "0.7";
                }
            }
        } else if (data.type === "user_status") {
            const convItem = document.querySelector(
                `.conversation[data-user-id=${data.user_id}]`,
            );
            if (convItem) {
                const statusDot = convItem.querySelector(".status-dot");
                if (statusDot) {
                    statusDot.className = `status-dot ${data.is_online ? "online" : "offline"}`;
                }
            }

            if (currentConversationId === data.conversationId) {
                const headerStatus = document.querySelector("#chatHeaderStatusDot");
                if (headerStatus) {
                    headerStatus.className = `status-dot ${data.is_online ? "online" : "offline"}`;
                }
            }
        } else if (data.type === "webrtc_offer") {
            pendingCallOffer = data;

            currentCallPartnerId = data.senderId;

            const callerElement = document.querySelector(`.conversation[data-user-id="${data.senderId}"] .conversation-name`);
            const callerName = callerElement ? callerElement.textContent : "Someone";

            incomingCallName.textContent = `${callerName} is calling...`;
            incomingCallModal.classList.remove("hidden");
        } else if (data.type === "webrtc_answer") {
            if (peerConnection)
                await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
            while (iceCandidateQueue.length > 0) {
                await peerConnection.addIceCandidate(iceCandidateQueue.shift());
            }
        } else if (data.type === "webrtc_ice_candidate") {
            const candidate = new RTCIceCandidate(data.candidate);

            if (peerConnection && peerConnection.remoteDescription) {
                try {
                    await peerConnection.addIceCandidate(candidate);
                } catch (e) {
                    console.error("Error adding received ice candidate", e);
                }
            } else {
                iceCandidateQueue.push(candidate);
            }
        } else if (data.type === "webrtc_end_call") {
            incomingCallModal.classList.add("hidden");
            pendingCallOffer = null;
            closeCall();
        } else if (data.type === "error") {
            console.error("Server returned an error:", data.message);
        }
    };

    ws.onclose = async (event) => {
        console.log("WebSocket disconnected");
        if (event.code === 4001) {
            const newToken = await refreshAccessToken();
            if (newToken) {
                connectWebSocket();
                return;
            }
            return;
        }

        reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
        console.log(`Reconnecting in ${delay / 1000}s...`);
        setTimeout(connectWebSocket, delay);
    };
}

// ADD CONTACT
addContactBtn.addEventListener("click", () => {
    addContactModal.classList.remove("hidden");
});

cancelAddContact.addEventListener("click", () => {
    addContactModal.classList.add("hidden");
});

confirmAddContact.addEventListener("click", async () => {
    const email = contactEmail.value.trim();

    if (!email) return;

    const result = await apiRequest("/conversations", {
        method: "POST",
        body: JSON.stringify({ email }),
    });

    if (result) {
        contactEmail.value = "";
        addContactModal.classList.add("hidden");
        loadConversations();
    }
});

// PROFILE
mainMenuBtn.addEventListener("click", () => {
    profileModal.classList.remove("hidden");
});

closeProfile.addEventListener("click", () => {
    profileModal.classList.add("hidden");
});

function toggleContactMenu(e) {
    e.stopPropagation();
    if (!currentConversationId) return;
    contactMenu.classList.toggle("hidden");
}

profileBtn.addEventListener("click", toggleContactMenu);
headerProfileBtn.addEventListener("click", () => {
    if (!currentConversationId) return;

    contactProfileAvatar.src = chatAvatar.src;
    contactProfileName.textContent = chatUsername.textContent;
    contactProfileEmail.textContent = chatUserEmail.textContent;

    contactProfileModal.classList.remove("hidden");
});

document.addEventListener("click", (e) => {
    if (!contactMenu.contains(e.target) && !profileBtn.contains(e.target)) {
        contactMenu.classList.add("hidden");
    }
    if (!messageMenu.contains(e.target)) {
        messageMenu.classList.add("hidden");
    }
});

document.querySelector("#viewContactProfileBtn").addEventListener("click", () => {
    contactMenu.classList.add("hidden");

    contactProfileAvatar.src = chatAvatar.src;
    contactProfileName.textContent = chatUsername.textContent;
    contactProfileEmail.textContent = chatUserEmail.textContent;
    contactProfileModal.classList.remove("hidden");
});

closeContactProfile.addEventListener("click", () => {
    contactProfileModal.classList.add("hidden");
});

// TODO: clear chat, delete contact 

document.querySelector("#viewMediaBtn").addEventListener("click", () => {
    contactMenu.classList.add("hidden");
    alert("Media gallery coming soon!");
});

function setInitialState() {
    chatUsername.textContent = "Welcome to Varta";
    chatUserEmail.textContent = "Select a conversation to start messaging";
    chatAvatar.src = "/public/varta-logo.svg";

    messageInput.disabled = true;
    messageInput.placeholder = "Open a chat to type...";
    sendBtn.disabled = true;

    messagesDiv.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: var(--text-muted);">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 16px; opacity: 0.3;"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line></svg>
            <h2>Varta for Web</h2>
            <p style="font-size: 14px; margin-top: 8px;">Send and receive messages securely.</p>
        </div>
    `;
}

logoutBtn?.addEventListener("click", async () => {
    showLoader();
    try {
        await fetch(`${SERVER_URL}/logout`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${accessToken}`
            },
            body: JSON.stringify({ refreshToken })
        });
    } catch (e) {
        console.error("Logout API failed", e);
    }
    accessToken = null;
    refreshToken = null;
    sessionStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    window.location.replace("/index.html");
});

muteBtn.addEventListener("click", () => {
    if (!localStream) return;

    const track = localStream.getAudioTracks()[0];
    if (!track) return;

    track.enabled = !track.enabled;

    muteBtn.classList.toggle("active", !track.enabled);
});

cameraBtn.addEventListener("click", () => {
    if (!localStream) return;

    const track = localStream.getVideoTracks()[0];
    if (!track) return;

    track.enabled = !track.enabled;

    cameraBtn.classList.toggle("active", !track.enabled);
});

videoCallBtn.addEventListener("click", async () => {
    if (!currentReceiverId) {
        alert("Please select a conversation to start a call.");
        return;
    }

    videoModal.classList.remove("hidden");
    callStatus.textContent = "Calling...";

    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideo.srcObject = localStream;

        currentCallPartnerId = currentReceiverId;
        createPeerConnection(currentCallPartnerId);

        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);

        ws.send(JSON.stringify({
            type: "webrtc_offer",
            to: currentCallPartnerId,
            offer: offer
        }));
    } catch (err) {
        console.error("Failed to get local media:", err);
        closeCall();
    }
});

acceptCallBtn.addEventListener("click", async () => {
    incomingCallModal.classList.add("hidden");
    
    if (!pendingCallOffer) return;
    const data = pendingCallOffer;

    videoModal.classList.remove("hidden");
    callStatus.textContent = "Connecting...";

    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideo.srcObject = localStream;

        createPeerConnection(currentCallPartnerId);
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));

        if (typeof iceCandidateQueue !== 'undefined') {
            while (iceCandidateQueue.length > 0) {
                await peerConnection.addIceCandidate(iceCandidateQueue.shift());
            }
        }

        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);

        ws.send(JSON.stringify({
            type: "webrtc_answer",
            to: currentCallPartnerId,
            answer: answer
        }));
    } catch (err) {
        console.error("Failed to answer call: ", err);
        ws.send(JSON.stringify({
            type: "webrtc_end_call",
            to: data.senderId
        }));
        closeCall();
    }
    
    pendingCallOffer = null;
});

rejectCallBtn.addEventListener("click", () => {
    incomingCallModal.classList.add("hidden");
    
    if (pendingCallOffer && ws && ws.readyState === 1) {
        ws.send(JSON.stringify({
            type: "webrtc_end_call",
            to: pendingCallOffer.senderId
        }));
    }
    
    pendingCallOffer = null;
    currentCallPartnerId = null;
});

endCallBtn.addEventListener("click", () => {
    if (currentCallPartnerId && ws && ws.readyState === 1) {
        ws.send(JSON.stringify({
            type: "webrtc_end_call",
            to: currentCallPartnerId
        }));
    }
    closeCall();
});

// INIT
async function initApp() {
    setInitialState();
    await loadUserProfile();
    await loadConversations();
    connectWebSocket();
}

initApp();
