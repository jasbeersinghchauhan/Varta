import { getMessages as fetchMessages } from './message.service.js';

export async function getMessages(req, res) {
    try {
        const { conversationId } = req.params;
        const userId = req.user.id;

        const messages = await fetchMessages(conversationId, userId);
        res.json(messages);
    } catch (err) {
        res.status(500).json({ message: "FAILED_TO_FETCH_MESSAGES" });
    }
}