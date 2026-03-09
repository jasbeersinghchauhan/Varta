"use strict";

// CONFIG
const SERVER_URL = "https://varta-0w6d.onrender.com";

const accessToken = sessionStorage.getItem("accessToken");
const currentUserId = sessionStorage.getItem("userId");

if (!accessToken) {
    window.location.href = "/index.html";
}

// DOM
const conversationList = document.querySelector("#conversationList");
const messageDiv = document.querySelector("#messages");

const messageInput = document.querySelector("#messageInput");
const sendBtn = document.querySelector("#sendBtn");

const chatUserName = document.querySelector("#chatUsername");
const chatUserEmail = document.querySelector("#chatUserEmail");
const chatAvatar = document.querySelector("#chatAvatar");

//STATE
let socket = null;

let currentConversation = null;
let messageCursor = null;
let loadingMessages = false;

//API
async function api(path, method = "GET", body = null) {
    try {
        const res = await fetch(`${SERVER_URL}${path}`, {
            method,
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${accessToken}`
            },
            body: body ? JSON.stringify(body) : null
        });

        if (!res.ok) {
            throw new Error(await res.text());
        }

        return await res.json();
    } catch (err) {
        console.error("API error: ", err);
        return null;
    }
}

//RENDER MESSAGE
async function renderMessage(msg, prepend = false) {
    const div = document.createElement("div");
    const mine = msg.sender_id === currentUserId;

    div.className = mine ? "message me" : "message";
    div.dataset.id = msg.id;
    div.textContent = msg.text_content;

    if (prepend)
        messagesDiv.prepend(div);
    else
        messagesDiv.appendChild(div);

    scrollToBottom();
}

//LOAD MESSAGES
async function loadMessages() {
    if (loadingMessages) return;

    loadingMessages = true;

    let url = `/api/messages/${currentConversation}`;
    if (messageCursor) {
        url += `?cursor=${messageCursor}`;
    }

    const messages = await api(url);
    loadingMessages = false;

    if (!messages || messages.length === 0) return;

    messageCursor = messages[messages.length - 1].id;
    messages.reverse().forEach(msg => {
        renderMessage(msg, true);
    });

};

//OPEN CONVERSATION
async function openConversation(conv) {
    currentConversation = conv.id;

    messageCursor = null;

    chatUsername.textContent = conv.username;
    chatUserEmail.textContent = conv.email || "";
    chatAvatar.src = conv.avatar_url || "";

    messagesDiv.innerHTML = "";

    await loadMessages();
};

//LOAD CONVERSATION
async function loadConversations() {
    const conversations = await api("/api/conversations");

    if (!conversations) return;
    conversationList.innerHTML = "";
    conversations.forEach(conv => {
        const div = document.createElement("div");

        div.className = "conversation";

        div.innerHTML = `
        <strong>${conv.username}</strong>
        <small>${conv.last_message || ""}</small>
    `;

        div.onclick = () => openConversation(conv);
        conversationList.appendChild(div);

    });
};