import mongoose from "mongoose";
import Booking from "../models/booking.model.js";
import Car from "../models/car.model.js";
import User from "../models/user.model.js";
import Settings from "../models/settings.model.js";
import catchAsync from "../helpers/catchAsync.js";
import AppError from "../helpers/AppError.js";

export const createBooking = catchAsync(async (req, res, next) => {
  const {
    carId,
    startDate,
    endDate,
    useInsurance,
    walletAmount,
    pickupLocation,
    dropoffLocation,
    driverLicense,
  } = req.body;

  const car = await Car.findById(carId);
  if (!car) {
    return next(new AppError("السيارة غير موجودة", 404));
  }

  if (!car.isAvailable || car.isSuspended) {
    return next(new AppError("السيارة غير متاحة للحجز حالياً", 400));
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (end <= start) {
    return next(new AppError("تاريخ الانتهاء يجب أن يكون بعد تاريخ البداية", 400));
  }

  const conflictingBookings = await Booking.find({
    carId,
    status: { $in: ["pending", "confirmed", "on_trip"] },
    $or: [
      { startDate: { $lt: end }, endDate: { $gt: start } },
    ],
  });

  if (conflictingBookings.length > 0) {
    return next(new AppError("السيارة غير متاحة في الفترة المحددة", 400));
  }

  const diffTime = end - start;
  const diffHours = diffTime / (1000 * 60 * 60);
  const totalDays = diffHours <= 24 ? 1 : Math.ceil(diffHours / 24);

  const basePrice = totalDays * car.pricePerDay;

  let insurancePrice = 0;
  if (useInsurance) {
    insurancePrice = car.insurancePrice || 50000;
  }

  let totalPrice = basePrice + insurancePrice;

  let walletDiscount = 0;
  if (walletAmount && walletAmount > 0) {
    const user = await User.findById(req.user.id);
    if (user.walletBalance >= walletAmount) {
      walletDiscount = walletAmount;
      totalPrice = Math.max(0, totalPrice - walletDiscount);
    }
  }

  const settings = await Settings.findOne().sort({ createdAt: -1 });
  const depositPercentage = settings ? settings.depositPercentage : 0.3;
  const depositAmount = totalPrice * depositPercentage;

  const generateConfirmationCode = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789";
    let code = "";
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  let confirmationCode = generateConfirmationCode();
  let isUnique = false;
  while (!isUnique) {
    const existing = await Booking.findOne({ confirmationCode });
    if (!existing) {
      isUnique = true;
    } else {
      confirmationCode = generateConfirmationCode();
    }
  }

  const booking = await Booking.create({
    userId: req.user.id,
    carId,
    companyId: car.companyId,
    startDate: start,
    endDate: end,
    totalDays,
    pricePerDay: car.pricePerDay,
    basePrice,
    insurance: useInsurance || false,
    insurancePrice: insurancePrice,
    totalPrice,
    deposit: depositAmount,
    depositStatus: "pending",
    walletDiscount,
    remainingAmount: totalPrice - depositAmount,
    status: "pending",
    paymentStatus: "pending",
    confirmationCode,
    pickupLocation: pickupLocation || "مكتب الشركة",
    dropoffLocation: dropoffLocation || "مكتب الشركة",
    driverLicense,
  });

  if (walletDiscount > 0) {
    await User.findByIdAndUpdate(req.user.id, {
      $inc: { walletBalance: -walletDiscount },
    });
  }

  const populatedBooking = await Booking.findById(booking._id)
    .populate("userId", "name email phone")
    .populate("carId", "brand model images licensePlate pricePerDay")
    .populate("companyId", "name address phone");

  res.status(201).json({
    success: true,
    booking: populatedBooking,
  });
});

export const getReservedDates = catchAsync(async (req, res, next) => {
  const { carId } = req.params;

  const bookings = await Booking.find({
    carId,
    status: { $in: ["pending", "confirmed", "on_trip"] },
  }).select("startDate endDate");

  const reservedDates = bookings.map((booking) => ({
    startDate: booking.startDate,
    endDate: booking.endDate,
  }));

  res.status(200).json({
    success: true,
    reservedDates,
  });
});

export const getUserBookings = catchAsync(async (req, res, next) => {
  const bookings = await Booking.find({ userId: req.user.id })
    .populate("carId", "brand model images licensePlate pricePerDay")
    .populate("companyId", "name address phone")
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    bookings,
  });
});

