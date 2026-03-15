import { query } from "../database/pool.js";

export async function cleanupExpiredTokens() {
    await query("DELETE FROM refresh_tokens WHERE expires_at < now()");
}