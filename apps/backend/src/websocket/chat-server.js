import { getOrCreateConversation } from "../features/conversation/conversation.service.js";
import { createMessage, updateMessageContent, softDeleteMessage } from "../features/message/message.service.js";
import { sendToUser } from "./connections.js";

export async function handleSendMessage(websocket, event) {
    if (!event.to || !event.content) {
        websocket.send(
            JSON.stringify({
                type: "error",
                message: "INVALID_MESSAGE",
            }),
        );
        return;
    }

    const senderId = websocket.userId;
    const receiverId = event.to;

    const conversation = await getOrCreateConversation(senderId, receiverId);

    const messageId = await createMessage({
        conversationId: conversation.id,
        senderId,
        textContent: event.content,
    });

    const payload = {
        type: "new_message",
        conversationId: conversation.id,
        senderId,
        content: event.content,
        messageId,
        timestamp: Date.now(),
    };

    sendToUser(receiverId, payload);
    sendToUser(senderId, payload);
}

export async function handleEditMessage(websocket, event) {
    if (!event.messageId || !event.content || !event.conversationId)
        return;

    const senderId = websocket.userId;

    try {
        await updateMessageContent(event.messageId, senderId, event.content);

        const payload = {
            type: "message_edited",
            messageId: event.messageId,
            content: event.content,
            conversationId: event.conversationId
        };

        sendToUser(event.to, payload);
        sendToUser(senderId, payload);
    } catch (err) {
        console.error("Failed to edit message:", err);
        websocket.send(JSON.stringify({ type: "error", message: "Failed to edit message" }));
    }
}

export async function handleDeleteMessage(websocket, event) {
    if (!event.messageId || !event.conversationId) return;

    const senderId = websocket.userId;

    try {
        await softDeleteMessage(event.messageId, senderId);

        const payload = {
            type: "message_deleted",
            messageId: event.messageId,
            conversationId: event.conversationId
        };

        sendToUser(event.to, payload);
        sendToUser(senderId, payload);
    } catch (err) {
        console.error("Failed to delete message:", err);
        websocket.send(JSON.stringify({ type: "error", message: "Failed to delete message" }));
    }
}