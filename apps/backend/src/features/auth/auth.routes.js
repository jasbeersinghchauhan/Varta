import express from "express";
import { register, login, refresh, logout, getCurrentUser, verifyUserEmail } from "./auth.controller.js";
import { authenticate } from "../../middleware/auth.middleware.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/refresh", refresh);
router.post("/logout", logout);
router.get("/verify-email", verifyUserEmail);

router.get("/users/me", authenticate, getCurrentUser);

export { router as authRoutes };