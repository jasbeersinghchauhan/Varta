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

export function removeConnection(userId) {
    const userSockets = onlineUsers.get(userId);
    if (userSockets) {
        userSockets.delete(websocket);
        if (userSockets.size === 0) {
            onlineUsers.delete(userId);
        }
    }
}