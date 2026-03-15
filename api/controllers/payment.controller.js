import Stripe from "stripe";
import Booking from "../models/booking.model.js";
import catchAsync from "../helpers/catchAsync.js";
import AppError from "../helpers/AppError.js";
import { sendNotification } from "./notification.controller.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// إنشاء جلسة دفع
export const createPaymentIntent = catchAsync(async (req, res, next) => {
  const { bookingId } = req.body;

  const booking = await Booking.findById(bookingId)
    .populate("carId", "brand model")
    .populate("companyId", "name");

  if (!booking) {
    return next(new AppError("الحجز غير موجود", 404));
  }

  if (booking.userId.toString() !== req.user._id.toString()) {
    return next(new AppError("لا يمكنك الدفع لحجز ليس لك", 403));
  }

  if (booking.paymentStatus === "completed") {
    return next(new AppError("تم الدفع مسبقاً لهذا الحجز", 400));
  }

  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(booking.totalPrice * 100), // Stripe يستخدم سنتات
    currency: "usd",
    metadata: {
      bookingId: booking._id.toString(),
      userId: req.user._id.toString()
    },
    description: `حجز سيارة ${booking.carId.brand} ${booking.carId.model} - ${booking.companyId.name}`
  });

  res.status(200).json({
    success: true,
    clientSecret: paymentIntent.client_secret,
    paymentIntentId: paymentIntent.id,
    amount: booking.totalPrice
  });
});

// تأكيد الدفع يدوياً
export const confirmPayment = catchAsync(async (req, res, next) => {
  const { bookingId, paymentIntentId } = req.body;

  const booking = await Booking.findById(bookingId);
  if (!booking) {
    return next(new AppError("الحجز غير موجود", 404));
  }

  // التحقق من حالة الدفع في Stripe
  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

  if (paymentIntent.status === "succeeded") {
    booking.paymentStatus = "completed";
    booking.paymentMethod = "credit_card";
    await booking.save();

    // إرسال إشعار
    await sendNotification({
      userId: booking.userId,
      title: "تم الدفع بنجاح",
      message: `تم تأكيد الدفع لحجزك رقم ${booking.confirmationCode}`,
      type: "payment_received",
      relatedBooking: booking._id
    });

    res.status(200).json({
      success: true,
      message: "تم تأكيد الدفع بنجاح",
      booking
    });
  } else {
    return next(new AppError(`حالة الدفع: ${paymentIntent.status}`, 400));
  }
});

// Webhook لاستقبال أحداث Stripe
export const stripeWebhook = async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return res.status(400).json({ message: `Webhook Error: ${err.message}` });
  }

  // معالجة الأحداث
  if (event.type === "payment_intent.succeeded") {
    const paymentIntent = event.data.object;
    const { bookingId, userId } = paymentIntent.metadata;

    if (bookingId) {
      await Booking.findByIdAndUpdate(bookingId, {
        paymentStatus: "completed",
        paymentMethod: "credit_card"
      });

      await sendNotification({
        userId,
        title: "تم الدفع بنجاح",
        message: "تم استلام الدفع وتأكيده تلقائياً",
        type: "payment_received",
        relatedBooking: bookingId
      });
    }
  }

  if (event.type === "payment_intent.payment_failed") {
    const paymentIntent = event.data.object;
    const { bookingId, userId } = paymentIntent.metadata;

    if (bookingId) {
      await Booking.findByIdAndUpdate(bookingId, {
        paymentStatus: "failed"
      });

      await sendNotification({
        userId,
        title: "فشل الدفع",
        message: "فشلت عملية الدفع، يرجى المحاولة مرة أخرى",
        type: "general",
        relatedBooking: bookingId
      });
    }
  }

  res.json({ received: true });
};

// جلب حالة الدفع
export const getPaymentStatus = catchAsync(async (req, res, next) => {
  const { bookingId } = req.params;

  const booking = await Booking.findById(bookingId);
  if (!booking) {
    return next(new AppError("الحجز غير موجود", 404));
  }

  res.status(200).json({
    success: true,
    paymentStatus: booking.paymentStatus,
    totalPrice: booking.totalPrice,
    paymentMethod: booking.paymentMethod
  });
});
