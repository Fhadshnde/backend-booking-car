import mongoose from "mongoose";
import Booking from "../models/booking.model.js";
import Car from "../models/car.model.js";
import Company from "../models/company.model.js";
import Ad from "../models/ad.model.js";
import { sendNotification } from "./notification.controller.js";
import catchAsync from "../helpers/catchAsync.js";
import AppError from "../helpers/AppError.js";

const SettingsSchema = new mongoose.Schema({
  depositPercentage: { type: Number, default: 0.3 },
  cashbackPercentage: { type: Number, default: 0.05 },
  minCashbackToUse: { type: Number, default: 10000 },
  insurancePrice: { type: Number, default: 50000 }
});
export const Settings = mongoose.model("Settings", SettingsSchema);

const generateConfirmationCode = () => {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
};

const paginateAndPopulate = async ({ filter, page = 1, limit = 10, populateOptions = [] }) => {
  const pageNumber = Math.max(1, parseInt(page));
  const limitNumber = Math.max(1, parseInt(limit));
  const skip = (pageNumber - 1) * limitNumber;

  const [bookings, total] = await Promise.all([
    Booking.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNumber)
      .populate(populateOptions)
      .lean(),
    Booking.countDocuments(filter)
  ]);

  return { 
    bookings, 
    pagination: { 
      total, 
      page: pageNumber, 
      limit: limitNumber, 
      pages: Math.ceil(total / limitNumber) 
    } 
  };
};

const hideCompanyIfDepositNotPaid = (booking) => {
  if (!booking) return booking;
  const b = { ...booking };
  if (b.depositStatus !== "paid") {
    if (b.companyId && typeof b.companyId === "object") {
      b.companyId = {
        _id: b.companyId._id,
        name: b.companyId.name
      };
    }
    b.companyDetailsHidden = true;
    b.companyDetailsMessage = "سيتم إظهار تفاصيل الشركة بعد دفع العربون";
  } else {
    b.companyDetailsHidden = false;
  }
  return b;
};

export const createBooking = catchAsync(async (req, res, next) => {
  const { carId, startDate, endDate, insurance, useWallet, walletAmount, pickupLocation, dropoffLocation } = req.body;

  // 1. التأكد من أن السيارة موجودة ومتاحة
  const car = await Car.findById(carId);
  if (!car || !car.isAvailable || car.isSuspended) {
    return next(new AppError("السيارة غير متاحة حالياً", 400));
  }

  // 2. التحقق من تداخل التواريخ (هذا هو الجزء المفقود)
  const overlappingBooking = await Booking.findOne({
    carId,
    status: { $in: ["pending", "confirmed", "on_trip"] }, // التحقق من الحجز النشط فقط
    $or: [
      { startDate: { $lte: new Date(endDate) }, endDate: { $gte: new Date(startDate) } }
    ]
  });

  if (overlappingBooking) {
    return next(new AppError("عذراً، هذه السيارة محجوزة بالفعل في التواريخ المحددة", 400));
  }

  // 3. حساب عدد الأيام
  const start = new Date(startDate);
  const end = new Date(endDate);
  const totalDays = Math.ceil(Math.abs(end - start) / (1000 * 60 * 60 * 24)) || 1;

  // 4. جلب إعدادات العربون والتأمين
  const settings = await Settings.findOne().lean();
  const depositPercentage = settings?.depositPercentage || 0.3;
  const insurancePrice = insurance ? (settings?.insurancePrice || 50000) : 0;

  // 5. الحسابات المالية
  const basePrice = totalDays * car.pricePerDay;
  const totalPrice = basePrice + insurancePrice;
  const depositAmount = totalPrice * depositPercentage;
  
  let finalRemaining = totalPrice - depositAmount;
  let walletDiscount = 0;

  if (useWallet && walletAmount > 0) {
    walletDiscount = Math.min(walletAmount, req.user.walletBalance, depositAmount);
    // منطق خصم المحفظة هنا...
  }

  // 6. إنشاء الحجز
  const newBooking = await Booking.create({
    userId: req.user._id,
    carId,
    companyId: car.companyId,
    startDate,
    endDate,
    totalDays,
    pricePerDay: car.pricePerDay,
    basePrice,
    insurance,
    insurancePrice,
    totalPrice,
    deposit: depositAmount - walletDiscount,
    remainingAmount: finalRemaining,
    pickupLocation,
    dropoffLocation,
    confirmationCode: generateConfirmationCode()
  });

  res.status(201).json({
    success: true,
    booking: newBooking
  });
});


