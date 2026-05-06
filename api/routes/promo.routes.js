import express from "express";
import { validatePromoCode, createPromoCode, getPromos } from "../controllers/promo.controller.js";
import { protect, restrictTo } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/", protect, restrictTo("admin"), getPromos);
router.post("/validate", protect, validatePromoCode);
router.post("/", protect, restrictTo("admin"), createPromoCode);

export default router;
