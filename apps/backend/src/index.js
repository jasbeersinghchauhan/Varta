import "./config/env.js";
import { initializeDatabase } from "./database/pool.js";
import { requestHandler } from "./app.js";
import http from "node:http";

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    await initializeDatabase();
    console.log("Database connection established.");
  } catch (err) {
    console.error("Database initialization failed: ", err.message);
    process.exit(1);
  }

  const server = http.createServer(requestHandler);

  server.keepAliveTimeout = 65000;
  server.headersTimeout = 66000;
  server.requestTimeout = 120000;
  server.maxRequestsPerSocket = 1000;

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running on port: ${PORT}`);
  });
}

startServer();