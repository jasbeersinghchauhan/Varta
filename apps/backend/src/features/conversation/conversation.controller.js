import { getUserConversations } from "./conversation.service.js";

export async function getConversations(req, res) {
    try {
        const userId = req.user.id;

        const conversations = await getUserConversations(userId);

        res.json(conversations);
    } catch (err) {
        res.writeHead(500);
        res.end(JSON.stringify({ message: "Failed to load conversations" }));
    }
}