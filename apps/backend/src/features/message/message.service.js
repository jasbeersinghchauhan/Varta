import { pool, query } from "../../database/pool.js";
import { uuidToBuffer, bufferToUuid } from "../../utils/uuid.js";
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

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        await query(
            `INSERT INTO messages (id, conversation_id, sender_id, text_content, attachment_url) VALUES (?, ?, ?, ?, ?)`,
            [
                uuidToBuffer(messageId),
                uuidToBuffer(conversationId),
                uuidToBuffer(senderId),
                textContent,
                attachmentUrl,
            ],
            connection,
        );

        await query(
            `UPDATE conversations SET last_message_id = ? WHERE id = ?`,
            [uuidToBuffer(messageId), uuidToBuffer(conversationId)],
            connection,
        );

        await connection.commit();
    } catch (err) {
        await connection.rollback();
        throw err;
    } finally {
        connection.release();
    }

    return messageId;
}

export async function updateLastMessage(conversationId, messageId) {
    await query(
        `UPDATE conversations SET last_message_id = ? WHERE id = ?`,
        [uuidToBuffer(messageId), uuidToBuffer(conversationId)],
    );
}

export async function getMessages(
    conversationId,
    currentUserId,
    cursor = null,
) {
    const queryParams = [uuidToBuffer(currentUserId), uuidToBuffer(conversationId)];

    if (cursor) {
        queryParams.push(cursor);
    }

    const rows = await query(
        `SELECT 
            id, 
            conversation_id, 
            sender_id, 
            text_content, 
            attachment_url,
            created_at,
            deleted_at,
            edited_at,
            sender_id = ? AS is_sender
        FROM messages 
        WHERE conversation_id = ? 
        ${cursor ? "AND created_at < ?" : ""}
        ORDER BY created_at DESC 
        LIMIT 50`,
        queryParams
    );
    return rows.reverse().map((row) => ({
        id: bufferToUuid(row.id),
        conversation_id: bufferToUuid(row.conversation_id),
        sender_id: bufferToUuid(row.sender_id),
        text_content: row.text_content,
        attachment_url: row.attachment_url,
        created_at: row.created_at,
        deleted_at: row.deleted_at,
        edited_at: row.edited_at,
        is_sender: Boolean(row.is_sender),
    }));
}

export async function getMessagesByConversationId(conversationId) {
    const rows = await query(`SELECT 
            BIN_TO_UUID(id) AS id, 
            BIN_TO_UUID(conversation_id) AS conversation_id,
            BIN_TO_UUID(sender_id) AS sender_id,
            message_type,
            text_content,
            attachment_url,
            deleted_at,
            edited_at,
            created_at
        FROM messages 
        WHERE conversation_id = UUID_TO_BIN(?)
        ORDER BY created_at ASC`, [conversationId]);
    return rows;
}

export async function updateMessageContent(messageId, senderId, newContent) {
    const sql = `UPDATE messages SET text_content = ?, edited_at = CURRENT_TIMESTAMP WHERE id = ? AND sender_id = ?`;
    await query(sql, [newContent, uuidToBuffer(messageId), uuidToBuffer(senderId)]);
}

export async function softDeleteMessage(messageId, senderId) {
    const sql = `UPDATE messages SET deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND sender_id = ?`;
    await query(sql, [uuidToBuffer(messageId), uuidToBuffer(senderId)]);
}
