import express from "express";
import {
  getSettings,
  updateSettings,
  getDepositPercentage,
  getCashbackSettings,
  setGlobalDepositPercentage,
  setCashbackSettings,
  getInsurancePrice,
  setInsurancePrice,
} from "../controllers/settings.controller.js";
import { protect, restrictTo } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/", protect, getSettings);
router.put("/", protect, restrictTo("admin"), updateSettings);
router.get("/deposit-percentage", protect, getDepositPercentage);
router.post("/deposit-percentage", protect, restrictTo("admin"), setGlobalDepositPercentage);
router.get("/insurance-price", protect, getInsurancePrice);
router.post("/insurance-price", protect, restrictTo("admin"), setInsurancePrice);
router.get("/cashback", protect, getCashbackSettings);
router.post("/cashback", protect, restrictTo("admin"), setCashbackSettings);

export default router;