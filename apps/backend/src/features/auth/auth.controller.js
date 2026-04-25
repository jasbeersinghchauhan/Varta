import {
    refreshSession,
    loginUser,
    logoutUser as logoutService,
    sendEmailVerification,
    verifyEmailToken
} from "./auth.service.js";
import { validateRegister } from "../../middleware/validation.middleware.js";
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
        validateRegister(body);

        const { username, email, password } = body;

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
        const { email, password } = body;
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
        const { token } = req.query;

        const result = await verifyEmailToken(token);
        return res.redirect(`${process.env.FRONTEND_URL}/login?verified=true`);
    } catch (err) {
        return res.status(400).json({ message: err.message });
    }
}