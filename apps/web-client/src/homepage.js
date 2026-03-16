"use strict";

const SERVER_URL = "https://varta-0w6d.onrender.com";

let accessToken = sessionStorage.getItem("accessToken");
let refreshToken = localStorage.getItem("refreshToken");

if (!accessToken) {
    window.location.href = "../index.html";
}

const mainMenu = document.querySelector("#mainMenuBtn");
const addContact = document.querySelector("#addContactBtn");
const conversationList = document.querySelector("#conversationList");

const backButton = document.querySelector("#backBtn");
const chatAvatar = document.querySelector("#chatAvatar");
const chatUsername = document.querySelector("#chatUsername");
const chatUserEmail = document.querySelector("#catUserEmail");

const audioCall = document.querySelector("#audioCall");
const videoCall = document.querySelector("#videoCall");
const profileBtn = document.querySelector("#profileBtn");

const messagesDiv = document.querySelector("#messages");

const fileInput = document.querySelector("#fileInput");
const messageInput = document.querySelector("#messageInput");
const sendBtn = document.querySelector("#sendBtn");

const viewProfileOption = document.querySelector("#viewProfileOption");
const deleteContactOption = document.querySelector("#deleteContactOption");
const contactEmail = document.querySelector("#contactEmail");
const cancelAddContact = document.querySelector("#cancelAddContact");
const confirmAddContact = document.querySelector("#confirmAddContact");