import express from "express";
import cors from "cors";
import { authRoutes } from "./features/auth/auth.routes.js";
import { conversationRoutes } from "./features/conversation/conversation.routes.js";
import { messageRoutes } from "./features/message/message.routes.js";
import { callRoutes } from "./features/calls/calls.routes.js"

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

app.use("/", authRoutes);
app.use("/conversations", conversationRoutes);
app.use("/messages", messageRoutes);
app.use("/calls", callRoutes);

app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

app.use((err, req, res, next) => {
  console.error("Server Error: ", err);
  res.status(500).json({ message: "Internal server error"});
});

export { app };