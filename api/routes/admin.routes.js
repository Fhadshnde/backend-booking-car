import express from "express";
import { 
  getAdminDashboard, 
  toggleUserStatus, 
  approveCompany, 
  rejectCompany, 
  getPendingCompanies, 
  cancelBookingAdmin, 
  getBookingReports, 
  suspendCar, 
  unsuspendCar, 
  getComplaints, 
  respondToComplaint,
  approveRefund,
  rejectRefund,
  getPendingKyc,
  approveKyc,
  rejectKyc
} from "../controllers/admin.controller.js";
import { protect, restrictTo } from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(protect, restrictTo("admin"));

router.get("/dashboard", getAdminDashboard);

router.put("/users/:userId/toggle-status", toggleUserStatus);

router.get("/companies/pending", getPendingCompanies);
router.put("/companies/:companyId/approve", approveCompany);
router.put("/companies/:companyId/reject", rejectCompany);

router.delete("/bookings/:bookingId/cancel", cancelBookingAdmin);
router.get("/reports/bookings", getBookingReports);

router.put("/cars/:carId/suspend", suspendCar);
router.put("/cars/:carId/unsuspend", unsuspendCar);

router.get("/complaints", getComplaints);
router.put("/complaints/:complaintId/respond", respondToComplaint);

router.put("/bookings/:bookingId/refund/approve", approveRefund);
router.put("/bookings/:bookingId/refund/reject", rejectRefund);

// KYC Management
router.get("/kyc/pending", getPendingKyc);
router.put("/kyc/:userId/approve", approveKyc);
router.put("/kyc/:userId/reject", rejectKyc);

export default router;