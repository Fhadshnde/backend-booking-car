import mongoose from "mongoose";
import Booking from "../models/booking.model.js";
import Car from "../models/car.model.js";
import Company from "../models/company.model.js";
import Ad from "../models/ad.model.js";
import { sendNotification } from "./notification.controller.js";
import catchAsync from "../helpers/catchAsync.js";
import AppError from "../helpers/AppError.js";

// ============= Settings Model =============
const SettingsSchema = new mongoose.Schema({
  depositPercentage: { type: Number, default: 0.3 }
});
export const Settings = mongoose.model("Settings", SettingsSchema);

// ============= Helper =============
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

// دالة لإخفاء بيانات الشركة إذا لم يتم دفع العربون
const hideCompanyIfDepositNotPaid = (booking) => {
  if (!booking) return booking;

  const b = { ...booking };

  // إذا لم يتم دفع العربون، إخفاء بيانات الشركة التفصيلية
  if (b.depositStatus !== "paid") {
    if (b.companyId && typeof b.companyId === "object") {
      b.companyId = {
        _id: b.companyId._id,
        name: b.companyId.name
        // إخفاء: phone, address, logo, city وباقي التفاصيل
      };
    }
    b.companyDetailsHidden = true;
    b.companyDetailsMessage = "سيتم إظهار تفاصيل الشركة بعد دفع العربون";
  } else {
    b.companyDetailsHidden = false;
  }

  return b;
};

// ============= إنشاء حجز =============
// مكان الاستلام: إذا لم يحدده المستخدم، يتم جلبه من عنوان الشركة (موقع السيارة)
export const createBooking = catchAsync(async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { carId, companyId, startDate, endDate, pickupLocation, dropoffLocation, insurance, adId } = req.body;

    const car = await Car.findById(carId).session(session);
    if (!car || car.isSuspended || !car.isAvailable) {
      throw new AppError("السيارة غير متاحة حالياً", 400);
    }

    // جلب بيانات الشركة لاستخدام العنوان كمكان استلام افتراضي
    const company = await Company.findById(companyId).session(session);
    if (!company) {
      throw new AppError("الشركة غير موجودة", 404);
    }

    // إذا لم يحدد المستخدم مكان الاستلام، يُستخدم عنوان الشركة
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
    const finalTotalPrice = initialTotalPrice + insurancePrice;

    const settings = await Settings.findOne().lean();
    const depositPerc = settings?.depositPercentage || 0.3;
    const depositAmount = Math.round(finalTotalPrice * depositPerc);

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
      depositStatus: "pending",
      insurance,
      insurancePrice,
      pickupLocation: finalPickupLocation,
      dropoffLocation: finalDropoffLocation,
      confirmationCode,
      status: "pending",
      paymentStatus: "pending"
    }], { session });

    await Car.findByIdAndUpdate(carId, { $inc: { totalBookings: 1 } }, { session });

    await session.commitTransaction();

    sendNotification({ 
      userId: req.user.id, 
      title: "تم إنشاء الحجز", 
      message: `تم إنشاء حجزك رقم ${confirmationCode}. المبلغ الإجمالي: ${finalTotalPrice}. العربون المطلوب: ${depositAmount}`, 
      type: "booking_created", 
      relatedBooking: booking._id 
    });

    res.status(201).json({ 
      success: true, 
      booking,
      discountAmount,
      depositInfo: {
        depositAmount,
        depositPercentage: depositPerc * 100,
        remainingAfterDeposit: finalTotalPrice - depositAmount,
        message: "يرجى دفع العربون لتأكيد الحجز"
      }
    });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
});

// ============= تأكيد دفع العربون =============
// يتم استدعاؤه بعد أن يدفع المستخدم العربون
// بعد تأكيد العربون تظهر بيانات الشركة الكاملة
export const confirmDeposit = catchAsync(async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const booking = await Booking.findById(req.params.id).session(session);
    
    if (!booking) {
      throw new AppError("الحجز غير موجود", 404);
    }

    if (booking.depositStatus === "paid") {
      throw new AppError("العربون مدفوع مسبقاً", 400);
    }

    if (booking.status === "cancelled") {
      throw new AppError("لا يمكن دفع العربون لحجز ملغي", 400);
    }

    // تحديث حالة العربون
    booking.depositStatus = "paid";
    booking.depositPaidAt = new Date();
    booking.paymentStatus = "partial";
    await booking.save({ session });

    await session.commitTransaction();

    // جلب الحجز مع بيانات الشركة الكاملة (لأن العربون مدفوع الآن)
    const updatedBooking = await Booking.findById(booking._id)
      .populate("carId", "brand model licensePlate color year images")
      .populate("companyId", "name phone address city logo workingHours")
      .populate("userId", "name phone")
      .lean();

    sendNotification({ 
      userId: booking.userId, 
      title: "تم تأكيد دفع العربون", 
      message: `تم تأكيد دفع العربون بمبلغ ${booking.deposit} لحجزك رقم ${booking.confirmationCode}. يمكنك الآن رؤية تفاصيل الشركة.`, 
      type: "deposit_confirmed", 
      relatedBooking: booking._id 
    });

    res.status(200).json({ 
      success: true,
      message: "تم تأكيد دفع العربون بنجاح",
      booking: updatedBooking,
      companyDetails: {
        name: updatedBooking.companyId.name,
        phone: updatedBooking.companyId.phone,
        address: updatedBooking.companyId.address,
        city: updatedBooking.companyId.city,
        logo: updatedBooking.companyId.logo,
        workingHours: updatedBooking.companyId.workingHours,
        message: "تفاصيل الشركة التي ستؤجر منها السيارة"
      }
    });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
});

