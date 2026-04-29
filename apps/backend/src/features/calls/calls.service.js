import { query } from "../../database/pool.js";
import crypto from "node:crypto";

export async function createCallLog(callerId, receiverId, callType) {
    const id = crypto.randomUUID();

    await query(`INSERT INTO call_logs (id, caller_id, receiver_id, call_type, call_status) VALUES (UUID_TO_BIN(?), UUID_TO_BIN(?), UUID_TO_BIN(?), ?, 'missed')`, [id, callerId, receiverId, callType]);
    return id;
}

export async function updateCallStatus(callId, status) {
    await query(`UPDATE call_logs SET call_status = ? WHERE id = UUID_TO_BIN(?)`, [status, callId]);
}

export async function finalizeCallLog(callId, durationSec) {
    await query(`UPDATE call_logs 
        SET duration_sec = ?, ended_at = CURRENT_TIMESTAMP 
        WHERE id = UUID_TO_BIN(?)`, [durationSec, callId]);
}

export async function getUserCallLogs(userId) {
    const rows = await query(`SELECT BIN_TO_UUID(cl.id) AS id, BIN_TO_UUID(cl.caller_id) as caller_id,
        BIN_TO_UUID(cl.receiver_id) as receiver_id,
        cl.call_type,
        cl.call_status,
        cl.duration_sec,
        cl.started_at,
        cl.ended_at,
        u.username as contact_name,
        u.avatar_url
        FROM call_logs cl
        JOIN users u ON u.id = IF(cl.caller_id = UUID_TO_BIN(?), cl.receiver_id, cl.caller_id)
        WHERE cl.caller_id = UUID_TO_BIN(?) OR cl.receiver_id = UUID_TO_BIN(?)
        ORDER BY cl.started_at DESC
        LIMIT 50`, [userId, userId, userId]);

    return rows;
}