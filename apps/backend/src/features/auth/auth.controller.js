import {
    refreshSession,
    loginUser,
    logoutUser as logoutService,
    sendEmailVerification,
    verifyEmailToken,
    generatePasswordResetToken,
    resetUserPassword,
    checkResetTokenIsValid
} from "./auth.service.js";
import { validateEmail, validatePassword, validateRegister } from "../../middleware/validation.middleware.js";
import { query } from "../../database/pool.js";

export async function refresh(req, res) {
    const body = req.body;
    try {
        const { refreshToken } = body;
        if (!refreshToken) {
            return res.status(401).json({ message: "Refresh token required" });
        }

        const tokens = await refreshSession(refreshToken);
        res.status(200).json(tokens);
    } catch (err) {
        res.status(401).json({ message: "Session expired or invalid" });
    }
}

export async function logout(req, res) {
    const body = req.body;
    try {
        const { refreshToken } = body;
        if (!refreshToken) {
            return res.status(400).json({ message: "Refresh token required" });
        }

        await logoutService(refreshToken);
        res.status(204).send();
    } catch (err) {
        res.status(400).json({ message: "Logout failed" });
    }
}

export async function register(req, res) {
    const body = req.body;
    try {

        const { username, email, password } = validateRegister(body);;

        const existingUsers = await query(`SELECT id FROM users WHERE email = ?`, [email]);
        if (existingUsers.length > 0) {
            return res.status(409).json({ message: "Email already exists" });
        }

        await sendEmailVerification(username, email, password);

        res.status(201).json({ message: "Gmail verification sent" });
    } catch (err) {
        if (err.message.startsWith("INVALID_")) {
            return res.status(400).json({ message: err.message });
        }

        if (err.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ message: "Email already exists" });
        }
        res.status(500).json({ message: "Internal server error" });
    }
}

export async function login(req, res) {
    const body = req.body;
    try {
        let { email, password } = body;
        email = validateEmail(email);
        password = validatePassword(password);

        if (!email || !password) {
            return res
                .status(400)
                .json({ message: "Email and password are required" });
        }
        const tokens = await loginUser(email, password);

        res.status(200).json(tokens);
    } catch (err) {
        if (err.message === "INVALID CREDENTIALS") {
            res.status(401).json({ message: "Invalid credentials" });
        } else {
            res.status(500).json({ message: "Internal server error" });
        }
    }
}

export async function getCurrentUser(req, res) {
    try {
        const userId = req.user.id;

        const rows = await query(
            `SELECT BIN_TO_UUID(id) AS id, username, email, avatar_url FROM users WHERE id = UUID_TO_BIN(?)`,
            [userId],
        );

        if (!rows || rows.length === 0) {
            return res.status(404).json({ message: "User not found" });
        }

        res.status(200).json(rows[0]);
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
}


export async function verifyUserEmail(req, res) {
    try {
        const { token } = req.body.token;

        const result = await verifyEmailToken(token);
        return res.redirect(`${process.env.FRONTEND_URL}/login?verified=true`);
    } catch (err) {
        return res.status(400).json({ message: err.message });
    }
}

export async function forgotPassword(req, res) {
    try {
        let { email } = req.body;
        if (!email) return res.status(400).json({ message: "Email is required" });
        email = validateEmail(email);

        await generatePasswordResetToken(email);
        res.status(200).json({ message: "If that email is registered, a password reset link has been sent." });
    } catch (err) {
        res.status(500).json({ message: `Internal server error` });
    }
}

export async function resetPassword(req, res) {
    try {
        let { token, newPassword } = req.body;

        if (!token || !newPassword) {
            return res.status(400).json({ message: "Token and new password are required" });
        }

        newPassword = validatePassword(newPassword);
        await resetUserPassword(token, newPassword);
        res.status(200).json({ message: "Password has been successfully reset." });
    } catch (err) {
        if (err.message === "WEAK_PASSWORD") return res.status(400).json({ message: "Password does not meet strength requirements." });
        if (err.message === "INVALID_TOKEN") return res.status(400).json({ message: "Invalid reset token." });
        if (err.message === "TOKEN_EXPIRED") return res.status(400).json({ message: "Reset token has expired." });
        res.status(500).json({ message: "Internal server error" });
    }
}

export async function validateResetToken(req, res) {
    try {
        const { token } = req.body;
        if (!token) {
            return res.status(400).json({ message: "Token is required" });
        }

        await checkResetTokenIsValid(token);
        res.status(200).json({ message: "Token is valid" });
    } catch (err) {
        res.status(400).json({ message: "Invalid or expired token" });
    }
}