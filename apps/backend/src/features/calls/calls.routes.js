import express from "express";
import { getCallHistory } from "./calls.controller.js"
import { authenticate } from "../../middleware/auth.middleware.js";

const router = express.Router();

router.get("/", authenticate, getCallHistory);

export { router as callRoutes};