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
  minCashbackToUse: { type: Number, default: 10000 }
});
export const Settings = mongoose.model("Settings", SettingsSchema);

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
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { carId, companyId, startDate, endDate, pickupLocation, dropoffLocation, insurance, adId, useWallet } = req.body;

    const car = await Car.findById(carId).session(session);
    if (!car || car.isSuspended || !car.isAvailable) {
      throw new AppError("السيارة غير متاحة حالياً", 400);
    }

    const company = await Company.findById(companyId).session(session);
    if (!company) {
      throw new AppError("الشركة غير موجودة", 404);
    }

    const User = mongoose.model("User");
    const user = await User.findById(req.user.id).session(session);

    const finalPickupLocation = pickupLocation || company.address || `${company.city}, ${company.country}`;
    const finalDropoffLocation = dropoffLocation || finalPickupLocation;

    const start = new Date(startDate);
    const end = new Date(endDate);
    const totalDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    if (totalDays <= 0) throw new AppError("التواريخ غير صحيحة", 400);

    let pricePerDay = car.pricePerDay;
    let initialTotalPrice = pricePerDay * totalDays;
    let discountAmount = 0;

    if (adId) {
      const ad = await Ad.findById(adId).session(session);
      if (ad && ad.isActive && ad.carIds.some(id => id.toString() === carId.toString())) {
        if (ad.discountPercentage > 0) {
          discountAmount = initialTotalPrice * (ad.discountPercentage / 100);
          initialTotalPrice -= discountAmount;
        }
      }
    }

    const insurancePrice = insurance ? car.pricePerDay * 0.1 * totalDays : 0;
    let finalTotalPrice = initialTotalPrice + insurancePrice;

    const settings = await Settings.findOne().session(session).lean();
    const depositPerc = settings?.depositPercentage || 0.3;
    let depositAmount = Math.round(finalTotalPrice * depositPerc);
    
    let walletDiscount = 0;
    let depositStatus = "pending";
    let depositPaidAt = null;
    let paymentStatus = "pending";

    if (useWallet && user.walletBalance >= (settings?.minCashbackToUse || 10000)) {
        if (user.walletBalance >= depositAmount) {
            walletDiscount = depositAmount;
            const remainingWallet = user.walletBalance - depositAmount;
            depositStatus = "paid";
            depositPaidAt = new Date();
            paymentStatus = "partial";
            await User.findByIdAndUpdate(user._id, { walletBalance: remainingWallet }, { session });
        } else {
            walletDiscount = user.walletBalance;
            depositAmount -= walletDiscount;
            await User.findByIdAndUpdate(user._id, { walletBalance: 0 }, { session });
        }
    }

    const confirmationCode = `BK${Date.now()}`;

    const [booking] = await Booking.create([{
      userId: req.user.id,
      carId,
      companyId,
      startDate: start,
      endDate: end,
      totalDays,
      pricePerDay,
      totalPrice: finalTotalPrice,
      deposit: depositAmount,
      depositStatus,
      depositPaidAt,
      insurance,
      insurancePrice,
      pickupLocation: finalPickupLocation,
      dropoffLocation: finalDropoffLocation,
      confirmationCode,
      status: "pending",
      paymentStatus,
      walletDiscount
    }], { session });

    await Car.findByIdAndUpdate(carId, { $inc: { totalBookings: 1 } }, { session });

    await session.commitTransaction();

    sendNotification({ 
      userId: req.user.id, 
      title: "تم إنشاء الحجز", 
      message: `تم إنشاء حجزك رقم ${confirmationCode}. المبلغ الإجمالي: ${finalTotalPrice}. العربون: ${depositAmount}`, 
      type: "booking_created", 
      relatedBooking: booking._id 
    });

    res.status(201).json({ 
      success: true, 
      booking,
      discountAmount,
      walletDiscount,
      depositInfo: {
        depositAmount,
        depositStatus,
        remainingAfterDeposit: finalTotalPrice - (walletDiscount + (depositStatus === "paid" ? 0 : depositAmount))
      }
    });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
});

