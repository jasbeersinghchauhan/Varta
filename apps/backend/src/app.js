import { authRoutes } from "./features/auth/auth.routes.js";
import { sendError } from "./utils/http.utils.js";

export async function requestHandler(req, res) {
  try {
    const host = req.headers.host || "localhost";
    const url = new URL(req.url, `http://${host}`);

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "OPTIONS, GET, POST, PUT, DELETE");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    console.log(`${req.method} ${url.pathname}`);

    if (req.method === "GET" && url.pathname === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok" }));
      return;
    }

    const authPaths = ["/register", "/login", "/refresh", "/logout"];
    if (authPaths.includes(url.pathname)) {
      const handled = await authRoutes(req, res, url);
      if (handled === false) {
        await sendError(res, 405);
      }
      return;
    }

    await sendError(res, 404);
  } catch (err) {
    console.error("Server Error: ", err);
    await sendError(res, 500);
  }
}
