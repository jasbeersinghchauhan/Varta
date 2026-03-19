import express from "express";
import { getConversations, addContact } from "./conversation.controller.js";
import { authenticate } from "../../middleware/auth.middleware.js";

const router = express.Router();

router.get('/', authenticate, getConversations);
router.post("/", authenticate, addContact);

export { router as conversationRoutes };