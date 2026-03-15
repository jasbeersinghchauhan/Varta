import jwt from "jsonwebtoken";

export function authentication(req) {
    const header = req.headers.authorization;
    if (!header)
        return null;

    const token = header.split(" ")[1];
    try {
        const payload = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
        return payload.sub;
    } catch {
        return null;
    }
}