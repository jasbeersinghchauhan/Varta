import { AppState } from './state.js';

export const UI = {
    showMessage(text, type = "success") {
        const msgElement = document.querySelector("#globalMessage");
        if (!msgElement) return;
        msgElement.textContent = text;
        msgElement.className = `global-message ${type}`;
        requestAnimationFrame(() => msgElement.classList.add("show"));
        setTimeout(() => {
            msgElement.classList.remove("show");
            setTimeout(() => msgElement.classList.add("hidden"), 300);
        }, 3000);
    },

    syncInputState() {
        const { partner, inputText } = AppState.activeChat;
        const msgInput = document.querySelector("#messageInput");
        const sendBtn = document.querySelector("#sendBtn");

        if (msgInput) msgInput.value = inputText;
        if (sendBtn) sendBtn.disabled = !inputText.trim() || !partner;
    },

    renderModals() {
        const modals = {
            addContact: document.querySelector("#addContactModal"),
            profile: document.querySelector("#profileModal"),
            contactProfile: document.querySelector("#contactProfileModal"),
            editMessage: document.querySelector("#editMessageModal"),
            callLogs: document.querySelector("#callLogsModal"),
            incomingCall: document.querySelector("#incomingCallModal"),
            videoCall: document.querySelector("#videoModal")
        };

        // Hide all
        Object.values(modals).forEach(m => m?.classList.add("hidden"));

        // Show active
        if (AppState.ui.activeModal && modals[AppState.ui.activeModal]) {
            modals[AppState.ui.activeModal].classList.remove("hidden");

            // Auto-populate Contact Profile Modal
            if (AppState.ui.activeModal === 'contactProfile' && AppState.activeChat.partner) {
                document.querySelector("#contactProfileAvatar").src = AppState.activeChat.partner.avatar_url || "/public/default-avatar.svg";
                document.querySelector("#contactProfileName").textContent = AppState.activeChat.partner.username;
                document.querySelector("#contactProfileEmail").textContent = AppState.activeChat.partner.email;
            }
        }
    },

    renderConversations() {
        const container = document.querySelector("#conversationList");
        const { status, data, error } = AppState.conversations;

        if (status === 'loading') {
            container.innerHTML = `<div style="padding: 24px; text-align: center; color: var(--text-muted);"><span class="loader-spinner"></span><br>Loading chats...</div>`;
            return;
        }
        if (status === 'error') {
            container.innerHTML = `<div style="padding: 24px; text-align: center; color: #EF4444;">${error}</div>`;
            return;
        }
        if (status === 'empty' || data.length === 0) {
            container.innerHTML = `<div style="padding: 24px; text-align: center; color: var(--text-muted);">No chats. <br><button onclick="actions.openModal('addContact')" style="color:var(--primary-blue); background:none; border:none; cursor:pointer; font-weight:600; margin-top:8px;">Add Contact</button></div>`;
            return;
        }

        container.innerHTML = "";
        data.forEach((conv) => {
            const item = document.createElement("div");
            item.className = "conversation";
            if (AppState.activeChat.partner?.user_id === conv.user_id) item.style.background = "var(--input-bg)";

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
            item.addEventListener("click", () => window.actions.selectConversation(conv));
            container.appendChild(item);
        });
    },

    renderActiveChat() {
        const { status, partner, messages, inputText } = AppState.activeChat;
        const msgDiv = document.querySelector("#messages");

        // Header Sync
        if (partner) {
            document.querySelector("#chatUsername").textContent = partner.username;
            document.querySelector("#chatUserEmail").textContent = partner.email;
            document.querySelector("#chatAvatar").src = partner.avatar_url || "/public/default-avatar.svg";
            document.querySelector("#chatHeaderStatusDot").className = `status-dot ${partner.is_online ? 'online' : 'offline'}`;
            document.querySelector("#messageInput").disabled = false;
        } else {
            document.querySelector("#chatUsername").textContent = "Welcome to Varta";
            document.querySelector("#chatUserEmail").textContent = "Select a conversation to start messaging";
            document.querySelector("#chatAvatar").src = "/public/varta-logo.svg";
            document.querySelector("#messageInput").disabled = true;
        }

        // Messages Sync
        if (status === 'idle') {
            msgDiv.innerHTML = `<div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: var(--text-muted);"><svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" style="margin-bottom: 16px; opacity: 0.3;"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line></svg><h2>Varta for Web</h2></div>`;
        } else if (status === 'loading') {
            msgDiv.innerHTML = `<div style="text-align:center; padding: 20px; color: var(--text-muted);"><span class="loader-spinner"></span></div>`;
        } else if (status === 'empty') {
            msgDiv.innerHTML = `<div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: var(--text-muted);"><p>No messages yet.</p></div>`;
        } else if (status === 'success') {
            msgDiv.innerHTML = "";
            messages.forEach(msg => {
                const el = document.createElement("div");
                const isSender = msg.sender_id === AppState.user.id || msg.is_sender;
                el.className = isSender ? "message sent animate" : "message received animate";

                if (msg.deleted_at) {
                    el.textContent = "This message was deleted.";
                    el.style.fontStyle = "italic"; el.style.opacity = "0.7";
                } else {
                    el.textContent = msg.text_content || msg.content;

                    if (msg.edited_at) {
                        const editSpan = document.createElement("span");
                        editSpan.textContent = " (edited)";
                        editSpan.style.fontSize = "11px";
                        editSpan.style.opacity = "0.7";
                        editSpan.style.marginLeft = "6px";
                        editSpan.style.fontStyle = "italic";
                        el.appendChild(editSpan);
                    }

                    if (msg.pending) el.style.opacity = "0.7";
                }

                if (isSender && !msg.deleted_at) {
                    el.addEventListener("contextmenu", (e) => {
                        e.preventDefault();
                        window.actions.openMessageMenu(e, msg.id || msg.messageId, el.textContent);
                    });
                }
                msgDiv.appendChild(el);
            });
            msgDiv.scrollTop = msgDiv.scrollHeight;
        }

        // Input Sync
        document.querySelector("#messageInput").value = inputText;
        document.querySelector("#sendBtn").disabled = !inputText.trim() || !partner;
    },

    renderCallLogs(logs) {
        const list = document.querySelector("#callLogsList");
        list.innerHTML = "";
        if (!logs || logs.length === 0) {
            list.innerHTML = `<div style="text-align:center; color:var(--text-muted);">No recent calls.</div>`;
            return;
        }
        logs.forEach(log => {
            const date = new Date(log.started_at).toLocaleString();
            const color = log.call_status === 'missed' ? '#EF4444' : 'var(--secondary-green)';
            list.innerHTML += `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; background: var(--input-bg); border-radius: 8px;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <img src="${log.avatar_url || '/public/default-avatar.svg'}" style="width: 36px; height: 36px; border-radius: 50%; object-fit: cover;">
                        <div>
                            <div style="font-weight: 600; font-size: 14px;">${log.contact_name}</div>
                            <div style="font-size: 12px; color: var(--text-muted);">${date}</div>
                        </div>
                    </div>
                    <div style="font-size: 13px; text-align: right;">
                        <div style="color: ${color}; font-weight: 600; text-transform: capitalize;">${log.call_status}</div>
                        ${log.duration_sec ? `<div style="color: var(--text-muted);">${log.duration_sec}s</div>` : ''}
                    </div>
                </div>`;
        });
    }
};