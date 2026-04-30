import express from "express";
import { register, login, refresh, logout, getCurrentUser, verifyUserEmail, resetPassword, forgotPassword, validateResetToken } from "./auth.controller.js";
import { authenticate } from "../../middleware/auth.middleware.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/refresh", refresh);
router.post("/logout", logout);

router.post("/forgot-password", forgotPassword);
router.post("/reset-password",resetPassword);
router.post("/validate-reset-token", validateResetToken);

router.get("/verify-email", verifyUserEmail);
router.get("/users/me", authenticate, getCurrentUser);

export { router as authRoutes };