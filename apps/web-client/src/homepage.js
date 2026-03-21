"use strict";

// CONFIG
const SERVER_URL = "https://varta-0w6d.onrender.com";

let accessToken = sessionStorage.getItem("accessToken");
let refreshToken = localStorage.getItem("refreshToken");

if (!accessToken) {
    window.location.href = "/index.html";
}

let ws = null;

let currentConversationId = null;
let currentReceiverId = null;
let currentUserId = null;

// DOM
const app = document.querySelector(".app");
const backBtn = document.querySelector("#backBtn");
const conversationList = document.querySelector("#conversationList");

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
    }
}

backBtn.addEventListener("click", () => {
    document.querySelector(".app").classList.remove("chat-active");
});
// TOKEN MANAGEMENT
async function refreshAccessToken() {
    if (!refreshToken) {
        window.location.href = "/index.html";
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
        window.location.href = "/index.html";
        return null;
    }
}

// API HELPER
async function apiFetch(endpoint, options = {}, retry = true) {
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
        console.error("API error:", response.status);
        return null;
    }

    const text = await response.text();
    return text ? JSON.parse(text) : {};
}

// USER PROFILE
async function loadUserProfile() {
    showLoader();

    const user = await apiFetch("/users/me");

    if (!user) {
        hideLoader();
        return;
    }

    currentUserId = user.id;

    const avatar = user.avatar_url || "/public/default-avatar.png";

    const firstName = user.username.split(' ')[0];
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
    const conversations = await apiFetch("/conversations");

    if (!Array.isArray(conversations)) return;

    conversationList.innerHTML = "";

    conversations.forEach((conv) => {
        const item = document.createElement("div");
        item.className = "conversation";

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
    messageInput.placeholder = "Type a message..."

    currentConversationId = conv.id;
    currentReceiverId = conv.user_id;

    chatUsername.textContent = conv.username;
    chatUserEmail.textContent = conv.email || "";
    chatAvatar.src = conv.avatar_url || "/public/default-avatar.svg";

    messagesDiv.innerHTML = `<div style="text-align:center; padding: 20px; color: var(--text-muted); font-size: 14px;">
                                Loading messages...
                            </div>`;

    const messages = await apiFetch(`/messages/${conv.id}`);

    messagesDiv.innerHTML = "";

    if (!messages || messages.length === 0) {
        messagesDiv.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: var(--text-muted);">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 12px; opacity: 0.5;"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                <p>No messages yet.</p>
                <p style="font-size: 12px;">Send a message to start the conversation.</p>
            </div>
        `;
        return;
    }

    messages.forEach(msg => renderMessage(msg, false));
    if (messagesDiv.lastElementChild) {
        messagesDiv.lastElementChild.scrollIntoView({ behavior: "auto" });
    }
}

// RENDER MESSAGE
function renderMessage(msg, smoothScroll = true) {
    const el = document.createElement("div");

    const isSender = msg.sender_id === currentUserId || msg.senderId === currentUserId || msg.is_sender === true;

    el.className = isSender ? "message sent" : "message received";
    el.textContent = msg.text_content || msg.content;

    messagesDiv.appendChild(el);

    if (smoothScroll && messagesDiv.lastElementChild) {
        messagesDiv.lastElementChild?.scrollIntoView({ behavior: "smooth" });
    }
}

// SEND MESSAGE
async function sendMessage() {
    const text = messageInput.value.trim();

    if (!text || !currentConversationId) return;

    if (!ws || ws.readyState !== 1) {
        alert("Connecting..");
        return;
    }

    const payload = {
        type: "send_message",
        to: currentReceiverId,
        content: text
    };

    renderMessage({
        is_sender: true,
        content: text
    }, true);

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
let reconnectattempts = 0;

function connectWebSocket() {
    const wsURL = SERVER_URL.replace(/^http/, "ws");

    ws = new WebSocket(`${wsURL}?token=${accessToken}`);

    ws.onopen = () => {
        console.log("WebSocket connected");
        reconnectattempts = 0;
    };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.type === "new_message") {
            if (data.conversationId === currentConversationId) {
                renderMessage(data, true);
            }
        } else if (data.type === "user_status") {
            loadConversations();
        } else if (data.type === "error") {
            console.error("Server returned an error:", data.message);
        }
    };

    ws.onclose = async (event) => {
        console.log("WebSocket disconnected");
        if (event.code === 4001) {
            const newToken = await refreshAccessToken();
            if (!newToken) return;
        }

        reconnectattempts++;
        const delay = Math.min(1000 * Math.pow(2, reconnectattempts), 30000);
        console.log(`Reconnecting in ${delay / 1000}s...`);
        setTimeout(connectWebSocket, 3000);
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

    const result = await apiFetch("/conversations", {
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
profileBtn.addEventListener("click", () => {
    profileModal.classList.remove("hidden");
});

closeProfile.addEventListener("click", () => {
    profileModal.classList.add("hidden");
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

// INIT
async function initApp() {
    setInitialState();
    await loadUserProfile();
    await loadConversations();
    connectWebSocket();
}

initApp();