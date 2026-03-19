import { query } from "../../database/pool.js";

export async function createMessage({
    conversationId,
    senderId,
    textContent = "",
    attachmentUrl = null,
}) {
    const result = await query(
        `INSERT INTO messages (conversation_id, sender_id, textContent, attachmentURL) VALUES (?, ?, ?, ?)`,
        [conversationId, senderId, textContent, attachmentUrl],
    );
    return result.insertId;
}

export async function updateLastMessage(conversationId, messageId) {
    await query(`UPDATE conversations SET last_message_id = ? WHERE id = ?`, [
        messageId,
        conversationId,
    ]);
}

export async function getMessages(conversationId) {
    const [rows] =await  query(
        `SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC LIMIT 50`,
        [conversationId],
    );
    return rows;
}
