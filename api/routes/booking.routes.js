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
  getReservedDates,
  processExpiredBookingsCashback,
  addManualCashbackAfterCompletion,
  updateBookingStatusAdmin
} from "../controllers/booking.controller.js";
import { protect, restrictTo } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/user/my-bookings", protect, restrictTo("user"), getUserBookings);
router.get("/company/:companyId", protect, restrictTo("company", "admin"), getCompanyBookings);
router.get("/reserved-dates/:carId", getReservedDates);
router.get("/", protect, getBookings);
router.get("/:id", protect, getBooking);
router.get("/:id/details", protect, getBookingDetails);
router.post("/", protect, restrictTo("user"), createBooking);
router.put("/:id", protect, restrictTo("user"), updateBooking);
router.delete("/:id", protect, restrictTo("user", "admin", "company"), cancelBooking);
router.put("/:id/confirm-deposit", protect, restrictTo("company", "admin"), confirmDeposit);
router.put("/:id/confirm", protect, restrictTo("company", "admin"), confirmBooking);
router.put("/:id/complete-payment", protect, completePayment);
router.put("/:id/complete", protect, restrictTo("company", "admin"), completeBooking);
router.patch("/:id/status", protect, restrictTo("company", "admin"), updateBookingStatusAdmin);
router.get("/process-expired-cashback", protect, restrictTo("admin"), processExpiredBookingsCashback);
router.put("/:id/add-cashback-after-completion", protect, restrictTo("company", "admin"), addManualCashbackAfterCompletion);

export default router;