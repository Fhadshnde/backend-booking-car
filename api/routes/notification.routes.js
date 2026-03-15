import express from "express";
import { getMyNotifications, markAsRead, markAllAsRead, deleteNotification } from "../controllers/notification.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(protect);

// جلب إشعاراتي
router.get("/", getMyNotifications);

// تحديد إشعار كمقروء
router.put("/:id/read", markAsRead);

// تحديد الكل كمقروء
router.put("/read-all", markAllAsRead);

// حذف إشعار
router.delete("/:id", deleteNotification);

export default router;
