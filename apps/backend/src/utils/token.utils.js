import crypto from "crypto";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

export function generateAccessToken(userId) {
    return jwt.sign({ sub: userId }, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "15m",
    });
}

export async function generateRefreshToken(userId) {
    const tokenId = crypto.randomUUID();
    const secret = crypto.randomBytes(32).toString("hex");

    const refreshToken = `${tokenId}.${secret}`;
    const tokenHash = await bcrypt.hash(secret, 10);
    const expiresAt = new Date(
        Date.now() + 1000 * 60 * 60 * 24 * 30
    );//30 DAYS

    return {
        tokenId,
        tokenHash,
        refreshToken,
        expiresAt
    };
}

export function verifyAccessToken(token) {
    try {
        const payload = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
        return {
            userId: payload.sub
        };
    } catch (err) {
        throw new Error("INVALID_TOKEN");
    }
}