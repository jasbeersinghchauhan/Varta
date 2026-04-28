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
const remoteVideo = document.querySelector("#remoteVideo");
const endCallBtn = document.querySelector("#endCallBtn");
const videoCallBtn = document.querySelector("#videoCall");
const muteBtn = document.querySelector("#muteBtn");
const cameraBtn = document.querySelector("#cameraBtn");

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

    if (!isBulkLoading) {
        el.classList.add("animate");
    }

    el.textContent = msg.text_content || msg.content;
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
        if (!remoteVideo.srcObject) {
            remoteVideo.srcObject = event.streams[0];
        }
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
    localVideo.srcObject = null;
    remoteVideo.srcObject = null;
    videoModal.classList.add("hidden");
}

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
            videoModal.classList.remove("hidden");
            currentCallPartnerId = data.senderId;

            try {
                localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                localVideo.srcObject = localStream;

                createPeerConnection(currentCallPartnerId);
                await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));

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
        } else if (data.type === "webrtc_answer") {
            if (peerConnection)
                await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
        } else if (data.type === "webrtc_ice_candidate") {
            if (peerConnection) {
                try {
                    await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
                } catch (e) {
                    console.error("Error adding received ice candidate", e);
                }
            }
        } else if (data.type === "webrtc_end_call") {
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

muteBtn.addEventListener("click", (e) => {
    if (localStream) {
        const audioTrack = localStream.getAudioTracks()[0];
        if (audioTrack) {
            audioTrack.enabled = !audioTrack.enabled;
            e.target.textContent = audioTrack.enabled ? "Mute" : "Unmute";
            e.target.style.background = audioTrack.enabled ? "rgba(255, 255, 255, 0.2)" : "#EF4444";
        }
    }
});

cameraBtn.addEventListener("click", (e) => {
    if (localStream) {
        const videoTrack = localStream.getVideoTracks()[0];
        if (videoTrack) {
            videoTrack.enabled = !videoTrack.enabled;
            e.target.textContent = videoTrack.enabled ? "Camera" : "Camera Off";
            e.target.style.background = videoTrack.enabled ? "rgba(255, 255, 255, 0.2)" : "#EF4444";
        }
    }
});

videoCallBtn.addEventListener("click", async () => {
    if (!currentReceiverId) {
        alert("Please select a conversation to start a call.");
        return;
    }

    videoModal.classList.remove("hidden");

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
