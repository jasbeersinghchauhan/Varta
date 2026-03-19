const onlineUsers = new Map();

export function registerConnection(userId, websocket) {
    onlineUsers.set(userId, websocket);
}

export function getConnection(userId) {
    return onlineUsers.get(userId);
}

export function removeConnection(userId) {
    onlineUsers.delete(userId);
}