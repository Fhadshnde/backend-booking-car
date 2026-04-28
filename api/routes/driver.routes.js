import express from "express";
import { getAvailableDrivers, createDriver } from "../controllers/driver.controller.js";
import { protect, restrictTo } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/", protect, getAvailableDrivers);
router.post("/", protect, restrictTo("admin"), createDriver);

export default router;
