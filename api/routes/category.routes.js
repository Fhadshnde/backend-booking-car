// category.routes.js
import express from "express";
import { getCategories, createCategory, getCategoryCars } from "../controllers/category.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import { uploadSingleImage } from "../middleware/upload.js"; 

const router = express.Router();

router.get("/", getCategories);
router.get("/:id/cars", getCategoryCars);

// قم بإزالة السطر المكرر واترك هذا فقط:
router.post("/", protect, uploadSingleImage, createCategory);

export default router;