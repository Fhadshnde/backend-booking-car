import express from "express";
import { createBrand, getAllBrands } from "../controllers/brand.controller.js";
import { protect, restrictTo } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/", getAllBrands);

router.post("/", protect, restrictTo("admin"), createBrand);

export default router;