// ============= تأكيد الحجز (Company/Admin) =============
// يشترط أن يكون العربون مدفوعاً أولاً
export const confirmBooking = catchAsync(async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const booking = await Booking.findById(req.params.id).session(session);
    if (!booking || booking.status !== "pending") {
      throw new AppError("لا يمكن تأكيد هذا الحجز", 400);
    }

    // التحقق من دفع العربون أولاً
    if (booking.depositStatus !== "paid") {
      throw new AppError("يجب دفع العربون أولاً قبل تأكيد الحجز", 400);
    }

    booking.status = "confirmed";
    await booking.save({ session });

    await Car.findByIdAndUpdate(booking.carId, { isAvailable: false }, { session });
    
    await session.commitTransaction();

    sendNotification({ 
      userId: booking.userId, 
      title: "تم تأكيد الحجز", 
      message: `تم تأكيد حجزك رقم ${booking.confirmationCode} بنجاح. يمكنك التواصل مع الشركة لتنسيق الاستلام.`, 
      type: "booking_confirmed", 
      relatedBooking: booking._id 
    });

    res.status(200).json({ success: true, message: "تم تأكيد الحجز بنجاح", booking });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
});

// ============= جلب كل الحجوزات (حسب الدور) =============
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
      { path: "companyId", select: "name phone address city logo" }
    ]
  });

  // إخفاء بيانات الشركة للمستخدم العادي إذا لم يدفع العربون
  if (role === "user") {
    result.bookings = result.bookings.map(hideCompanyIfDepositNotPaid);
  }

  res.status(200).json({ success: true, ...result });
});

// ============= جلب حجز محدد =============
export const getBooking = catchAsync(async (req, res, next) => {
  let booking = await Booking.findById(req.params.id)
    .populate("userId", "name phone")
    .populate("carId", "brand model licensePlate pricePerDay images")
    .populate("companyId", "name phone address city logo workingHours")
    .lean();
      
  if (!booking) return next(new AppError("الحجز غير موجود", 404));

  // إخفاء بيانات الشركة إذا لم يدفع العربون (للمستخدم العادي فقط)
  if (req.user.role === "user") {
    booking = hideCompanyIfDepositNotPaid(booking);
  }

  res.status(200).json({ success: true, booking });
});

// ============= تفاصيل حجز كاملة =============
export const getBookingDetails = catchAsync(async (req, res, next) => {
  let booking = await Booking.findById(req.params.id)
    .populate("userId", "name phone address")
    .populate("carId", "brand model licensePlate color year seats images")
    .populate("companyId", "name phone address city logo workingHours socialMedia")
    .lean();
      
  if (!booking) return next(new AppError("تفاصيل الحجز غير موجودة", 404));

  // إخفاء بيانات الشركة إذا لم يدفع العربون (للمستخدم العادي فقط)
  if (req.user.role === "user") {
    booking = hideCompanyIfDepositNotPaid(booking);
  }

  res.status(200).json({ success: true, booking });
});

// ============= إتمام الحجز =============
export const completeBooking = catchAsync(async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { rating, review } = req.body;
    const booking = await Booking.findById(req.params.id).session(session);
    if (!booking) throw new AppError("الحجز غير موجود", 404);

    booking.status = "completed";
    booking.paymentStatus = "completed";
    booking.depositStatus = "paid";
    if (rating) booking.rating = rating;
    if (review) booking.review = review;
    booking.reviewedAt = Date.now();
    
    await booking.save({ session });
    await Car.findByIdAndUpdate(booking.carId, { isAvailable: true }, { session });
    
    await session.commitTransaction();

    res.status(200).json({ success: true, message: "تم إتمام الحجز بنجاح" });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
});

