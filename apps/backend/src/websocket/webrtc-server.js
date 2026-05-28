import { sendToUser } from "./connections.js";
import { createCallLog, updateCallStatus, finalizeCallLog } from "../features/calls/calls.service.js";

const activeCalls = new Map();

export async function handleWebRTCSignal(websocket, event) {
    if (!event.to) {
        websocket.send(JSON.stringify({
            type: "error",
            message: "MISSING_RECEIVER",
        }));
        return;
    }

    const senderId = websocket.userId;
    const receiverId = event.to;

    const callKey = [senderId, receiverId].sort().join("-");

    try {
        if (event.type === "webrtc_offer") {
            const callType = event.callType || 'video';
            const callId = await createCallLog(senderId, receiverId, callType);
            activeCalls.set(callKey, { id: callId, startTime: Date.now() });
        } else if (event.type === "webrtc_answer") {
            const callData = activeCalls.get(callKey);
            if (callData) {
                await updateCallStatus(callData.id, 'answered');
            }
        }
        else if (event.type === "webrtc_end_call") {
            const callData = activeCalls.get(callKey);
            if (callData) {
                const durationSec = Math.floor((Date.now() - callData.startTime) / 1000);
                await finalizeCallLog(callData.id, durationSec);
                activeCalls.delete(callKey);
            }
        }
    } catch (err) {
        console.error("Call log error: ", err);
    }

    const payload = {
        ...event,
        senderId: senderId,
    };

    sendToUser(receiverId, payload);
}

export async function cleanupUserCalls(userId) {
    for (const [callKey, callData] of activeCalls.entries()) {
        if (callKey.includes(userId)) {
            const durationSec = Math.floor((Date.now() - callData.startTime) / 1000);
            await finalizeCallLog(callData.id, durationSec).catch(console.error);
            activeCalls.delete(callKey);

            const otherUserId = callKey.split("-").find(id => id !== userId);
            if (otherUserId) {
                sendToUser(otherUserId, { type: "webrtc_end_call", senderId: userId });
            }
        }
    }
}