import express from "express";
import { register, login, getCurrentUser, changePassword } from "../controllers/auth.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/register", register);   // تسجيل مستخدم جديد
router.post("/login", login);         // تسجيل الدخول
router.get("/me", protect, getCurrentUser);   // بيانات المستخدم الحالي
router.put("/change-password", protect, changePassword); // تغيير كلمة المرور

export default router;