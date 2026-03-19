import express from "express";
import { getConversations } from "./conversation.controller.js";
import { authenticate } from "../../middleware/auth.middleware.js";

const router = express.Router();

router.get('/', authenticate, getConversations);

export { router as conversationRoutes };