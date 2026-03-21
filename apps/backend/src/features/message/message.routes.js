import express from "express";
import { fetchMessages } from "./message.controller.js";
import { authenticate } from "../../middleware/auth.middleware.js";

const router = express.Router();

router.get("/:conversationId", authenticate, fetchMessages);

export { router as messageRoutes };