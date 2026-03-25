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
  confirmDeposit,
  completePayment,
  setGlobalDepositPercentage,
  getDepositPercentage
} from "../controllers/booking.controller.js";

import { protect, restrictTo } from "../middleware/auth.middleware.js";

const router = express.Router();

// ============= إعدادات العربون (Admin) =============
// تعديل نسبة العربون العالمية
router.post("/settings/deposit-percentage", protect, restrictTo("admin"), setGlobalDepositPercentage);
// جلب نسبة العربون الحالية
router.get("/settings/deposit-percentage", protect, getDepositPercentage);

// ============= حجوزات المستخدم =============
// GET الحجوزات الخاصة بالمستخدم الحالي
router.get("/user/my-bookings", protect, restrictTo("user"), getUserBookings);

// ============= حجوزات الشركة =============
// GET الحجوزات الخاصة بشركة محددة (company أو admin)
router.get("/company/:companyId", protect, restrictTo("company", "admin"), getCompanyBookings);

// ============= عمليات الحجز الأساسية =============
// GET كل الحجوزات حسب الدور (admin=كلها, company=شركته, user=حجوزاته)
router.get("/", protect, getBookings);

// إنشاء حجز (فقط المستخدمين)
router.post("/", protect, restrictTo("user"), createBooking);

// GET حجز محدد
router.get("/:id", protect, getBooking);

// GET تفاصيل حجز محدد
router.get("/:id/details", protect, getBookingDetails);

// تعديل حجز (فقط المستخدمين - قبل دفع العربون فقط)
router.put("/:id", protect, restrictTo("user"), updateBooking);

// إلغاء حجز (فقط المستخدمين)
router.delete("/:id", protect, restrictTo("user"), cancelBooking);

// ============= تدفق العربون والدفع =============
// تأكيد دفع العربون (المستخدم يدفع العربون → تظهر بيانات الشركة)
router.put("/:id/confirm-deposit", protect, restrictTo("user"), confirmDeposit);

// تأكيد الحجز (company أو admin - يشترط دفع العربون أولاً)
router.put("/:id/confirm", protect, restrictTo("company", "admin"), confirmBooking);

// إتمام الدفع الكامل (المبلغ المتبقي بعد العربون)
router.put("/:id/complete-payment", protect, completePayment);

// إتمام الحجز (company أو admin)
router.put("/:id/complete", protect, restrictTo("company", "admin"), completeBooking);

export default router;