import express from "express";
import { getAllUsers, getUserProfile, updateUserProfile } from "../controllers/user.controller.js";
import { protect, restrictTo } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/", protect, restrictTo("admin"), getAllUsers);
router.get("/profile/:id", protect, getUserProfile);
router.put("/profile/:id", protect, updateUserProfile);

export default router;