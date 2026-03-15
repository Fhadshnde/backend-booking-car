import express from "express";
import {
  getBookings,
  getBooking,
  createBooking,
  updateBooking,
  cancelBooking,
  getUserBookings,
  getCompanyBookings,
  getBookingDetails,
  confirmBooking,
  completeBooking,
  setGlobalDepositPercentage
} from "../controllers/booking.controller.js";

import { protect, restrictTo } from "../middleware/auth.middleware.js";

const router = express.Router();

// GET كل الحجوزات حسب الدور (admin=كلها, company=شركته, user=حجوزاته)
router.get("/", protect, getBookings);

// GET حجز محدد
router.get("/:id", protect, getBooking);

// إنشاء حجز (فقط المستخدمين)
router.post("/", protect, restrictTo("user"), createBooking);

// تعديل حجز (فقط المستخدمين)
router.put("/:id", protect, restrictTo("user"), updateBooking);

// إلغاء حجز (فقط المستخدمين)
router.delete("/:id", protect, restrictTo("user"), cancelBooking);

// GET الحجوزات الخاصة بالمستخدم الحالي
router.get("/user/my-bookings", protect, restrictTo("user"), getUserBookings);

// GET تفاصيل حجز محدد
router.get("/:id/details", protect, getBookingDetails);

// GET الحجوزات الخاصة بشركة محددة (company أو admin)
router.get("/company/:companyId", protect, restrictTo("company", "admin"), getCompanyBookings);

// تأكيد حجز (company أو admin)
router.put("/:id/confirm", protect, restrictTo("company", "admin"), confirmBooking);

// إتمام حجز (company أو admin)
router.put("/:id/complete", protect, restrictTo("company", "admin"), completeBooking);

// إعداد نسبة العربون العالمية (admin فقط)
router.post("/settings/deposit-percentage", protect, restrictTo("admin"), setGlobalDepositPercentage);

export default router;