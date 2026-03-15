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

    return {
        tokenId,
        tokenHash,
        refreshToken,
    };
}
