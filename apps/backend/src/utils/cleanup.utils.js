import { query } from "../database/pool.js";

export async function cleanupExpiredTokens() {
    try {
        const result = await query("DELETE FROM refresh_tokens WHERE expires_at < now() LIMIT 5000");
    } catch (err) {
        console.error("[Cleanup Error] Failed to purge expired tokens: ", err.message);
    }
}