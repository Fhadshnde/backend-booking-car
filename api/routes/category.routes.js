import express from "express";
import { getCategories, createCategory, getCategoryCars } from "../controllers/category.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/", getCategories);
router.get("/:id/cars", getCategoryCars);
router.post("/", protect, createCategory);

export default router;