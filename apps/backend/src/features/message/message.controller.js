import { getMessages } from "./message.service.js";
import { validateConversationUser } from "../conversation/conversation.service.js";

export async function fetchMessages(req, res) {
    try {
        const { conversationId } = req.params;
        const { cursor } = req.query;

        const userId = req.user.id;

        const allowed = await validateConversationUser(conversationId, userId);
        if (!allowed) return res.status(403).json({ error: "NOT_ALLOWED" });
        const messages = await getMessages(
            conversationId,
            userId,
            cursor ? new Date(cursor) : null,
        );
        res.json(messages);
    } catch (err) {
        res.status(500).json({ message: "FAILED_TO_FETCH_MESSAGES" });
    }
}