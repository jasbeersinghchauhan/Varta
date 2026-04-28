import { sendToUser } from "./connections.js";

export async function handleWebRTCSignal(websocket, event) {
    if (!event.to) {
        websocket.send(JSON.stringify({
            type: "error",
            message: "INVALID_WEBRTC_SIGNAL_MISSING_TO",
        }));
        return;
    }

    const senderId = websocket.userId;
    const receiverId = event.to;

    const payload = {
        ...event,
        senderId: senderId, 
    };

    sendToUser(receiverId, payload);
}