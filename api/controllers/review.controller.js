import Review from "../models/review.model.js";
import Booking from "../models/booking.model.js";
import catchAsync from "../helpers/catchAsync.js";
import AppError from "../helpers/AppError.js";

// إنشاء تقييم جديد
export const createReview = catchAsync(async (req, res, next) => {
  const { bookingId, rating, comment } = req.body;

  // التحقق من أن الحجز موجود ومكتمل
  const booking = await Booking.findById(bookingId);
  if (!booking) {
    return next(new AppError("الحجز غير موجود", 404));
  }

  if (booking.status !== "completed") {
    return next(new AppError("لا يمكن تقييم حجز غير مكتمل", 400));
  }

  // التحقق من أن المستخدم هو صاحب الحجز
  if (booking.userId.toString() !== req.user._id.toString()) {
    return next(new AppError("لا يمكنك تقييم حجز ليس لك", 403));
  }

  // التحقق من عدم وجود تقييم سابق
  const existingReview = await Review.findOne({ booking: bookingId });
  if (existingReview) {
    return next(new AppError("تم تقييم هذا الحجز مسبقاً", 400));
  }

  const review = await Review.create({
    user: req.user._id,
    car: booking.carId,
    company: booking.companyId,
    booking: bookingId,
    rating,
    comment
  });

  res.status(201).json({
    success: true,
    message: "تم إنشاء التقييم بنجاح",
    review
  });
});

// جلب تقييمات سيارة معينة
export const getCarReviews = catchAsync(async (req, res) => {
  const { carId } = req.params;
  const { page = 1, limit = 10 } = req.query;
  const skip = (page - 1) * limit;

  const reviews = await Review.find({ car: carId })
    .skip(skip)
    .limit(parseInt(limit))
    .populate("user", "name")
    .sort({ createdAt: -1 });

  const total = await Review.countDocuments({ car: carId });

  res.status(200).json({
    success: true,
    reviews,
    pagination: {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(total / limit)
    }
  });
});

// جلب تقييمات شركة معينة
import { paginate } from "../helpers/pagination.helper.js";

export const getCompanyReviews = catchAsync(async (req, res) => {
  const { companyId } = req.params;
  const { page, limit } = req.query;

  const result = await paginate(Review, { company: companyId }, {
    page,
    limit,
    populate: [
      { path: "user", select: "name" },
      { path: "car", select: "brand model" }
    ]
  });

  res.status(200).json({
    success: true,
    ...result
  });
});

// جلب تقييمات المستخدم الحالي
export const getMyReviews = catchAsync(async (req, res) => {
  const reviews = await Review.find({ user: req.user._id })
    .populate("car", "brand model images")
    .populate("company", "name")
    .sort({ createdAt: -1 });

  res.status(200).json({ success: true, reviews });
});

// حذف تقييم
export const deleteReview = catchAsync(async (req, res, next) => {
  const review = await Review.findById(req.params.id);

  if (!review) {
    return next(new AppError("التقييم غير موجود", 404));
  }

  // فقط صاحب التقييم أو الأدمن يقدر يحذف
  if (review.user.toString() !== req.user._id.toString() && req.user.role !== "admin") {
    return next(new AppError("لا يمكنك حذف هذا التقييم", 403));
  }

  await Review.findByIdAndDelete(req.params.id);

  res.status(200).json({
    success: true,
    message: "تم حذف التقييم بنجاح"
  });
});
