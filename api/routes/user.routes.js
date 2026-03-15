import express from "express";
import { getUserProfile, updateUserProfile, getUsers, getUser, updateUser, deleteUser } from "../controllers/user.controller.js";
import { protect, restrictTo } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/profile", protect, getUserProfile);
router.put("/profile", protect, updateUserProfile);

router.get("/", protect, restrictTo("admin"), getUsers);
router.get("/:id", protect, restrictTo("admin"), getUser);
router.put("/:id", protect, restrictTo("admin"), updateUser);
router.delete("/:id", protect, restrictTo("admin"), deleteUser);

export default router;