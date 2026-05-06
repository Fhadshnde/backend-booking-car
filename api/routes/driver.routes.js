import express from "express";
import { 
  getDrivers, 
  getAvailableDrivers, 
  createDriver, 
  updateDriver, 
  deleteDriver 
} from "../controllers/driver.controller.js";
import { protect, restrictTo } from "../middleware/auth.middleware.js";
import { uploadSingleImage } from "../middleware/upload.js";

const router = express.Router();

router.get("/", protect, getDrivers);
router.get("/available", protect, getAvailableDrivers);
router.post("/", protect, restrictTo("admin", "company"), uploadSingleImage, createDriver);
router.put("/:id", protect, restrictTo("admin", "company"), uploadSingleImage, updateDriver);
router.delete("/:id", protect, restrictTo("admin", "company"), deleteDriver);

export default router;
