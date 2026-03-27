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
  getDepositPercentage,
  setCashbackSettings,
  getCashbackSettings,
  injectWalletBalance,getReservedDates
} from "../controllers/booking.controller.js";

import { protect, restrictTo } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/settings/deposit-percentage", protect, restrictTo("admin"), setGlobalDepositPercentage);
router.get("/settings/deposit-percentage", protect, getDepositPercentage);

router.post("/settings/cashback", protect, restrictTo("admin"), setCashbackSettings);
router.get("/settings/cashback", protect, getCashbackSettings);

router.post("/admin/inject-wallet/:userId", protect, restrictTo("admin"), injectWalletBalance);

router.get("/user/my-bookings", protect, restrictTo("user"), getUserBookings);

router.get("/company/:companyId", protect, restrictTo("company", "admin"), getCompanyBookings);
router.get("/reserved-dates/:carId", getReservedDates);

router.get("/", protect, getBookings);
router.post("/", protect, restrictTo("user"), createBooking);
router.get("/:id", protect, getBooking);
router.get("/:id/details", protect, getBookingDetails);
router.put("/:id", protect, restrictTo("user"), updateBooking);
router.delete("/:id", protect, restrictTo("user"), cancelBooking);

router.put("/:id/confirm-deposit", protect, restrictTo("user"), confirmDeposit);
router.put("/:id/confirm", protect, restrictTo("company", "admin"), confirmBooking);
router.put("/:id/complete-payment", protect, completePayment);
router.put("/:id/complete", protect, restrictTo("company", "admin"), completeBooking);

export default router;