import { query, pool } from "./database/pool.js";
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
        const connection = await pool.getConnection();

        try {
          if (!body) return await sendError(res, 400);

          let data;
          try {
            data = JSON.parse(body);
          } catch {
            return sendError(res, 400);
          }

          const { username, email, password } = data;

          if (!username || !email || !password) {
            await sendError(res, 400);
            return;
          }

          const salt = 10;
          const passwordHash = await bcrypt.hash(password, salt);

          await connection.beginTransaction();

          await query("INSERT INTO users (username, email) VALUES (?, ?)", [
            username, email], connection);

          const rows = await query("SELECT id FROM users WHERE email = ?", [email], connection);
          const userId = rows[0].id;

          await query("INSERT INTO user_auth_providers (user_id, provider_type, password_hash) VALUES (?, 'password', ?)", 
            [userId, passwordHash], connection);

          await connection.commit();
          
          res.writeHead(201, { "Content-Type": "application/json" });
          res.end(JSON.stringify({message: "User created"}));
        } catch (err) {
          await connection.rollback();

          if (err.code === "ER_DUP_ENTRY") {
            res.writeHead(409, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ message: "Email already exists" }));
          }
          await sendError(res, 500);
        } finally {
          connection.release();
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
