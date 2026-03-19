import { query } from "../../database/pool.js";

function normalizeUsers(userA, userB) {
    return userA < userB ? [userA, userB] : [userB, userA];
}

export async function getOrCreateConversation(userA, userB) {
    const [u1, u2] = normalizeUsers(userA, userB);

    const [rows] = await query(
        `SELECT id FROM conversations WHERE user1_id = ? AND user2_id = ?`,
        [u1, u2],
    );
    if (rows.length > 0) return rows[0];

    const result = await query(
        `INSERT INTO conversations (user1_id, user2_id) VALUES (?, ?)`,
        [u1, u2],
    );
    return { id: result.insertId };
}

export async function getUserConversations(userId) {
    const [rows] = await query(
        `SELECT * FROM conversations WHERE user1_id = ? OR user2_id = ? ORDER BY created_at DESC`,
        [userId, userId],
    );
    return rows;
}