export const confirmDeposit = catchAsync(async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const booking = await Booking.findById(req.params.id).session(session);
    if (!booking) throw new AppError("الحجز غير موجود", 404);
    if (booking.depositStatus === "paid") throw new AppError("العربون مدفوع مسبقاً", 400);
    if (booking.status === "cancelled") throw new AppError("لا يمكن دفع العربون لحجز ملغي", 400);

    booking.depositStatus = "paid";
    booking.depositPaidAt = new Date();
    booking.paymentStatus = "partial";
    await booking.save({ session });

    await session.commitTransaction();

    const updatedBooking = await Booking.findById(booking._id)
      .populate("carId", "brand model licensePlate color year images")
      .populate("companyId", "name phone address city logo workingHours")
      .populate("userId", "name phone")
      .lean();

    sendNotification({ 
      userId: booking.userId, 
      title: "تم تأكيد دفع العربون", 
      message: `تم تأكيد دفع العربون بمبلغ ${booking.deposit} لحجزك رقم ${booking.confirmationCode}.`, 
      type: "deposit_confirmed", 
      relatedBooking: booking._id 
    });

    res.status(200).json({ 
      success: true,
      booking: updatedBooking
    });
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
    if (!booking || booking.status !== "pending") throw new AppError("لا يمكن تأكيد هذا الحجز", 400);
    if (booking.depositStatus !== "paid") throw new AppError("يجب دفع العربون أولاً قبل تأكيد الحجز", 400);

    booking.status = "confirmed";
    await booking.save({ session });
    await Car.findByIdAndUpdate(booking.carId, { isAvailable: false }, { session });
    
    await session.commitTransaction();

    sendNotification({ 
      userId: booking.userId, 
      title: "تم تأكيد الحجز", 
      message: `تم تأكيد حجزك رقم ${booking.confirmationCode} بنجاح.`, 
      type: "booking_confirmed", 
      relatedBooking: booking._id 
    });

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
    filter,
    page,
    limit,
    populateOptions: [
      { path: "userId", select: "name phone" },
      { path: "carId", select: "brand model licensePlate" },
      { path: "companyId", select: "name phone address city logo" }
    ]
  });

  if (role === "user") result.bookings = result.bookings.map(hideCompanyIfDepositNotPaid);

  res.status(200).json({ success: true, ...result });
});

export const getBooking = catchAsync(async (req, res, next) => {
  let booking = await Booking.findById(req.params.id)
    .populate("userId", "name phone")
    .populate("carId", "brand model licensePlate pricePerDay images")
    .populate("companyId", "name phone address city logo workingHours")
    .lean();
  if (!booking) return next(new AppError("الحجز غير موجود", 404));
  if (req.user.role === "user") booking = hideCompanyIfDepositNotPaid(booking);
  res.status(200).json({ success: true, booking });
});

export const getBookingDetails = catchAsync(async (req, res, next) => {
  let booking = await Booking.findById(req.params.id)
    .populate("userId", "name phone address")
    .populate("carId", "brand model licensePlate color year seats images")
    .populate("companyId", "name phone address city logo workingHours socialMedia")
    .lean();
  if (!booking) return next(new AppError("تفاصيل الحجز غير موجودة", 404));
  if (req.user.role === "user") booking = hideCompanyIfDepositNotPaid(booking);
  res.status(200).json({ success: true, booking });
});

export const completeBooking = catchAsync(async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { rating, review } = req.body;
    const booking = await Booking.findById(req.params.id).session(session);
    if (!booking) throw new AppError("الحجز غير موجود", 404);
    if (booking.status === "completed") throw new AppError("الحجز مكتمل مسبقاً", 400);

    booking.status = "completed";
    booking.paymentStatus = "completed";
    booking.depositStatus = "paid";
    if (rating) booking.rating = rating;
    if (review) booking.review = review;
    booking.reviewedAt = Date.now();
    await booking.save({ session });

    const settings = await Settings.findOne().session(session).lean();
    const cashbackPerc = settings?.cashbackPercentage || 0.05;
    const cashbackAmount = Math.round(booking.totalPrice * cashbackPerc);

    await mongoose.model("User").findByIdAndUpdate(
      booking.userId,
      { $inc: { walletBalance: cashbackAmount } },
      { session }
    );

    await Car.findByIdAndUpdate(booking.carId, { isAvailable: true }, { session });
    
    await session.commitTransaction();

    res.status(200).json({ success: true, message: "تم إتمام الحجز وإضافة الكاش باك", cashbackAmount });
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
    if (!booking) throw new AppError("الحجز غير موجود", 404);
    if (booking.depositStatus !== "paid") throw new AppError("يجب دفع العربون أولاً", 400);
    if (booking.paymentStatus === "completed") throw new AppError("الحجز مدفوع بالكامل مسبقاً", 400);

    const User = mongoose.model("User");
    const user = await User.findById(booking.userId).session(session);
    const settings = await Settings.findOne().session(session).lean();

    const alreadyPaid = (booking.deposit || 0) + (booking.walletDiscount || 0);
    let remainingBalance = booking.totalPrice - alreadyPaid;

    let walletUsedInPayment = 0;
    if (useWallet && user.walletBalance >= (settings?.minCashbackToUse || 10000)) {
      if (user.walletBalance >= remainingBalance) {
        walletUsedInPayment = remainingBalance;
        remainingBalance = 0;
      } else {
        walletUsedInPayment = user.walletBalance;
        remainingBalance -= walletUsedInPayment;
      }
      
      await User.findByIdAndUpdate(user._id, { $inc: { walletBalance: -walletUsedInPayment } }, { session });
      booking.walletDiscount = (booking.walletDiscount || 0) + walletUsedInPayment;
    }

    if (amountPaid < remainingBalance) {
      throw new AppError(`المبلغ المدفوع أقل من المتبقي. المتبقي المطلوب دفعه نقداً: ${remainingBalance}`, 400);
    }

    booking.paymentStatus = "completed";
    await booking.save({ session });
    
    await session.commitTransaction();

    res.status(200).json({ 
        success: true, 
        booking, 
        walletUsedInPayment, 
        cashPaid: amountPaid 
    });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
});

