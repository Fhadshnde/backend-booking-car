import mongoose from "mongoose";
import Booking from "../models/booking.model.js";
import catchAsync from "../helpers/catchAsync.js";
import AppError from "../helpers/AppError.js";

const generateFakePaymentId = () => {
  return `pay_${Math.random().toString(36).substr(2, 12)}`;
};

const generateFakeTransactionId = () => {
  return `txn_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
};

export const createPaymentIntent = catchAsync(async (req, res, next) => {
  const { bookingId, paymentType } = req.body;

  const booking = await Booking.findById(bookingId)
    .populate("carId", "brand model images licensePlate pricePerDay transmission fuelType seats color year")
    .populate("companyId", "name logo address phone email rating")
    .populate("userId", "name email phone");

  if (!booking) {
    return next(new AppError("الحجز غير موجود", 404));
  }

  if (booking.userId._id.toString() !== req.user.id.toString()) {
    return next(new AppError("غير مصرح لك بتنفيذ هذا الإجراء", 403));
  }

  let amount = 0;
  let paymentFor = "";
  let description = "";

  if (paymentType === "deposit") {
    if (booking.depositStatus === "paid") {
      return next(new AppError("تم دفع العربون مسبقاً", 400));
    }
    amount = booking.deposit;
    paymentFor = "deposit";
    description = `دفع عربون حجز السيارة ${booking.carId.brand} ${booking.carId.model}`;
  } else if (paymentType === "remaining") {
    if (booking.paymentStatus === "completed") {
      return next(new AppError("تم دفع المبلغ كاملاً مسبقاً", 400));
    }
    amount = booking.remainingAmount;
    paymentFor = "remaining";
    description = `دفع المبلغ المتبقي لحجز السيارة ${booking.carId.brand} ${booking.carId.model}`;
  } else if (paymentType === "full") {
    if (booking.paymentStatus === "completed") {
      return next(new AppError("تم دفع المبلغ كاملاً مسبقاً", 400));
    }
    amount = booking.totalPrice;
    paymentFor = "full";
    description = `دفع كامل المبلغ لحجز السيارة ${booking.carId.brand} ${booking.carId.model}`;
  } else {
    return next(new AppError("نوع الدفع غير صحيح", 400));
  }

  if (amount <= 0) {
    return next(new AppError("المبلغ المطلوب دفعه غير صحيح", 400));
  }

  const paymentIntentId = generateFakePaymentId();
  const clientSecret = `secret_${paymentIntentId}_${Date.now()}`;

  const depositPercentageNumber = booking.depositPercentage ? booking.depositPercentage * 100 : 30;

  res.status(200).json({
    success: true,
    clientSecret,
    paymentIntentId,
    amount,
    currency: "iqd",
    bookingId: booking._id,
    paymentType,
    description,
    bookingDetails: {
      carId: booking.carId._id,
      carName: `${booking.carId.brand} ${booking.carId.model}`,
      carBrand: booking.carId.brand,
      carModel: booking.carId.model,
      carImages: booking.carId.images || [],
      carPricePerDay: booking.carId.pricePerDay,
      carTransmission: booking.carId.transmission,
      carFuelType: booking.carId.fuelType,
      carSeats: booking.carId.seats,
      carYear: booking.carId.year,
      companyId: booking.companyId._id,
      companyName: booking.companyId.name,
      companyLogo: booking.companyId.logo,
      companyRating: booking.companyId.rating,
      startDate: booking.startDate,
      endDate: booking.endDate,
      totalDays: booking.totalDays,
      totalPrice: booking.totalPrice,
      deposit: booking.deposit,
      depositPercentage: depositPercentageNumber,
      remainingAmount: booking.remainingAmount,
      depositStatus: booking.depositStatus,
      paymentStatus: booking.paymentStatus,
      insurance: booking.insurance,
      insurancePrice: booking.insurancePrice,
      walletDiscount: booking.walletDiscount,
      pickupLocation: booking.pickupLocation,
      dropoffLocation: booking.dropoffLocation,
    }
  });
});

export const confirmPayment = catchAsync(async (req, res, next) => {
  const { bookingId, paymentIntentId, paymentType } = req.body;

  if (!paymentIntentId) {
    return next(new AppError("معرف الدفع غير صحيح", 400));
  }

  const booking = await Booking.findById(bookingId)
    .populate("carId", "brand model images licensePlate pricePerDay transmission fuelType seats color year")
    .populate("companyId", "name address phone email logo rating")
    .populate("userId", "name email phone");

  if (!booking) {
    return next(new AppError("الحجز غير موجود", 404));
  }

  if (booking.userId._id.toString() !== req.user.id.toString()) {
    return next(new AppError("غير مصرح لك بتنفيذ هذا الإجراء", 403));
  }

  const transactionId = generateFakeTransactionId();

  if (paymentType === "deposit") {
    if (booking.depositStatus === "paid") {
      return next(new AppError("تم دفع العربون مسبقاً", 400));
    }

    booking.depositStatus = "paid";
    booking.depositPaidAt = new Date();
    booking.status = "confirmed";
    booking.paymentStatus = "partial";
    booking.transactionId = transactionId;
  } 
  else if (paymentType === "remaining") {
    if (booking.paymentStatus === "completed") {
      return next(new AppError("تم دفع المبلغ كاملاً مسبقاً", 400));
    }

    booking.paymentStatus = "completed";
    booking.depositStatus = "paid";
    if (!booking.depositPaidAt) {
      booking.depositPaidAt = new Date();
    }
    booking.transactionId = transactionId;
  }
  else if (paymentType === "full") {
    if (booking.paymentStatus === "completed") {
      return next(new AppError("تم دفع المبلغ كاملاً مسبقاً", 400));
    }

    booking.paymentStatus = "completed";
    booking.depositStatus = "paid";
    booking.depositPaidAt = new Date();
    booking.status = "confirmed";
    booking.transactionId = transactionId;
  }
  else {
    return next(new AppError("نوع الدفع غير صحيح", 400));
  }

  await booking.save();

  const populatedBooking = await Booking.findById(booking._id)
    .populate("carId", "brand model images licensePlate pricePerDay transmission fuelType seats color year")
    .populate("companyId", "name address phone email logo rating")
    .populate("userId", "name email phone")
    .lean();

  res.status(200).json({
    success: true,
    booking: populatedBooking,
    paymentIntentId,
    transactionId,
    paymentType,
    amount: paymentType === "deposit" ? booking.deposit : (paymentType === "remaining" ? booking.remainingAmount : booking.totalPrice),
    message: paymentType === "deposit" ? "تم دفع العربون وتأكيد الحجز بنجاح" : "تم إكمال الدفع بنجاح"
  });
});

export const getPaymentStatus = catchAsync(async (req, res, next) => {
  const { bookingId } = req.params;

  const booking = await Booking.findById(bookingId)
    .populate("carId", "brand model images")
    .populate("companyId", "name");

  if (!booking) {
    return next(new AppError("الحجز غير موجود", 404));
  }

  res.status(200).json({
    success: true,
    paymentStatus: booking.paymentStatus,
    depositStatus: booking.depositStatus,
    bookingStatus: booking.status,
    depositPaidAt: booking.depositPaidAt,
    transactionId: booking.transactionId,
    deposit: booking.deposit,
    remainingAmount: booking.remainingAmount,
    totalPrice: booking.totalPrice
  });
});

export const stripeWebhook = async (req, res) => {
  res.json({ received: true });
};