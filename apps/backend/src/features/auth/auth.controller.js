import { refreshSession, registerUser, loginUser, logoutUser as logoutService } from "./auth.service.js";
import { validateRegister } from "../../middleware/validation.middleware.js";
import { sendError } from "../../utils/http.utils.js"

export async function refresh(req, res, body) {
    try {
        const { refreshToken } = body;
        if (!refreshToken) {
            res.writeHead(401);
            return res.end();
        }

        const tokens = await refreshSession(refreshToken);

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(tokens));
    } catch (err) {
        res.writeHead(401);
        res.end();
    }
}

export async function logout(req, res, body) {
    try {
        const { refreshToken } = body;
        if (!refreshToken) {
            res.writeHead(400);
            return res.end();
        }
        await logoutService(refreshToken);

        res.writeHead(204);
        res.end();
    } catch (err) {
        res.writeHead(400);
        res.end();
    }
}

export async function register(req, res, body) {
    try {
        validateRegister(body);

        const { username, email, password } = body;
        await registerUser(username, email, password);

        res.writeHead(201, { "Content-Type": "application/json" });
        res.end(
            JSON.stringify({
                message: "User Created",
            }),
        );
    } catch (err) {
        if (err.message.startsWith("INVALID_")) {
            res.writeHead(400, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ message: err.message }));
        }

        if (err.code === "ER_DUP_ENTRY") {
            res.writeHead(409, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ message: "Email already exists" }));
        }
        await sendError(res, 500);
    }
}

export async function login(req, res, body) {
    try {
        const { email, password } = body;
        if (!email || !password) {
            res.writeHead(400, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ message: "Email and password are required" }));
        }
        const tokens = await loginUser(email, password);

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(tokens));
    } catch (err) {
        if (err.message === "INVALID CREDENTIALS") {
            res.writeHead(401, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ message: "Invalid credentials" }));
        } else {
            await sendError(res, 500);
        }
    }
}