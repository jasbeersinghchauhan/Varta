import { getMessages as fetchMessages } from './message.service.js';

export async function getMessages(req, res) {
    const { conversationId } = req.params;
    const messages = await fetchMessages(conversationId);
    res.json(messages);
}