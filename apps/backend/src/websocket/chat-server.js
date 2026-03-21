import { getOrCreateConversation } from "../features/conversation/conversation.service.js";
import { createMessage } from "../features/message/message.service.js";
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
