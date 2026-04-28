import express from "express";
import { createDamageReport, getDamageReports, updateDamageReport } from "../controllers/damageReport.controller.js";
import { protect, restrictTo } from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(protect);

router.post("/", restrictTo("admin", "company"), createDamageReport);
router.get("/", restrictTo("admin", "company"), getDamageReports);
router.put("/:id", restrictTo("admin", "company"), updateDamageReport);

export default router;
