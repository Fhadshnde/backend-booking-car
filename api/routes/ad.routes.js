import express from "express";
import * as adController from "../controllers/ad.controller.js";

import { protect, restrictTo } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/", adController.getAllAds);
router.get("/:id", adController.getAdById);

// Admin Only
router.post("/", protect, restrictTo("admin"), adController.createAd);
router.patch("/:id", protect, restrictTo("admin"), adController.updateAd);
router.delete("/:id", protect, restrictTo("admin"), adController.deleteAd);

export default router;