export const cancelBooking = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { reason } = req.body;

  const booking = await Booking.findById(id);
  if (!booking) {
    return next(new AppError("الحجز غير موجود", 404));
  }

  if (booking.userId.toString() !== req.user.id.toString()) {
    return next(new AppError("غير مصرح لك بتنفيذ هذا الإجراء", 403));
  }

  if (booking.status === "cancelled") {
    return next(new AppError("الحجز ملغي بالفعل", 400));
  }

  if (booking.status === "completed") {
    return next(new AppError("لا يمكن إلغاء حجز مكتمل", 400));
  }

  if (booking.depositStatus === "paid" && booking.status === "confirmed") {
    const settings = await Settings.findOne().sort({ createdAt: -1 });
    const refundPercentage = settings ? 0.5 : 0.5;
    const refundAmount = booking.deposit * refundPercentage;

    await User.findByIdAndUpdate(booking.userId, {
      $inc: { walletBalance: refundAmount },
    });
  }

  booking.status = "cancelled";
  booking.cancellationReason = reason;
  booking.cancelledAt = new Date();
  booking.cancelledBy = "user";

  await booking.save();

  res.status(200).json({
    success: true,
    booking,
  });
});

export const getBookingDetails = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const booking = await Booking.findById(id)
    .populate("userId", "name email phone avatar")
    .populate("carId", "brand model images licensePlate pricePerDay transmission fuelType seats")
    .populate("companyId", "name address phone email rating logo");

  if (!booking) {
    return next(new AppError("الحجز غير موجود", 404));
  }

  res.status(200).json({
    success: true,
    booking,
  });
});

export const getBookings = catchAsync(async (req, res, next) => {
  const { page = 1, limit = 10, status } = req.query;
  const filter = {};

  if (status) {
    filter.status = status;
  }

  if (req.user.role === "company") {
    filter.companyId = req.user.companyId;
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [bookings, total] = await Promise.all([
    Booking.find(filter)
      .skip(skip)
      .limit(parseInt(limit))
      .populate("userId", "name email")
      .populate("carId", "brand model images")
      .populate("companyId", "name")
      .sort({ createdAt: -1 }),
    Booking.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    bookings,
    pagination: {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(total / limit),
    },
  });
});

export const getBooking = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const booking = await Booking.findById(id)
    .populate("userId", "name email phone")
    .populate("carId", "brand model images licensePlate pricePerDay")
    .populate("companyId", "name address phone");

  if (!booking) {
    return next(new AppError("الحجز غير موجود", 404));
  }

  res.status(200).json({
    success: true,
    booking,
  });
});

export const updateBooking = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { startDate, endDate, pickupLocation, dropoffLocation } = req.body;

  const booking = await Booking.findById(id);
  if (!booking) {
    return next(new AppError("الحجز غير موجود", 404));
  }

  if (booking.userId.toString() !== req.user.id.toString()) {
    return next(new AppError("غير مصرح لك بتنفيذ هذا الإجراء", 403));
  }

  if (booking.status !== "pending") {
    return next(new AppError("لا يمكن تعديل الحجز بعد تأكيده", 400));
  }

  if (startDate) {
    booking.startDate = new Date(startDate);
  }
  if (endDate) {
    booking.endDate = new Date(endDate);
  }
  if (pickupLocation) {
    booking.pickupLocation = pickupLocation;
  }
  if (dropoffLocation) {
    booking.dropoffLocation = dropoffLocation;
  }

  const start = new Date(booking.startDate);
  const end = new Date(booking.endDate);
  const diffTime = end - start;
  const diffHours = diffTime / (1000 * 60 * 60);
  booking.totalDays = diffHours <= 24 ? 1 : Math.ceil(diffHours / 24);
  booking.basePrice = booking.totalDays * booking.pricePerDay;

  let totalPrice = booking.basePrice;
  if (booking.insurance) {
    totalPrice += booking.insurancePrice;
  }
  booking.totalPrice = totalPrice - booking.walletDiscount;

  const settings = await Settings.findOne().sort({ createdAt: -1 });
  const depositPercentage = settings ? settings.depositPercentage : 0.3;
  booking.deposit = booking.totalPrice * depositPercentage;
  booking.remainingAmount = booking.totalPrice - booking.deposit;

  await booking.save();

  res.status(200).json({
    success: true,
    booking,
  });
});

