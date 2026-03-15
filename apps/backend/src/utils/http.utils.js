import fs from "fs/promises";

const errorCache = new Map();

export async function sendError(res, errorCode) {
    try {
        if (!errorCache.has(errorCode)) {
            const html = await fs.readFile(`../public/${errorCode}.html`, "utf-8");
            errorCache.set(errorCode, html);
        }

        res.writeHead(errorCode, { "Content-Type": "text/html" });
        res.end(errorCache.get(errorCode));
    } catch {
        res.writeHead(errorCode, { "Content-Type": "text/plain" });
        res.end(`${errorCode} Error`);
    }
}