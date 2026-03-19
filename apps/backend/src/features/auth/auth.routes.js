import express from "express";
import { register, login, refresh, logout, getCurrentUser } from "./auth.controller.js";
import { authenticate } from "../../middleware/auth.middleware.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/refresh", refresh);
router.post("/logout", logout);

router.get("/users/me", authenticate, getCurrentUser);

export { router as authRoutes };