export const confirmBooking = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const booking = await Booking.findById(id);
  if (!booking) {
    return next(new AppError("الحجز غير موجود", 404));
  }

  if (req.user.role === "company" && booking.companyId.toString() !== req.user.companyId.toString()) {
    return next(new AppError("غير مصرح لك بتنفيذ هذا الإجراء", 403));
  }

  if (booking.status !== "pending") {
    return next(new AppError("لا يمكن تأكيد حجز غير معلق", 400));
  }

  booking.status = "confirmed";
  await booking.save();

  const populatedBooking = await Booking.findById(booking._id)
    .populate("userId", "name email phone")
    .populate("carId", "brand model images licensePlate")
    .populate("companyId", "name address phone");

  res.status(200).json({
    success: true,
    booking: populatedBooking,
  });
});

export const completeBooking = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const booking = await Booking.findById(id);
  if (!booking) {
    return next(new AppError("الحجز غير موجود", 404));
  }

  if (req.user.role === "company" && booking.companyId.toString() !== req.user.companyId.toString()) {
    return next(new AppError("غير مصرح لك بتنفيذ هذا الإجراء", 403));
  }

  if (booking.status !== "on_trip") {
    return next(new AppError("لا يمكن إكمال حجز غير قيد التنفيذ", 400));
  }

  booking.status = "completed";
  await booking.save();

  let cashbackAmount = 0;
  let cashbackPercentage = 0;

  if (!booking.cashbackAddedAfterCompletion) {
    const settings = await Settings.findOne().sort({ createdAt: -1 });
    cashbackPercentage = settings ? settings.cashbackAfterCompletionPercentage || 5 : 5;
    cashbackAmount = (booking.totalPrice * cashbackPercentage) / 100;

    if (cashbackAmount > 0) {
      await User.findByIdAndUpdate(booking.userId, {
        $inc: { walletBalance: cashbackAmount }
      });

      booking.cashbackAfterCompletion = cashbackAmount;
      booking.cashbackAfterCompletionPercentage = cashbackPercentage;
      booking.cashbackAddedAfterCompletion = true;
      booking.cashbackAfterCompletionAddedAt = new Date();
      booking.cashbackAfterCompletionAddedBy = req.user.id;
      await booking.save();
    }
  }

  const populatedBooking = await Booking.findById(booking._id)
    .populate("userId", "name email phone")
    .populate("carId", "brand model images licensePlate")
    .populate("companyId", "name address phone");

  res.status(200).json({
    success: true,
    booking: populatedBooking,
    cashbackAdded: cashbackAmount > 0,
    cashbackAmount,
    cashbackPercentage,
  });
});

export const getCompanyBookings = catchAsync(async (req, res, next) => {
  const { companyId } = req.params;
  const { page = 1, limit = 10, status } = req.query;

  if (req.user.role === "company" && req.user.companyId.toString() !== companyId) {
    return next(new AppError("غير مصرح لك بتنفيذ هذا الإجراء", 403));
  }

  const filter = { companyId };
  if (status) {
    filter.status = status;
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [bookings, total] = await Promise.all([
    Booking.find(filter)
      .skip(skip)
      .limit(parseInt(limit))
      .populate("userId", "name email phone")
      .populate("carId", "brand model images licensePlate")
      .sort({ createdAt: -1 }),
    Booking.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    bookings,
    pagination: {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(total / limit),
    },
  });
});

export const confirmDeposit = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { paymentIntentId } = req.body;

  const booking = await Booking.findById(id);
  if (!booking) {
    return next(new AppError("الحجز غير موجود", 404));
  }

  if (booking.userId.toString() !== req.user.id.toString()) {
    return next(new AppError("غير مصرح لك بتنفيذ هذا الإجراء", 403));
  }

  if (booking.depositStatus === "paid") {
    return next(new AppError("تم دفع العربون مسبقاً", 400));
  }

  booking.depositStatus = "paid";
  booking.depositPaidAt = new Date();
  booking.status = "confirmed";
  booking.paymentStatus = "partial";
  booking.transactionId = paymentIntentId;

  await booking.save();

  const populatedBooking = await Booking.findById(booking._id)
    .populate("userId", "name email phone")
    .populate("carId", "brand model images licensePlate")
    .populate("companyId", "name address phone");

  res.status(200).json({
    success: true,
    booking: populatedBooking,
  });
});

