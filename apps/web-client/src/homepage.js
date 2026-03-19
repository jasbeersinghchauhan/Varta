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

    chatUsername.textContent = user.username;
    chatUserEmail.textContent = user.email;
    chatAvatar.src = avatar;

    profileAvatar.src = avatar;
    profileName.textContent = user.username;
    profileEmail.textContent = user.email;

    hideLoader();
}

// CONVERSATIONS
async function loadConversations() {
    const conversations = await apiFetch("/conversations");

    if (!Array.isArray(conversations)) return;

    conversationList.innerHTML = "";

    conversations.forEach((conv) => {
        const item = document.createElement("div");
        item.className = "conversation";

        const avatar = conv.avatar_url || "/public/default-avatar.png";

        item.innerHTML = `
        <img src="${avatar}" />
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
    currentConversationId = conv.id;
    currentReceiverId = conv.user_id;

    chatUsername.textContent = conv.username;
    chatUserEmail.textContent = conv.email || "";
    chatAvatar.src = conv.avatar_url || "/public/default-avatar.png";

    messagesDiv.innerHTML = "";

    const messages = await apiFetch(`/messages/${conv.id}`);

    if (!messages) return;

    messages.forEach(renderMessage);
}

// RENDER MESSAGE
function renderMessage(msg) {
    const el = document.createElement("div");

    const isSender = msg.sender_id === currentUserId || msg.senderId === currentUserId || msg.is_sender === true;

    el.className = isSender ? "message sent" : "message received";
    el.textContent = msg.text_content || msg.content;

    messagesDiv.appendChild(el);
    messagesDiv.lastElementChild?.scrollIntoView({ behavior: "smooth" });
}

// SEND MESSAGE
async function sendMessage() {
    const text = messageInput.value.trim();

    if (!text || !currentConversationId || !ws || ws.readyState !== 1) return;

    const payload = {
        type: "send_message",
        to: currentReceiverId,
        content: text
    };

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
function connectWebSocket() {
    const wsURL = SERVER_URL.replace(/^http/, "ws");

    ws = new WebSocket(`${wsURL}?token=${accessToken}`);

    ws.onopen = () => {
        console.log("WebSocket connected");
    };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.type === "new_message") {
            if (data.conversationId === currentConversationId) {
                renderMessage(data);
            }
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

// INIT
async function initApp() {
    await loadUserProfile();
    await loadConversations();
    connectWebSocket();
}

initApp();