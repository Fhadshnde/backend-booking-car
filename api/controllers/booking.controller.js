import mongoose from "mongoose";
import Booking from "../models/booking.model.js";
import Car from "../models/car.model.js";
import Ad from "../models/ad.model.js";
import { sendNotification } from "./notification.controller.js";
import catchAsync from "../helpers/catchAsync.js";
import AppError from "../helpers/AppError.js";

const SettingsSchema = new mongoose.Schema({
  depositPercentage: { type: Number, default: 0.3 }
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

export const createBooking = catchAsync(async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { carId, companyId, startDate, endDate, pickupLocation, dropoffLocation, insurance, adId } = req.body;

    const car = await Car.findById(carId).session(session);
    if (!car || car.isSuspended || !car.isAvailable) {
      throw new AppError("Car is not available", 400);
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    const totalDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    if (totalDays <= 0) throw new AppError("Invalid dates", 400);

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
    const finalTotalPrice = initialTotalPrice + insurancePrice;

    const settings = await Settings.findOne().lean();
    const depositPerc = settings?.depositPercentage || 0.3;
    const depositAmount = finalTotalPrice * depositPerc;

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
      insurance,
      insurancePrice,
      pickupLocation,
      dropoffLocation,
      confirmationCode,
      status: "pending",
      paymentStatus: "pending"
    }], { session });

    await Car.findByIdAndUpdate(carId, { $inc: { totalBookings: 1 } }, { session });

    await session.commitTransaction();

    sendNotification({ 
      userId: req.user.id, 
      title: "تم إنشاء الحجز", 
      message: `تم إنشاء حجزك رقم ${confirmationCode} بنجاح. المبلغ الإجمالي: ${finalTotalPrice}`, 
      type: "booking_created", 
      relatedBooking: booking._id 
    });

    res.status(201).json({ success: true, booking, discountAmount });
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
  if (role === "user") {
    filter.userId = req.user._id;
  } else if (role === "company") {
    filter.companyId = req.user.companyId;
  }

  const result = await paginateAndPopulate({
    filter,
    page,
    limit,
    populateOptions: [
      { path: "userId", select: "name phone" },
      { path: "carId", select: "brand model licensePlate" },
      { path: "companyId", select: "name" }
    ]
  });
  res.status(200).json({ success: true, ...result });
});

export const getBooking = catchAsync(async (req, res, next) => {
  const booking = await Booking.findById(req.params.id)
    .populate("userId", "name phone")
    .populate("carId", "brand model licensePlate pricePerDay")
    .populate("companyId", "name phone address")
    .lean();
      
  if (!booking) return next(new AppError("Booking not found", 404));
  res.status(200).json({ success: true, booking });
});

export const getBookingDetails = catchAsync(async (req, res, next) => {
  const booking = await Booking.findById(req.params.id)
    .populate("userId", "name phone address")
    .populate("carId", "brand model licensePlate color year seats images")
    .populate("companyId", "name phone address logo")
    .lean();
      
  if (!booking) return next(new AppError("Booking details not found", 404));
  res.status(200).json({ success: true, booking });
});

export const confirmBooking = catchAsync(async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const booking = await Booking.findById(req.params.id).session(session);
    if (!booking || booking.status !== "pending") {
        throw new AppError("Booking cannot be confirmed", 400);
    }

    booking.status = "confirmed";
    booking.paymentStatus = "partial";
    booking.depositStatus = "paid";
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

export const completeBooking = catchAsync(async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { rating, review } = req.body;
    const booking = await Booking.findById(req.params.id).session(session);
    if (!booking) throw new AppError("Booking not found", 404);

    booking.status = "completed";
    booking.paymentStatus = "completed";
    booking.depositStatus = "paid";
    if (rating) booking.rating = rating;
    if (review) booking.review = review;
    booking.reviewedAt = Date.now();
    
    await booking.save({ session });
    await Car.findByIdAndUpdate(booking.carId, { isAvailable: true }, { session });
    
    await session.commitTransaction();

    res.status(200).json({ success: true, message: "Booking completed successfully" });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
});

export const completePayment = catchAsync(async (req, res, next) => {
  const { bookingId, amountPaid } = req.body;
  const booking = await Booking.findById(bookingId);
  
  if (!booking) return next(new AppError("Booking not found", 404));
  
  const remainingBalance = booking.totalPrice - booking.deposit;
  if (amountPaid < remainingBalance) {
    return next(new AppError("Amount is less than remaining balance", 400));
  }

  booking.paymentStatus = "completed";
  booking.status = "confirmed";
  await booking.save();

  res.status(200).json({ success: true, booking });
});

export const updateBooking = catchAsync(async (req, res, next) => {
  const booking = await Booking.findById(req.params.id);
  if (!booking || booking.status !== "pending") {
      throw new AppError("Cannot update booking in current status", 400);
  }

  Object.assign(booking, req.body);
  
  if (req.body.startDate || req.body.endDate) {
    const start = new Date(booking.startDate);
    const end = new Date(booking.endDate);
    booking.totalDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    
    const insurancePrice = booking.insurance ? (booking.pricePerDay * 0.1 * booking.totalDays) : 0;
    booking.totalPrice = (booking.pricePerDay * booking.totalDays) + insurancePrice;
    
    const settings = await Settings.findOne().lean();
    const depositPerc = settings?.depositPercentage || 0.3;
    booking.deposit = booking.totalPrice * depositPerc;
  }

  await booking.save();
  res.status(200).json({ success: true, booking });
});

export const cancelBooking = catchAsync(async (req, res, next) => {
  const { reason } = req.body;
  const booking = await Booking.findById(req.params.id);
  
  if (!booking || booking.status === "cancelled") {
      throw new AppError("Booking already cancelled or not found", 400);
  }

  booking.status = "cancelled";
  booking.cancellationReason = reason || "Cancelled by user";
  booking.cancelledAt = new Date();
  booking.cancelledBy = req.user.role;
  
  await booking.save();
  await Car.findByIdAndUpdate(booking.carId, { isAvailable: true });

  res.status(200).json({ success: true, message: "Booking cancelled successfully" });
});

export const getUserBookings = catchAsync(async (req, res, next) => {
  const { page = 1, limit = 10, status } = req.query;
  const result = await paginateAndPopulate({ 
    filter: { userId: req.user.id, ...(status && { status }) }, 
    page, 
    limit,
    populateOptions: [
      { path: "carId", select: "brand model images pricePerDay" }, 
      { path: "companyId", select: "name address" }
    ] 
  });
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
  if (depositPercentage === undefined) return next(new AppError("depositPercentage required", 400));
  
  const settings = await Settings.findOneAndUpdate(
    {}, 
    { depositPercentage }, 
    { upsert: true, new: true }
  );
  
  res.status(200).json({ success: true, settings });
});