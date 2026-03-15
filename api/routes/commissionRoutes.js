import express from "express";
import * as commissionController from "../controllers/commissionController.js";
import { protect, restrictTo } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/company/:companyId", protect, commissionController.getCommission);

router.get("/", protect, restrictTo("admin"), commissionController.getAllCommissions);

router.post("/", protect, restrictTo("admin"), commissionController.createCommission);

router.put("/:commissionId", protect, restrictTo("admin"), commissionController.updateCommission);

router.delete("/:commissionId", protect, restrictTo("admin"), commissionController.deleteCommission);

export default router;