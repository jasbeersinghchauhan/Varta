import { query } from "../../database/pool.js";

function normalizeUsers(userA, userB) {
    return userA < userB ? [userA, userB] : [userB, userA];
}

export async function getOrCreateConversation(userA, userB) {
    const [u1, u2] = normalizeUsers(userA, userB);

    const rows = await query(
        `SELECT id FROM conversations WHERE user1_id = ? AND user2_id = ?`,
        [u1, u2],
    );
    if (rows.length > 0) return rows[0];

    await query(
        `INSERT INTO conversations (user1_id, user2_id) VALUES (UUID_TO_BIN(?), UUID_TO_BIN(?))`,
        [u1, u2],
    );
    const newRows = await query(
        `SELECT BIN_TO_UUID(id) as id FROM conversations WHERE user1_id = UUID_TO_BIN(?) AND user2_id = UUID_TO_BIN(?)`,
        [u1, u2],
    );
    return newRows[0];
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
         ORDER BY c.created_at DESC`,
        [userId, userId, userId],
    );
    return rows;
}