export const updateBooking = catchAsync(async (req, res, next) => {
  const booking = await Booking.findById(req.params.id);
  if (!booking || booking.status !== "pending") throw new AppError("لا يمكن التعديل الآن", 400);
  if (booking.depositStatus === "paid") throw new AppError("لا يمكن التعديل بعد دفع العربون", 400);

  Object.assign(booking, req.body);
  if (req.body.startDate || req.body.endDate) {
    const start = new Date(booking.startDate);
    const end = new Date(booking.endDate);
    booking.totalDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    const insurancePrice = booking.insurance ? (booking.pricePerDay * 0.1 * booking.totalDays) : 0;
    booking.totalPrice = (booking.pricePerDay * booking.totalDays) + insurancePrice;
    const settings = await Settings.findOne().lean();
    booking.deposit = Math.round(booking.totalPrice * (settings?.depositPercentage || 0.3));
  }

  await booking.save();
  res.status(200).json({ success: true, booking });
});

export const cancelBooking = catchAsync(async (req, res, next) => {
  const { reason } = req.body;
  const booking = await Booking.findById(req.params.id);
  if (!booking || booking.status === "cancelled") throw new AppError("الحجز ملغي مسبقاً", 400);

  if (booking.depositStatus === "paid") booking.depositStatus = "refunded";
  booking.status = "cancelled";
  booking.cancellationReason = reason || "ملغي بواسطة المستخدم";
  booking.cancelledAt = new Date();
  booking.cancelledBy = req.user.role;
  
  await booking.save();
  await Car.findByIdAndUpdate(booking.carId, { isAvailable: true });

  sendNotification({
    userId: booking.userId,
    title: "تم إلغاء الحجز",
    message: `تم إلغاء حجزك رقم ${booking.confirmationCode}.`,
    type: "booking_cancelled",
    relatedBooking: booking._id
  });

  res.status(200).json({ success: true });
});

export const getUserBookings = catchAsync(async (req, res, next) => {
  const { page = 1, limit = 10, status } = req.query;
  const result = await paginateAndPopulate({ 
    filter: { userId: req.user.id, ...(status && { status }) }, 
    page, 
    limit,
    populateOptions: [
      { path: "carId", select: "brand model images pricePerDay" }, 
      { path: "companyId", select: "name address city phone logo" }
    ] 
  });
  result.bookings = result.bookings.map(hideCompanyIfDepositNotPaid);
  res.status(200).json({ success: true, ...result });
});

export const getCompanyBookings = catchAsync(async (req, res, next) => {
  const { companyId } = req.params;
  const { page = 1, limit = 10, status } = req.query;
  const result = await paginateAndPopulate({ 
    filter: { companyId, ...(status && { status }) }, 
    page, 
    limit,
    populateOptions: [
      { path: "userId", select: "name phone" }, 
      { path: "carId", select: "brand model licensePlate" }
    ] 
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
  const updateData = {};
  if (cashbackPercentage !== undefined) updateData.cashbackPercentage = cashbackPercentage;
  if (minCashbackToUse !== undefined) updateData.minCashbackToUse = minCashbackToUse;

  const settings = await Settings.findOneAndUpdate({}, updateData, { upsert: true, new: true });
  res.status(200).json({ success: true, settings });
});

export const getCashbackSettings = catchAsync(async (req, res, next) => {
  const settings = await Settings.findOne().lean();
  res.status(200).json({
    success: true,
    cashbackPercentage: settings?.cashbackPercentage || 0.05,
    minCashbackToUse: settings?.minCashbackToUse || 10000
  });
});

export const injectWalletBalance = catchAsync(async (req, res, next) => {
  const { userId } = req.params;
  const { amount } = req.body;
  const User = mongoose.model("User");
  
  const user = await User.findByIdAndUpdate(
    userId,
    { $set: { walletBalance: amount || 10000 } },
    { new: true }
  );

  if (!user) {
    return next(new AppError("المستخدم غير موجود", 404));
  }

  res.status(200).json({
    success: true,
    message: `تم شحن محفظة المستخدم بنجاح بمبلغ ${amount || 10000}`,
    walletBalance: user.walletBalance
  });
});