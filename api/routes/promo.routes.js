import express from "express";
import { validatePromoCode, createPromoCode } from "../controllers/promo.controller.js";
import { protect, restrictTo } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/validate", protect, validatePromoCode);
router.post("/", protect, restrictTo("admin"), createPromoCode);

export default router;
