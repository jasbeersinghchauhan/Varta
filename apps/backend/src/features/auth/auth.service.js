import bcrypt from "bcrypt";
import crypto from "crypto";
import { pool, query } from "../../database/pool.js";
import {
    generateAccessToken,
    generateRefreshToken,
} from "../../utils/token.utils.js";
import { sendVerificationEmail, sendPasswordResetEmail } from "./email.service.js";
import { uuidToBuffer } from "../../utils/uuid.utils.js";

export async function refreshSession(refreshToken) {
    const parts = refreshToken.split(".");
    if (parts.length !== 2) throw new Error("INVALID");

    const [tokenId, secret] = parts;
    const tokenBuffer = uuidToBuffer(tokenId);

    const rows = await query(
        `SELECT BIN_TO_UUID(user_id) AS user_id, token_hash, expires_at FROM refresh_tokens WHERE id = ?`,
        [tokenBuffer],
    );
    if (rows.length === 0) throw new Error("INVALID");

    const row = rows[0];

    if (new Date(row.expires_at) < new Date()) {
        await query(`DELETE FROM refresh_tokens WHERE id = ?`, [tokenBuffer]);
        throw new Error("EXPIRED");
    }

    const valid = await bcrypt.compare(secret, row.token_hash);
    if (!valid) {
        // TOKEN REUSE DETECTED
        const userBuffer = uuidToBuffer(row.user_id);
        await query(`DELETE FROM refresh_tokens WHERE user_id = ?`, [userBuffer]);
        throw new Error("TOKEN_REUSE");
    }

    // ROTATE TOKEN
    await query(`DELETE FROM refresh_tokens WHERE id = ?`, [tokenBuffer]);

    const accessToken = generateAccessToken(row.user_id);
    const {
        tokenId: newId,
        tokenHash,
        refreshToken: newRefresh,
    } = await generateRefreshToken(row.user_id);

    await query(
        `INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES(?, ?, ?, DATE_ADD(NOW(), INTERVAL 7 DAYS))`,
        [uuidToBuffer(newId), uuidToBuffer(row.user_id), tokenHash],
    );
    return { accessToken, refreshToken: newRefresh };
}

export async function registerUser(username, email, passwordHash) {
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
            `INSERT INTO refresh_tokens (id,user_id,token_hash,expires_at) VALUES(?,?,?, DATE_ADD(NOW(),INTERVAL 7 DAY))`,
            [uuidToBuffer(tokenId), uuidToBuffer(user.user_id), tokenHash],
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

    await query(`DELETE FROM refresh_tokens WHERE id = ?`, [
        uuidToBuffer(tokenId),
    ]);
}

export async function sendEmailVerification(username, email, password) {
    const passwordHash = await bcrypt.hash(password, 10);
    const token = crypto.randomBytes(32).toString("hex");

    const expiresAt = new Date(Date.now() + 1000 * 60 * 15);

    await query(`DELETE FROM email_verification WHERE email = ?`, [email]);
    // INTO TEMPORARY TABLE
    await query(`INSERT INTO email_verification (username, email, password_hash, token, expires_at) VALUES (?, ?, ?, ?, ?)`, [username, email, passwordHash, token, expiresAt]);

    const verificationUrl = `${process.env.FRONTEND_URL}/?verifyToken=${token}`;

    await sendVerificationEmail(email, username, verificationUrl);
}

export async function verifyEmailToken(token) {
    const rows = await query(
        `SELECT * FROM email_verification WHERE token = ?`,
        [token]
    );

    if (!rows.length) {
        throw new Error("Invalid token");
    }

    const record = rows[0];

    if (new Date(record.expires_at) < new Date()) {
        throw new Error("Token expired");
    }

    try {
        await registerUser(record.username, record.email, record.password_hash);
    } catch (err) {
        if (err.code !== 'ER_DUP_ENTRY') {
            throw err;
        }
    }
    await query(`DELETE FROM email_verification WHERE token = ?`, [token]);
}

export async function generatePasswordResetToken(email) {
    const users = await query(`SELECT id FROM users WHERE email = ?`, [email]);
    if (users.length === 0) return;

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 1000 * 60 * 15);

    await query(`DELETE FROM password_reset WHERE email = ?`, [email]);
    await query(`INSERT INTO password_reset (email, token, expires_at) VALUES (?, ?, ?)`, [email, token, expiresAt]);

    const resetUrl = `${process.env.FRONTEND_URL}/?token=${token}`;
    await sendPasswordResetEmail(email, resetUrl);
}

export async function checkResetTokenIsValid(token) {
    const rows = await query(`SELECT expires_at FROM password_reset WHERE token = ?`, [token]);

    if (rows.length === 0) {
        throw new Error("INVALID_TOKEN");
    }

    if (new Date(rows[0].expires_at) < new Date()) {
        throw new Error("TOKEN_EXPIRED");
    }

    return true;
}

export async function resetUserPassword(token, newPassword) {
    const rows = await query(`SELECT email, expires_at FROM password_reset WHERE token = ?`, [token]);
    if (rows.length === 0)
        throw new Error("INVALID_TOKEN");

    const record = rows[0];

    if (new Date(record.expires_at) < new Date()) {
        await query(`DELETE FROM password_reset WHERE token = ?`, [token]);
        throw new Error("TOKEN_EXPIRED");
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    const users = await query(`SELECT id FROM users WHERE email = ?`, [record.email]);

    if (users.length > 0) {
        const userId = users[0].id;
        await query(
            `UPDATE user_auth_providers SET password_hash = ? WHERE user_id = ? AND provider_type = 'password'`,
            [passwordHash, userId]
        );
    }
    await query(`DELETE FROM password_reset WHERE email = ?`, [record.email]);
}