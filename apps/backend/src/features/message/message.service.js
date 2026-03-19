import { query } from "../../database/pool.js";
import crypto from "crypto";

export async function createMessage({
    conversationId,
    senderId,
    textContent = "",
    attachmentUrl = null,
}) {
    if (!textContent && !attachmentUrl) {
        throw new Error("EMPTY_MESSAGE");
    }

    const messageId = crypto.randomUUID();

    await query(
        `INSERT INTO messages (id, conversation_id, sender_id, text_content, attachment_url) VALUES (UUID_TO_BIN(?), UUID_TO_BIN(?), UUID_TO_BIN(?), ?, ?)`,
        [messageId, conversationId, senderId, textContent, attachmentUrl],
    );
    return messageId;
}

export async function updateLastMessage(conversationId, messageId) {
    await query(
        `UPDATE conversations SET last_message_id = UUID_TO_BIN(?) WHERE id = UUID_TO_BIN(?)`,
        [messageId, conversationId],
    );
}

export async function getMessages(conversationId, currentUserId) {
    const rows = await query(
        `SELECT 
            BIN_TO_UUID(id) as id, 
            BIN_TO_UUID(conversation_id) as conversation_id, 
            BIN_TO_UUID(sender_id) as sender_id, 
            text_content, 
            attachment_url,
            created_at,
            (sender_id = UUID_TO_BIN(?)) as is_sender
        FROM messages 
        WHERE conversation_id = UUID_TO_BIN(?) 
        ORDER BY created_at ASC 
        LIMIT 50`,
        [currentUserId, conversationId],
    );
    return rows.map((row) => ({
        ...row,
        is_sender: !!row.is_sender,
    }));
}
