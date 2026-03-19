import { verifyAccessToken } from "../utils/token.utils";

export function authenticate(req, res) {
    const authHeader = req.headers["authorization"];
    if (!authHeader)
        throw new Error("NO_TOKEN");

    const token = authHeader.split(" ")[1];
    const userId = verifyAccessToken(token);
    return userId;
}