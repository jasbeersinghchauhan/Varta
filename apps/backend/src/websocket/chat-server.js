import { getOrCreateConversation } from "../features/conversation/conversation.service.js";
import {
    createMessage,
    updateLastMessage,
} from "../features/message/message.service.js";
import { getConnection } from "./connections.js";

export async function handleSendMessage(websocket, event) {
    const senderId = websocket.userId;
    const receiverId = event.to;

    const conversation = await getOrCreateConversation(senderId, receiverId);

    const messageId = await createMessage({
        conversationId: conversation.id,
        senderId,
        textContent: event.content,
    });

    await updateLastMessage(conversation.id, messageId);

    const payload = {
        type: "new_message",
        conversationId: conversation.id,
        senderId,
        content: event.content,
        messageId,
    };

    const receiverWs = getConnection(receiverId);

    if (receiverWs) {
        receiverWs.send(JSON.stringify(payload));
    }

    websocket.send(JSON.stringify(payload));
}
