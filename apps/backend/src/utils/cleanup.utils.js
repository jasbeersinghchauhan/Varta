import { query } from "../database/pool.js";

export async function cleanupExpiredTokens() {
    try {
        const result = await query("DELETE FROM refresh_tokens WHERE expires_at < now() LIMIT 5000");
        if (result && result.affectedRows > 0) {
            console.log(`[Cleanup] Purged ${result.affectedRows} expired tokens.`);
        }
    } catch (err) {
        console.error("[Cleanup Error] Failed to purge expired tokens: ", err.message);
        throw err;
    }
}

export async function cleanupExpiredData() {
    try {
        const result = await query("DELETE FROM email_verification WHERE expires_at < now() LIMIT 5000");
        if (result && result.affectedRows > 0) {
            console.log(`[Cleanup] Purged ${result.affectedRows} expired tokens.`);
        }
    } catch (err) {
        console.error("[Cleanup Error] Failed to purge expired tokens:", err);
        throw err;
    }
}