// ============= إتمام الدفع الكامل =============
export const completePayment = catchAsync(async (req, res, next) => {
  const { bookingId, amountPaid } = req.body;
  const booking = await Booking.findById(bookingId);
  
  if (!booking) return next(new AppError("الحجز غير موجود", 404));
  
  if (booking.depositStatus !== "paid") {
    return next(new AppError("يجب دفع العربون أولاً", 400));
  }

  const remainingBalance = booking.totalPrice - booking.deposit;
  if (amountPaid < remainingBalance) {
    return next(new AppError(`المبلغ المدفوع أقل من المتبقي. المبلغ المتبقي: ${remainingBalance}`, 400));
  }

  booking.paymentStatus = "completed";
  await booking.save();

  res.status(200).json({ 
    success: true, 
    booking,
    paymentSummary: {
      totalPrice: booking.totalPrice,
      depositPaid: booking.deposit,
      remainingPaid: remainingBalance,
      message: "تم إتمام الدفع الكامل"
    }
  });
});

// ============= تعديل حجز =============
export const updateBooking = catchAsync(async (req, res, next) => {
  const booking = await Booking.findById(req.params.id);
  if (!booking || booking.status !== "pending") {
    throw new AppError("لا يمكن تعديل الحجز في حالته الحالية", 400);
  }

  // لا يسمح بتعديل الحجز بعد دفع العربون
  if (booking.depositStatus === "paid") {
    throw new AppError("لا يمكن تعديل الحجز بعد دفع العربون. يرجى إلغاء الحجز وإنشاء حجز جديد", 400);
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
    booking.deposit = Math.round(booking.totalPrice * depositPerc);
  }

  await booking.save();
  res.status(200).json({ success: true, booking });
});

// ============= إلغاء حجز =============
export const cancelBooking = catchAsync(async (req, res, next) => {
  const { reason } = req.body;
  const booking = await Booking.findById(req.params.id);
  
  if (!booking || booking.status === "cancelled") {
    throw new AppError("الحجز ملغي مسبقاً أو غير موجود", 400);
  }

  // إذا كان العربون مدفوعاً، يتم تحديث حالته إلى "refunded"
  if (booking.depositStatus === "paid") {
    booking.depositStatus = "refunded";
  }

  booking.status = "cancelled";
  booking.cancellationReason = reason || "ملغي بواسطة المستخدم";
  booking.cancelledAt = new Date();
  booking.cancelledBy = req.user.role;
  
  await booking.save();
  await Car.findByIdAndUpdate(booking.carId, { isAvailable: true });

  const refundMessage = booking.depositStatus === "refunded" 
    ? ` سيتم استرجاع العربون بمبلغ ${booking.deposit}.`
    : "";

  sendNotification({
    userId: booking.userId,
    title: "تم إلغاء الحجز",
    message: `تم إلغاء حجزك رقم ${booking.confirmationCode}.${refundMessage}`,
    type: "booking_cancelled",
    relatedBooking: booking._id
  });

  res.status(200).json({ 
    success: true, 
    message: "تم إلغاء الحجز بنجاح",
    depositRefund: booking.depositStatus === "refunded" ? {
      refundAmount: booking.deposit,
      message: "سيتم استرجاع مبلغ العربون"
    } : null
  });
});

// ============= حجوزاتي =============
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

  // إخفاء بيانات الشركة إذا لم يدفع العربون
  result.bookings = result.bookings.map(hideCompanyIfDepositNotPaid);

  res.status(200).json({ success: true, ...result });
});

// ============= حجوزات الشركة =============
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

// ============= إعداد نسبة العربون (Admin) =============
export const setGlobalDepositPercentage = catchAsync(async (req, res, next) => {
  const { depositPercentage } = req.body;
  
  if (depositPercentage === undefined) {
    return next(new AppError("نسبة العربون مطلوبة", 400));
  }

  if (depositPercentage < 0 || depositPercentage > 1) {
    return next(new AppError("نسبة العربون يجب أن تكون بين 0 و 1 (مثال: 0.3 = 30%)", 400));
  }
  
  const settings = await Settings.findOneAndUpdate(
    {}, 
    { depositPercentage }, 
    { upsert: true, new: true }
  );
  
  res.status(200).json({ 
    success: true, 
    settings,
    message: `تم تحديث نسبة العربون إلى ${depositPercentage * 100}%`
  });
});

// ============= جلب نسبة العربون الحالية =============
export const getDepositPercentage = catchAsync(async (req, res, next) => {
  const settings = await Settings.findOne().lean();
  const depositPercentage = settings?.depositPercentage || 0.3;

  res.status(200).json({
    success: true,
    depositPercentage,
    displayPercentage: `${depositPercentage * 100}%`
  });
});