// جلب التواريخ المحجوزة لسيارة معينة
export const getReservedDates = catchAsync(async (req, res, next) => {
  const { carId } = req.params;

  // جلب الحجوزات المؤكدة أو التي هي قيد الرحلة أو التي تنتظر دفع العربون
  const bookings = await Booking.find({
    carId,
    status: { $in: ["confirmed", "on_trip", "pending"] },
    endDate: { $gte: new Date() } // الحجوزات المستقبلية فقط
  }).select("startDate endDate");

  // تحويل المواعيد إلى مصفوفة من الفترات
  const reservedDates = bookings.map(b => ({
    start: b.startDate,
    end: b.endDate
  }));

  res.status(200).json({
    success: true,
    reservedDates
  });
});


export const confirmDeposit = catchAsync(async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const booking = await Booking.findById(req.params.id).session(session);
    if (!booking) throw new AppError("الحجز غير موجود", 404);
    if (booking.depositStatus === "paid") throw new AppError("تم دفع العربون مسبقاً", 400);
    booking.depositStatus = "paid";
    booking.depositPaidAt = new Date();
    booking.paymentStatus = "partial";
    await booking.save({ session });
    await session.commitTransaction();
    const updatedBooking = await Booking.findById(booking._id).populate("carId companyId userId").lean();
    res.status(200).json({ success: true, booking: updatedBooking });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
});

export const confirmBooking = catchAsync(async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const booking = await Booking.findById(req.params.id).session(session);
    if (!booking || booking.status !== "pending") throw new AppError("لا يمكن تأكيد الحجز", 400);
    booking.status = "confirmed";
    await booking.save({ session });
    await Car.findByIdAndUpdate(booking.carId, { isAvailable: false }, { session });
    await session.commitTransaction();
    res.status(200).json({ success: true, booking });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
});

export const getBookings = catchAsync(async (req, res, next) => {
  const { page = 1, limit = 10, status } = req.query;
  let filter = {};
  if (status) filter.status = status;
  const role = req.user.role?.toLowerCase();
  if (role === "user") filter.userId = req.user._id;
  else if (role === "company") filter.companyId = req.user.companyId;
  const result = await paginateAndPopulate({
    filter, page, limit,
    populateOptions: ["userId", "carId", "companyId"]
  });
  if (role === "user") result.bookings = result.bookings.map(hideCompanyIfDepositNotPaid);
  res.status(200).json({ success: true, ...result });
});

export const getBooking = catchAsync(async (req, res, next) => {
  let booking = await Booking.findById(req.params.id).populate("userId carId companyId").lean();
  if (!booking) return next(new AppError("الحجز غير موجود", 404));
  if (req.user.role === "user") booking = hideCompanyIfDepositNotPaid(booking);
  res.status(200).json({ success: true, booking });
});

export const getBookingDetails = catchAsync(async (req, res, next) => {
  let booking = await Booking.findById(req.params.id).populate("userId carId companyId").lean();
  if (!booking) return next(new AppError("الحجز غير موجود", 404));
  if (req.user.role === "user") booking = hideCompanyIfDepositNotPaid(booking);
  res.status(200).json({ success: true, booking });
});

export const completeBooking = catchAsync(async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const booking = await Booking.findById(req.params.id).session(session);
    if (!booking) throw new AppError("الحجز غير موجود", 404);
    booking.status = "completed";
    booking.paymentStatus = "completed";
    await booking.save({ session });
    const settings = await Settings.findOne().session(session).lean();
    const cashbackPerc = settings?.cashbackPercentage || 0.05;
    const cashbackAmount = Math.round(booking.totalPrice * cashbackPerc);
    await mongoose.model("User").findByIdAndUpdate(booking.userId, { $inc: { walletBalance: cashbackAmount } }, { session });
    await Car.findByIdAndUpdate(booking.carId, { isAvailable: true }, { session });
    await session.commitTransaction();
    res.status(200).json({ success: true, cashbackAmount });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
});

