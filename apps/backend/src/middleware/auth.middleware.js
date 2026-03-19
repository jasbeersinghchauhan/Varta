import { verifyAccessToken } from "../utils/token.utils.js";

export function authenticate(req, res, next) {
    try {
        const authHeader = req.headers["authorization"];
        if (!authHeader) {
            return res.status(401).json({ message: "NO_TOKEN" });
        }

        const token = authHeader.split(" ")[1];
        const userId = verifyAccessToken(token);

        req.user = { id: userId };
        
        next();
    } catch (err) {
        return res.status(401).json({ message: "INVALID_TOKEN" });
    }
}