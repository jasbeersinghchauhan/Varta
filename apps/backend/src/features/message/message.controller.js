import { getMessages as fetchMessages } from './message.service.js';

export async function getMessages(req, res) {
    const { conversationId } = req.params;
    const userId = req.user.id;

    const messages = await fetchMessages(conversationId, userId);
    res.json(messages);
}