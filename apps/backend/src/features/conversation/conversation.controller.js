import { getOrCreateConversation, getUserConversations } from "./conversation.service.js";
import { query } from "../../database/pool.js";
import { getConnection } from "../../websocket/connections.js";

export async function getConversations(req, res) {
    try {
        const userId = req.user.id;
        const conversations = await getUserConversations(userId);
        const sockets = getConnection(conv.user_id);

        const userConversations = conversations.map(conv => ({
            ...conv,
            is_online: sockets && sockets.size > 0
        }));
        res.json(userConversations);
    } catch (err) {
        res.status(500).json({ message: "Failed to load conversations" });
    }
}

export async function addContact(req, res) {
    try {
        const myId = req.user.id;
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ message: "Email required" });
        }

        const users = await query(
            `SELECT BIN_TO_UUID(id) as id FROM users WHERE email = ?`,
            [email],
        );

        if (users.length === 0) {
            return res.status(404).json({ message: "User not found" });
        }

        const contactId = users[0].id;

        if (myId === contactId) {
            return res.status(400).json({ message: "You cannot add yourself" });
        }

        const conversation = await getOrCreateConversation(myId, contactId);

        res.status(201).json(conversation);
    } catch (err) {
        res.status(500).json({ message: "Failed to add contact" });
    }
}