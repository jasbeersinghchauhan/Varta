"use strict";

//CONFIG
const SERVER_URL = "https://varta-0w6d.onrender.com";

let accessToken = sessionStorage.getItem("accessToken");
let refreshToken = localStorage.getItem("refreshToken");

// FIXED: Redirect path to root index.html
if (!accessToken) {
    window.location.href = "/index.html";
}

let ws = null;
let currentConversationId = null;
let currentReceiverId = null;

//DOM
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

function showLoader() {
    globalLoader.classList.remove("hidden");
}

function hideLoader() {
    globalLoader.classList.add("hidden");
}

// TOKEN MANAGEMENT (NEW)
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
        sessionStorage.setItem("accessToken", accessToken);
        refreshToken = data.refreshToken;
        localStorage.setItem("refreshToken", refreshToken);
        return accessToken;
    } catch (err) {
        sessionStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        window.location.href = "/index.html";
        return null;
    }
}

//API HELPER (UPDATED)
async function apiFetch(endpoint, options = {}, retry = true) {
    let response = await fetch(`${SERVER_URL}${endpoint}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
            ...(options.headers || {}),
        },
    });

    // If token expired, refresh it and try exactly once more
    if (response.status === 401 && retry) {
        const newToken = await refreshAccessToken();
        if (newToken) {
            options.headers.Authorization = `Bearer ${newToken}`;
            response = await fetch(`${SERVER_URL}${endpoint}`, options);
        } else {
            return null;
        }
    }

    if (!response.ok) {
        console.error("API error:", response.status);
        return null;
    }

    // Handle empty responses smoothly
    const text = await response.text();
    return text ? JSON.parse(text) : {};
}

//USER PROFILE
async function loadUserProfile() {
    showLoader();

    const user = await apiFetch("/users/me");

    if (!user) {
        hideLoader();
        return;
    }

    const avatar = user.avatar_url || "/public/default-avatar.png";

    chatUsername.textContent = user.username;
    chatUserEmail.textContent = user.email;
    chatAvatar.src = avatar;

    profileAvatar.src = avatar;
    profileName.textContent = user.username;
    profileEmail.textContent = user.email;

    hideLoader();
}

//CONTACTS
async function loadConversations() {
    const conversations = await apiFetch("/conversations");

    if (!conversations) return;

    conversationList.innerHTML = "";

    conversations.forEach((conv) => {
        const item = document.createElement("div");
        item.className = "conversation-item";

        const avatar = conv.avatar_url || "/public/default-avatar.png";

        item.innerHTML = `
      <img class="conversation-avatar" src="${avatar}" />
      <div class="conversation-info">
        <div class="conversation-name">${conv.username}</div>
        <div class="conversation-last">${conv.last_message || ""}</div>
      </div>
    `;

        item.addEventListener("click", () => openConversation(conv));

        conversationList.appendChild(item);
    });
}

//OPEN CONVERSATIONS
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

function renderMessage(msg) {
    const messageEl = document.createElement("div");

    const isSender = msg.is_sender;

    messageEl.className = isSender ? "message message-out" : "message message-in";

    messageEl.textContent = msg.text_content;

    messagesDiv.appendChild(messageEl);

    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

//SEND MESSAGE
function sendMessage() {
    const text = messageInput.value.trim();

    if (!text || !ws) return;

    const payload = {
        type: "send_message",
        to: currentReceiverId,
        content: text,
    };

    ws.send(JSON.stringify(payload));

    renderMessage({
        text_content: text,
        is_sender: true,
    });

    messageInput.value = "";
}

sendBtn.addEventListener("click", sendMessage);

messageInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") sendMessage();
});

//WEB SOCKET
function connectWebSocket() {
    ws = new WebSocket(`wss://varta-0w6d.onrender.com?token=${accessToken}`);

    ws.onopen = () => {
        console.log("WebSocket connected");
    };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.type === "new_message") {
            if (data.conversationId === currentConversationId) {
                renderMessage({
                    text_content: data.content,
                    is_sender: false,
                });
            }
        }
    };

    ws.onclose = async (event) => {
        console.log("WebSocket disconnected");

        if (event.code === 4001) {
            console.log("Token expired, attempting refresh...");
            const newToken = await refreshAccessToken();
            if (!newToken) return;
        }

        setTimeout(connectWebSocket, 3000);
    };
}

//ADD CONTACT
addContactBtn.addEventListener("click", () => {
    addContactModal.classList.remove("hidden");
});

cancelAddContact.addEventListener("click", () => {
    addContactModal.classList.add("hidden");
});

confirmAddContact.addEventListener("click", async () => {
    const email = contactEmail.value.trim();

    if (!email) return;

    // FIXED: Hits /conversations to create the contact link
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

profileBtn.addEventListener("click", () => {
    profileModal.classList.remove("hidden");
});

closeProfile.addEventListener("click", () => {
    profileModal.classList.add("hidden");
});

async function initApp() {
    await loadUserProfile();
    await loadConversations();
    connectWebSocket();
}

initApp();