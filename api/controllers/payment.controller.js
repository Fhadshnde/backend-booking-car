import mongoose from "mongoose";
import Booking from "../models/booking.model.js";
import catchAsync from "../helpers/catchAsync.js";
import AppError from "../helpers/AppError.js";
import User from "../models/user.model.js";

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
  const { bookingId, paymentIntentId, paymentType, paymentMethod } = req.body;

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

    booking.depositStatus = "pending_verification";
    booking.paymentStatus = "pending_verification";
    booking.paymentVerificationStatus = "pending";
    booking.status = "pending_verification";
    booking.transactionId = transactionId;
    booking.paymentType = paymentType;
    if (paymentMethod) {
      booking.paymentMethod = paymentMethod;
    }
  } 
  else if (paymentType === "remaining") {
    if (booking.paymentStatus === "completed") {
      return next(new AppError("تم دفع المبلغ كاملاً مسبقاً", 400));
    }

    booking.paymentStatus = "pending_verification";
    booking.paymentVerificationStatus = "pending";
    booking.transactionId = transactionId;
    booking.paymentType = paymentType;
    if (paymentMethod) {
      booking.paymentMethod = paymentMethod;
    }
  }
  else if (paymentType === "full") {
    if (booking.paymentStatus === "completed") {
      return next(new AppError("تم دفع المبلغ كاملاً مسبقاً", 400));
    }

    booking.depositStatus = "pending_verification";
    booking.paymentStatus = "pending_verification";
    booking.paymentVerificationStatus = "pending";
    booking.status = "pending_verification";
    booking.transactionId = transactionId;
    booking.paymentType = paymentType;
    if (paymentMethod) {
      booking.paymentMethod = paymentMethod;
    }
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
    message: "تم استلام طلب الدفع بنجاح. سيتم مراجعة العملية من قبل الشركة خلال 24 ساعة.",
    requiresVerification: true
  });
});

export const verifyPayment = catchAsync(async (req, res, next) => {
  const { bookingId, status, note } = req.body;

  if (req.user.role !== "company" && req.user.role !== "admin") {
    return next(new AppError("غير مصرح لك بتنفيذ هذا الإجراء", 403));
  }

  const booking = await Booking.findById(bookingId);
  if (!booking) {
    return next(new AppError("الحجز غير موجود", 404));
  }

  if (req.user.role === "company" && booking.companyId.toString() !== req.user.companyId.toString()) {
    return next(new AppError("غير مصرح لك بتنفيذ هذا الإجراء", 403));
  }

  if (booking.paymentVerificationStatus !== "pending") {
    return next(new AppError("تمت مراجعة هذا الدفع مسبقاً", 400));
  }

  if (status === "verified") {
    if (booking.paymentType === "deposit" || booking.paymentType === "full") {
      booking.depositStatus = "paid";
      booking.depositPaidAt = new Date();
      booking.status = "confirmed";
      booking.paymentStatus = booking.paymentType === "full" ? "completed" : "partial";
    } else if (booking.paymentType === "remaining") {
      booking.paymentStatus = "completed";
      booking.depositStatus = "paid";
      if (!booking.depositPaidAt) {
        booking.depositPaidAt = new Date();
      }
    }
    
    booking.paymentVerificationStatus = "verified";
    booking.paymentVerifiedAt = new Date();
    booking.paymentVerifiedBy = req.user.id;
    if (note) {
      booking.paymentVerificationNote = note;
    }
    
    await booking.save();
    
    res.status(200).json({
      success: true,
      booking,
      message: "تم تأكيد الدفع وتأكيد الحجز بنجاح"
    });
    
  } else if (status === "rejected") {
    booking.paymentVerificationStatus = "rejected";
    if (note) {
      booking.paymentVerificationNote = note;
    }
    booking.status = "payment_rejected";
    booking.paymentStatus = "failed";
    
    const paymentAmount = booking.paymentType === "deposit" ? booking.deposit : 
                          (booking.paymentType === "remaining" ? booking.remainingAmount : booking.totalPrice);
    
    await User.findByIdAndUpdate(booking.userId, {
      $inc: { walletBalance: paymentAmount }
    });
    
    await booking.save();
    
    res.status(200).json({
      success: true,
      booking,
      message: "تم رفض الدفع، وتم استرداد المبلغ إلى محفظتك"
    });
  } else {
    return next(new AppError("حالة غير صحيحة", 400));
  }
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
    paymentVerificationStatus: booking.paymentVerificationStatus,
    paymentVerificationNote: booking.paymentVerificationNote,
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