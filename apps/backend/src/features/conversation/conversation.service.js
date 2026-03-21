import { query } from "../../database/pool.js";
import { uuidToBuffer, bufferToUuid } from "../../utils/uuid.js";

export async function getOrCreateConversation(userA, userB) {
    const [user1, user2] = [userA, userB].sort();

    const b1 = uuidToBuffer(user1);
    const b2 = uuidToBuffer(user2);

    await query(
        `INSERT IGNORE INTO conversations (user1_id, user2_id) VALUES (?, ?)`,
        [b1, b2],
    );

    const rows = await query(
        `SELECT id FROM conversations WHERE user1_id = ? AND user2_id = ?`,
        [b1, b2],
    );
    return {
        id: bufferToUuid(rows[0].id)
    };
}

export async function validateConversationUser(conversationId, userId) {
    const rows = await query(`SELECT 1 FROM conversations WHERE id = ? AND (user1_id = ? OR user2_id = ?)`,
        [uuidToBuffer(conversationId), uuidToBuffer(userId), uuidToBuffer(userId)]
    );
    return rows.length > 0; 
}

export async function getUserConversations(userId) {
    const rows = await query(
        `SELECT 
            BIN_TO_UUID(c.id) as id,
            BIN_TO_UUID(u.id) as user_id,
            u.username,
            u.email,
            u.avatar_url,
            m.text_content as last_message
         FROM conversations c
         JOIN users u ON u.id = CASE 
            WHEN c.user1_id = UUID_TO_BIN(?) THEN c.user2_id 
            ELSE c.user1_id 
         END
         LEFT JOIN messages m ON c.last_message_id = m.id
         WHERE c.user1_id = UUID_TO_BIN(?) OR c.user2_id = UUID_TO_BIN(?) 
         ORDER BY m.created_at DESC`,
        [userId, userId, userId],
    );
    return rows;
}