import express from "express";
import { getUserProfile, updateUserProfile, getUsers, getUser, updateUser, deleteUser, uploadKycDocs, updateKycStatus, requestTopUpWallet, getMyTopUpRequests, getAllTopUpRequests, approveTopUpWallet } from "../controllers/user.controller.js";
import { protect, restrictTo } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/profile", protect, getUserProfile);
router.put("/profile", protect, updateUserProfile);
router.put("/fcm-token", protect, (req, res, next) => {
  // We'll import this controller function next
  import("../controllers/user.controller.js").then(m => m.updateFcmToken(req, res)).catch(next);
});

router.post("/kyc", protect, uploadKycDocs);
router.put("/kyc/:id/status", protect, restrictTo("admin"), updateKycStatus);
router.post("/wallet/topup", protect, requestTopUpWallet);
router.get("/wallet/requests", protect, getMyTopUpRequests);
router.get("/admin/wallet/requests", protect, restrictTo("admin"), getAllTopUpRequests);
router.put("/admin/wallet/requests/:id", protect, restrictTo("admin"), approveTopUpWallet);

router.get("/", protect, restrictTo("admin"), getUsers);
router.get("/:id", protect, restrictTo("admin"), getUser);
router.put("/:id", protect, restrictTo("admin"), updateUser);
router.delete("/:id", protect, restrictTo("admin"), deleteUser);

export default router;