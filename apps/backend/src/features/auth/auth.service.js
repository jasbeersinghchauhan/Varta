import bcrypt from "bcrypt"; my 
import { pool, query } from "../../database/pool.js";
import {
    generateAccessToken,
    generateRefreshToken,
} from "../../utils/token.utils.js";

export async function refreshSession(refreshToken) {
    const parts = refreshToken.split(".");
    if (parts.length !== 2) throw new Error("INVALID");

    const [tokenId, secret] = parts;

    const rows = await query(
        `SELECT BIN_TO_UUID(user_id) AS user_id, token_hash, expires_at FROM refresh_tokens WHERE id = UUID_TO_BIN(?)`,
        [tokenId],
    );
    if (rows.length === 0) throw new Error("INVALID");

    const row = rows[0];

    if (new Date(row.expires_at) < new Date()) {
        await query(`DELETE FROM refresh_tokens WHERE id = UUID_TO_BIN(?)`, [
            tokenId,
        ]);
        throw new Error("EXPIRED");
    }

    const valid = await bcrypt.compare(secret, row.token_hash);
    if (!valid) {
        //TOKEN REUSE DETECTED
        await query(`DELETE FROM refresh_tokens WHERE user_id = UUID_TO_BIN(?)`, [
            row.user_id,
        ]);
        throw new Error("TOKEN_REUSE");
    }

    //ROTATE TOKEN
    await query(`DELETE FROM refresh_tokens WHERE id = UUID_TO_BIN(?)`, [
        tokenId,
    ]);

    const accessToken = generateAccessToken(row.user_id);
    const {
        tokenId: newId,
        tokenHash,
        refreshToken: newRefresh,
    } = await generateRefreshToken(row.user_id);

    await query(
        `INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES(UUID_TO_BIN(?), UUID_TO_BIN(?), ?, DATE_ADD(NOW(), INTERVAL 7 DAYS))`,
        [newId, row.user_id, tokenHash],
    );
    return { accessToken, refreshToken: newRefresh };
}

export async function registerUser(username, email, password) {
    const passwordHash = await bcrypt.hash(password, 10);
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        await query(
            `INSERT INTO users (username, email) VALUES (?, ?)`,
            [username, email],
            connection,
        );

        const rows = await query(
            `SELECT id FROM users WHERE email = ?`,
            [email],
            connection,
        );
        const userId = rows[0].id;

        await query(
            `INSERT INTO user_auth_providers (user_id, provider_type, password_hash) VALUES (?, 'password', ?)`,
            [userId, passwordHash],
            connection,
        );

        await connection.commit();
    } catch (err) {
        await connection.rollback();
        throw err;
    } finally {
        connection.release();
    }
}

export async function loginUser(email, password) {
    const connection = await pool.getConnection();

    try {
        const rows = await query(
            `SELECT BIN_TO_UUID(u.id) as user_id, a.password_hash FROM users u JOIN user_auth_providers a ON u.id=a.user_id WHERE u.email=? AND a.provider_type = 'password'`,
            [email],
            connection,
        );

        if (rows.length === 0) {
            throw new Error("INVALID CREDENTIALS");
        }

        const user = rows[0];
        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) {
            throw new Error("INVALID CREDENTIALS");
        }

        const accessToken = generateAccessToken(user.user_id);
        const { tokenId, tokenHash, refreshToken } = await generateRefreshToken(
            user.user_id,
        );

        await query(
            `INSERT INTO refresh_tokens (id,user_id,token_hash,expires_at) VALUES(UUID_TO_BIN(?),UUID_TO_BIN(?),?, DATE_ADD(NOW(),INTERVAL 7 DAY))`,
            [tokenId, user.user_id, tokenHash],
            connection,
        );
        return { accessToken, refreshToken };
    } finally {
        connection.release();
    }
}

export async function logoutUser(refreshToken) {
    const [tokenId] = refreshToken.split(".");

    if (!tokenId) return;

    await query(`DELETE FROM refresh_tokens WHERE id = UUID_TO_BIN(?)`, [
        tokenId,
    ]);
}