export const completePayment = catchAsync(async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { bookingId, amountPaid, useWallet } = req.body;
    const booking = await Booking.findById(bookingId).session(session);
    const user = await mongoose.model("User").findById(booking.userId).session(session);
    const settings = await Settings.findOne().session(session).lean();
    const alreadyPaid = (booking.deposit || 0) + (booking.walletDiscount || 0);
    let remaining = booking.totalPrice - alreadyPaid;
    let walletUsed = 0;
    const currentBalance = Number(user.walletBalance) || 0;
    if (useWallet && currentBalance >= (settings?.minCashbackToUse || 10000)) {
      walletUsed = Math.min(remaining, currentBalance);
      await mongoose.model("User").findByIdAndUpdate(user._id, { $inc: { walletBalance: -walletUsed } }, { session });
      booking.walletDiscount = (booking.walletDiscount || 0) + walletUsed;
    }
    booking.paymentStatus = "completed";
    await booking.save({ session });
    await session.commitTransaction();
    res.status(200).json({ success: true, walletUsed, cashPaid: amountPaid });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
});

export const updateBooking = catchAsync(async (req, res, next) => {
  const booking = await Booking.findById(req.params.id);
  if (!booking) throw new AppError("الحجز غير موجود", 404);
  Object.assign(booking, req.body);
  await booking.save();
  res.status(200).json({ success: true, booking });
});

export const cancelBooking = catchAsync(async (req, res, next) => {
  const booking = await Booking.findById(req.params.id);
  if (!booking) throw new AppError("الحجز غير موجود", 404);
  booking.status = "cancelled";
  booking.cancelledAt = new Date();
  await booking.save();
  await Car.findByIdAndUpdate(booking.carId, { isAvailable: true });
  res.status(200).json({ success: true });
});

export const getUserBookings = catchAsync(async (req, res, next) => {
  const { page = 1, limit = 10, status } = req.query;
  const result = await paginateAndPopulate({ 
    filter: { userId: req.user.id, ...(status && { status }) }, 
    page, limit, populateOptions: ["carId", "companyId"] 
  });
  result.bookings = result.bookings.map(hideCompanyIfDepositNotPaid);
  res.status(200).json({ success: true, ...result });
});

export const getCompanyBookings = catchAsync(async (req, res, next) => {
  const { companyId } = req.params;
  const { page = 1, limit = 10, status } = req.query;
  const result = await paginateAndPopulate({ 
    filter: { companyId, ...(status && { status }) }, 
    page, limit, populateOptions: ["userId", "carId"] 
  });
  res.status(200).json({ success: true, ...result });
});

export const setGlobalDepositPercentage = catchAsync(async (req, res, next) => {
  const { depositPercentage } = req.body;
  const settings = await Settings.findOneAndUpdate({}, { depositPercentage }, { upsert: true, new: true });
  res.status(200).json({ success: true, settings });
});

export const getDepositPercentage = catchAsync(async (req, res, next) => {
  const settings = await Settings.findOne().lean();
  res.status(200).json({ success: true, depositPercentage: settings?.depositPercentage || 0.3 });
});

export const setCashbackSettings = catchAsync(async (req, res, next) => {
  const { cashbackPercentage, minCashbackToUse } = req.body;
  const settings = await Settings.findOneAndUpdate({}, { cashbackPercentage, minCashbackToUse }, { upsert: true, new: true });
  res.status(200).json({ success: true, settings });
});

export const getCashbackSettings = catchAsync(async (req, res, next) => {
  const settings = await Settings.findOne().lean();
  res.status(200).json({ success: true, cashbackPercentage: settings?.cashbackPercentage || 0.05, minCashbackToUse: settings?.minCashbackToUse || 10000 });
});

export const injectWalletBalance = catchAsync(async (req, res, next) => {
  const { userId } = req.params;
  const { amount } = req.body;

  const amountToAdd = Number(amount);
  if (isNaN(amountToAdd) || amountToAdd <= 0) {
    return next(new AppError("يرجى إدخال مبلغ صحيح", 400));
  }

  const user = await mongoose.model("User").findByIdAndUpdate(
    userId,
    { $inc: { walletBalance: amountToAdd } },
    { new: true, runValidators: true }
  );

  if (!user) {
    return next(new AppError("المستخدم غير موجود", 404));
  }

  res.status(200).json({
    success: true,
    message: "تم شحن المحفظة بنجاح",
    walletBalance: user.walletBalance,
    user
  });
});