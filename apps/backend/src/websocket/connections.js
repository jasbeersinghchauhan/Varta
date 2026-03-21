import { getUserConversations } from "../features/conversation/conversation.service.js";

const onlineUsers = new Map();

export function registerConnection(userId, websocket) {
    if (!onlineUsers.has(userId)) {
        onlineUsers.set(userId, new Set());
    }
    onlineUsers.get(userId).add(websocket);
}

export function getConnection(userId) {
    return onlineUsers.get(userId);
}

export function removeConnection(userId, websocket) {
    const userSockets = onlineUsers.get(userId);
    if (userSockets) {
        userSockets.delete(websocket);
        if (userSockets.size === 0) {
            onlineUsers.delete(userId);
        }
    }
}

export function sendToUser(userId, payload) {
    const sockets = onlineUsers.get(userId);

    if (!sockets) return;

    for (const ws of sockets) {
        if (ws.readyState === 1) {
            ws.send(JSON.stringify(payload));
        }
    }
}

export async function broadcastStatus(userId, isOnline) {
    try {
        const conversations = await getUserConversations(userId);

        const payload = {
            type: "user_status",
            userId: userId,
            is_online: isOnline
        };

        for (const conv of conversations) {
            sendToUser(conv.user_id, payload);
        }
    } catch (err) {
        console.error("Failed to broadcast status:", err);
    }
}