import { getMessages } from "./message.service.js";
import { validateConversationUser } from "../conversation/conversation.service.js";

export async function fetchMessages(req, res) {
    try {
        const { conversationId } = req.params;
        const { cursor } = req.query;

        const userId = req.user.id;

        const allowed = await validateConversationUser(conversationId, userId);

        const parsedCursor =
            cursor && !isNaN(new Date(cursor))
                ? new Date(cursor)
                : null;

        if (!allowed) return res.status(403).json({ error: "NOT_ALLOWED" });
        const messages = await getMessages(
            conversationId,
            userId,
            parsedCursor
        );
        res.json(messages);
    } catch (err) {
        console.error("fetchMessages Error:", err);
        console.error(err.stack);
        res.status(500).json({ message: "FAILED_TO_FETCH_MESSAGES" });
    }
}