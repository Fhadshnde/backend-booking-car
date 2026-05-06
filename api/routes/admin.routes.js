import express from "express";
import { 
  getAdminDashboard, 
  getUsers,
  getUser,
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
  rejectKyc,
  approveKycByPhone,
  manualWalletTransaction,
  createCompany,
  updateCompany,
  deleteCompany,
  updateUser,
  getCarsAdmin,
  updateKycStatus
} from "../controllers/admin.controller.js";
import { protect, restrictTo } from "../middleware/auth.middleware.js";
import { uploadSingleImage } from "../middleware/upload.js";

const router = express.Router();

router.use(protect, restrictTo("admin"));

router.get("/dashboard", getAdminDashboard);

router.get("/users", getUsers);
router.get("/users/:id", getUser);
router.put("/users/:userId/toggle-status", toggleUserStatus);
router.put("/users/:userId/manual-wallet", manualWalletTransaction);
router.put("/users/:id", updateUser);

router.get("/companies/pending", getPendingCompanies);
router.post("/companies", uploadSingleImage, createCompany);
router.put("/companies/:id", uploadSingleImage, updateCompany);
router.delete("/companies/:id", deleteCompany);
router.put("/companies/:companyId/approve", approveCompany);
router.put("/companies/:companyId/reject", rejectCompany);

router.delete("/bookings/:bookingId/cancel", cancelBookingAdmin);
router.get("/reports/bookings", getBookingReports);
router.get("/cars", getCarsAdmin);
router.put("/cars/:carId/suspend", suspendCar);
router.put("/cars/:carId/unsuspend", unsuspendCar);

router.get("/complaints", getComplaints);
router.put("/complaints/:complaintId/respond", respondToComplaint);

router.put("/bookings/:bookingId/refund/approve", approveRefund);
router.put("/bookings/:bookingId/refund/reject", rejectRefund);

// KYC Management
router.get("/kyc/pending", getPendingKyc);
router.get("/users/kyc/pending", getPendingKyc);
router.put("/kyc/:userId/approve", approveKyc);
router.put("/kyc/:userId/reject", rejectKyc);
router.put("/users/:userId/kyc", updateKycStatus);
router.put("/kyc/phone/:phone/approve", approveKycByPhone);

export default router;