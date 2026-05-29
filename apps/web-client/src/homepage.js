import { UI } from './ui.js';
import { Actions } from './actions.js';
import { AppState } from './state.js';

window.actions = Actions;
window.AppState = AppState;

document.addEventListener("DOMContentLoaded", () => {

    // Navigation & Modals
    document.querySelector("#backBtn").addEventListener("click", () => {
        document.querySelector(".app").classList.remove("chat-active");
    });

    // User Profile & Logout
    document.querySelector("#mainMenuBtn").addEventListener("click", () => Actions.openModal('profile'));
    document.querySelector("#closeProfile").addEventListener("click", () => Actions.closeModals());
    document.querySelector("#logoutBtn").addEventListener("click", () => Actions.logout());

    // Contact Profile & Menu
    document.querySelector("#profileBtn").addEventListener("click", (e) => {
        e.stopPropagation();
        if (window.AppState.activeChat.partner) document.querySelector("#contactMenu").classList.toggle("hidden");
    });
    document.querySelector("#headerProfileBtn").addEventListener("click", () => {
        if (window.AppState.activeChat.partner) {
            document.querySelector("#contactMenu").classList.add("hidden");
            Actions.openModal("contactProfile");
        }
    });
    document.querySelector("#viewContactProfileBtn").addEventListener("click", () => {
        document.querySelector("#contactMenu").classList.add("hidden");
        Actions.openModal("contactProfile");
    });
    document.querySelector("#closeContactProfile").addEventListener("click", () => Actions.closeModals());
    document.querySelector("#viewMediaBtn").addEventListener("click", () => {
        document.querySelector("#contactMenu").classList.add("hidden");
        UI.showMessage("Media gallery coming soon!", "success");
    });


    document.querySelector("#callHistoryBtn").addEventListener("click", () => Actions.fetchCallLogs());
    document.querySelector("#closeCallLogs").addEventListener("click", () => Actions.closeModals());

    // Chat Input
    const msgInput = document.querySelector("#messageInput");
    msgInput.addEventListener("input", (e) => Actions.updateInput(e.target.value));
    msgInput.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); Actions.sendMessage(); } });
    document.querySelector("#sendBtn").addEventListener("click", () => Actions.sendMessage());

    // Edit & Delete Messages
    document.querySelector("#editMsgBtn").addEventListener("click", () => {
        document.querySelector("#messageMenu").classList.add("hidden");
        document.querySelector("#editMessageInput").value = window.AppState.activeChat.selectedMessageText;
        Actions.openModal('editMessage');
    });
    document.querySelector("#cancelEditMsg").addEventListener("click", () => Actions.closeModals());
    document.querySelector("#confirmEditMsg").addEventListener("click", () => {
        Actions.editMessage(document.querySelector("#editMessageInput").value);
    });

    document.querySelector("#deleteMsgBtn").addEventListener("click", () => {
        document.querySelector("#messageMenu").classList.add("hidden");
        Actions.deleteMessage();
    });

    // Contacts
    document.querySelector("#addContactBtn").addEventListener("click", () => Actions.openModal('addContact'));
    document.querySelector("#cancelAddContact").addEventListener("click", () => Actions.closeModals());
    document.querySelector("#confirmAddContact").addEventListener("click", async () => {
        const email = document.querySelector("#contactEmail").value.trim();
        if (!email) return;
        try {
            await window.actions.apiRequest("/conversations", { method: "POST", body: JSON.stringify({ email }) });
            Actions.closeModals();
            UI.showMessage("Contact added!", "success");
            Actions.fetchConversations();
        } catch (e) {
            UI.showMessage("Failed to add contact", "error");
        }
    });

    // Calls
    document.querySelector("#audioCall").addEventListener("click", () => Actions.startCall(true));
    document.querySelector("#videoCall").addEventListener("click", () => Actions.startCall(false));
    document.querySelector("#endCallBtn").addEventListener("click", () => Actions.endCall());
    document.querySelector("#acceptCallBtn").addEventListener("click", () => Actions.acceptCall());
    document.querySelector("#rejectCallBtn").addEventListener("click", () => {
        Actions.endCall();
    });
    document.querySelector("#muteBtn").addEventListener("click", () => Actions.toggleMute());
    document.querySelector("#cameraBtn").addEventListener("click", () => Actions.toggleVideo());

    // Hide Menus on click outside
    document.addEventListener("click", (e) => {
        const msgMenu = document.querySelector("#messageMenu");
        const contactMenu = document.querySelector("#contactMenu");
        if (!msgMenu.contains(e.target)) msgMenu.classList.add("hidden");
        if (!contactMenu.contains(e.target) && !e.target.closest("#profileBtn")) contactMenu.classList.add("hidden");
    });

    // Boot App
    Actions.init();
});