import express from "express";
import { createReview, getCarReviews, getCompanyReviews, getMyReviews, deleteReview } from "../controllers/review.controller.js";
import { protect, restrictTo } from "../middleware/auth.middleware.js";
import { validate, createReviewSchema } from "../middleware/validation.js";

const router = express.Router();

// إنشاء تقييم (مستخدم فقط)
router.post("/", protect, restrictTo("user"), validate(createReviewSchema), createReview);

// جلب تقييمات سيارة
router.get("/car/:carId", getCarReviews);

// جلب تقييمات شركة
router.get("/company/:companyId", getCompanyReviews);

// جلب تقييماتي
router.get("/my-reviews", protect, getMyReviews);

// حذف تقييم
router.delete("/:id", protect, deleteReview);

export default router;
