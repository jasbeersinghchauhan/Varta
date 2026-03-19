import "./config/env.js";
import { initializeDatabase } from "./database/pool.js";
import { initializeWebSocket } from "./websocket/ws-server.js";
import { app } from "./app.js";
import { cleanupExpiredTokens } from "./utils/cleanup.utils.js";
import http from "node:http";

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    await initializeDatabase();
    console.log("Database connection established.");

    setInterval(() => {
      cleanupExpiredTokens().catch(err => console.error("Cleanup failed: ", err));
    }, 1000 * 60 * 15);
  } catch (err) {
    console.error("Database initialization failed: ", err.message);
    process.exit(1);
  }

  const server = http.createServer(app);

  server.keepAliveTimeout = 65000;
  server.headersTimeout = 66000;
  server.requestTimeout = 120000;
  server.maxRequestsPerSocket = 1000;

  initializeWebSocket(server);

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running on port: ${PORT}`);
  });
}

startServer();