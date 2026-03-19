import express from "express";
import { getMessages } from "./message.controller.js";
import { authenticate } from "../../middleware/auth.middleware.js";

const router = express.Router();

router.get("/:conversationId", authenticate, getMessages);

export { router as messageRoutes };