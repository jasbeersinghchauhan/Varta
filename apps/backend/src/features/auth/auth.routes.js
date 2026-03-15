import { register, login, refresh, logout } from "./auth.controller.js";

async function parseBody(req) {
    return new Promise((resolve, reject) => {
        let body = "";
        const MAX_BODY_SIZE = 1e6;

        req.on("data", (chunk) => {
            body += chunk;
            if (body.length > MAX_BODY_SIZE) {
                reject(new Error("PAYLOAD_TOO_LARGE"));
                req.destroy();
            }
        });

        req.on("end", () => {
            if (!body)
                return resolve({});
            try {
                resolve(JSON.parse(body));
            } catch {
                reject(new Error("INVALID_JSON"));
            }
        });
    });
}

export async function authRoutes(req, res, url) {
    if (req.method === "POST") {
        switch (url.pathname) {
            case "/register": {
                const body = await parseBody(req);
                return register(req, res, body);
            }

            case "/login": {
                const body = await parseBody(req);
                return login(req, res, body);
            }

            case "/refresh": {
                const body = await parseBody(req);
                return refresh(req, res, body);
            }

            case "/logout": {
                const body = await parseBody(req);
                return logout(req, res, body);
            }
        }
    }
    return false;
}
