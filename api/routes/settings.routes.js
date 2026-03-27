import express from "express";
import {
  getSettings,
  updateSettings,
  getDepositPercentage,
  getCashbackSettings,
  setGlobalDepositPercentage,
  setCashbackSettings,
} from "../controllers/settings.controller.js";
import { protect, restrictTo } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/", protect, getSettings);
router.put("/", protect, restrictTo("admin"), updateSettings);
router.get("/deposit-percentage", protect, getDepositPercentage);
router.post("/deposit-percentage", protect, restrictTo("admin"), setGlobalDepositPercentage);
router.get("/cashback", protect, getCashbackSettings);
router.post("/cashback", protect, restrictTo("admin"), setCashbackSettings);

export default router;