export const completePayment = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { paymentIntentId } = req.body;

  const booking = await Booking.findById(id);
  if (!booking) {
    return next(new AppError("الحجز غير موجود", 404));
  }

  if (booking.userId.toString() !== req.user.id.toString()) {
    return next(new AppError("غير مصرح لك بتنفيذ هذا الإجراء", 403));
  }

  if (booking.paymentStatus === "completed") {
    return next(new AppError("تم دفع المبلغ كاملاً مسبقاً", 400));
  }

  booking.paymentStatus = "completed";
  booking.depositStatus = "paid";
  booking.depositPaidAt = new Date();
  booking.transactionId = paymentIntentId;

  await booking.save();

  const populatedBooking = await Booking.findById(booking._id)
    .populate("userId", "name email phone")
    .populate("carId", "brand model images licensePlate")
    .populate("companyId", "name address phone");

  res.status(200).json({
    success: true,
    booking: populatedBooking,
  });
});

export const injectWalletBalance = catchAsync(async (req, res, next) => {
  const { userId } = req.params;
  const { amount } = req.body;

  const user = await User.findByIdAndUpdate(
    userId,
    { $inc: { walletBalance: amount } },
    { new: true }
  );

  if (!user) {
    return next(new AppError("المستخدم غير موجود", 404));
  }

  res.status(200).json({
    success: true,
    walletBalance: user.walletBalance,
  });
});

export const processExpiredBookingsCashback = catchAsync(async (req, res, next) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expiredBookings = await Booking.find({
    endDate: { $lt: today },
    status: "confirmed",
    cashbackAddedAfterExpiry: { $ne: true },
  });

  let totalCashbackAdded = 0;
  const results = [];

  for (const booking of expiredBookings) {
    const settings = await Settings.findOne().sort({ createdAt: -1 });
    const cashbackPercentage = settings ? settings.cashbackAfterExpiryPercentage || 3 : 3;
    const cashbackAmount = (booking.totalPrice * cashbackPercentage) / 100;

    if (cashbackAmount > 0) {
      await User.findByIdAndUpdate(booking.userId, {
        $inc: { walletBalance: cashbackAmount }
      });

      booking.cashbackAfterExpiry = cashbackAmount;
      booking.cashbackAfterExpiryPercentage = cashbackPercentage;
      booking.cashbackAddedAfterExpiry = true;
      booking.cashbackAfterExpiryAddedAt = new Date();
      await booking.save();

      totalCashbackAdded += cashbackAmount;
      results.push({
        bookingId: booking._id,
        userId: booking.userId,
        cashbackAmount,
        cashbackPercentage,
      });
    }
  }

  res.status(200).json({
    success: true,
    processedCount: expiredBookings.length,
    totalCashbackAdded,
    results,
  });
});

export const addManualCashbackAfterCompletion = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { cashbackPercentage } = req.body;

  const booking = await Booking.findById(id);
  if (!booking) {
    return next(new AppError("الحجز غير موجود", 404));
  }

  if (req.user.role === "company" && booking.companyId.toString() !== req.user.companyId.toString()) {
    return next(new AppError("غير مصرح لك بتنفيذ هذا الإجراء", 403));
  }

  if (booking.status !== "completed") {
    return next(new AppError("لا يمكن إضافة كاش باك إلا للحجوزات المكتملة", 400));
  }

  if (booking.cashbackAddedAfterCompletion) {
    return next(new AppError("تم إضافة كاش باك لهذا الحجز مسبقاً", 400));
  }

  const settings = await Settings.findOne().sort({ createdAt: -1 });
  const defaultCashbackPercentage = settings ? settings.cashbackAfterCompletionPercentage || 5 : 5;
  const finalCashbackPercentage = cashbackPercentage || defaultCashbackPercentage;
  const cashbackAmount = (booking.totalPrice * finalCashbackPercentage) / 100;

  await User.findByIdAndUpdate(booking.userId, {
    $inc: { walletBalance: cashbackAmount }
  });

  booking.cashbackAfterCompletion = cashbackAmount;
  booking.cashbackAfterCompletionPercentage = finalCashbackPercentage;
  booking.cashbackAddedAfterCompletion = true;
  booking.cashbackAfterCompletionAddedAt = new Date();
  booking.cashbackAfterCompletionAddedBy = req.user.id;

  await booking.save();

  const populatedBooking = await Booking.findById(booking._id)
    .populate("userId", "name email phone")
    .populate("carId", "brand model images licensePlate")
    .populate("companyId", "name address phone");

  res.status(200).json({
    success: true,
    booking: populatedBooking,
    cashbackAmount,
    cashbackPercentage: finalCashbackPercentage,
  });
});