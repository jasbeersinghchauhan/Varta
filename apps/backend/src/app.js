import { query } from "./database/pool.js";
import bcrypt from "bcrypt";
import fs from "fs/promises";

const errorCache = new Map();

async function sendError(res, errorCode) {
  try {
    if (!errorCache.has(errorCode)) {
      const html = await fs.readFile(`./public/${errorCode}.html`, "utf-8");
      errorCache.set(errorCode, html);
    }

    res.writeHead(errorCode, {
      "Content-Type": "text/html",
    });
    res.end(errorCache.get(errorCode));
  } catch {
    res.writeHead(errorCode, { "Content-Type": "text/plain" });
    res.end(`${errorCode} Error`);
  }
}

async function handleGET(req, res, url) {
  switch (url.pathname) {
    case "/health": {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok" }));
      return;
    }
    default:
      await sendError(res, 404);
      return;
  }
}

async function handlePOST(req, res, url) {
  switch (url.pathname) {
    case "/register": {
      let body = "";

      req.on("data", (chunk) => (body += chunk));

      req.on("end", async () => {
        try {
          if (!body) return await sendError(res, 400);

          let data;
          try {
            data = JSON.parse(body);
          } catch {
            return sendError(res, 400);
          }

          const { user_name, user_email, user_password } = data;

          if (!user_name || !user_email || !user_password) {
            await sendError(res, 400);
            return;
          }

          const hash = await bcrypt.hash(user_password, 10);

          const result = await query("INSERT INTO users (full_name, email) VALUES (?, ?)", [
            user_name,
            user_email,
          ]);

          res.writeHead(201, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              message: "User created",
              affectedRows: result.affectedRows,
            }),
          );
        } catch (err) {
          if (err.code === "ER_DUP_ENTRY") {
            res.writeHead(409, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ message: "Email already exists" }));
          }
          await sendError(res, 500);
        }
      });
      return;
    }
    default:
      await sendError(res, 404);
      return;
  }
}

export async function requestHandler(req, res) {
  try {
    const host = req.headers.host || "localhost";
    const url = new URL(req.url, `http://${host}`);

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "OPTIONS, GET, POST");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    console.log(`${req.method} ${url.pathname}`);

    switch (req.method) {
      case "GET":
        return handleGET(req, res, url);
      case "POST":
        return handlePOST(req, res, url);
      default:
        await sendError(res, 405);
        return;
    }
  } catch (err) {
    await sendError(res, 500);
  }
}
