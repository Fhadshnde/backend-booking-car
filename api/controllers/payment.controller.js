import Booking from "../models/booking.model.js";
import catchAsync from "../helpers/catchAsync.js";
import AppError from "../helpers/AppError.js";
import { sendNotification } from "./notification.controller.js";

const fakeStripe = {
  paymentIntents: {
    create: async () => ({
      id: `fake_pi_${Math.random().toString(36).substr(2, 9)}`,
      client_secret: `fake_secret_${Math.random().toString(36).substr(2, 20)}`,
    }),
    retrieve: async (id) => ({
      id,
      status: "succeeded",
    }),
  },
};

export const createPaymentIntent = catchAsync(async (req, res, next) => {
  const { bookingId } = req.body;

  const booking = await Booking.findById(bookingId)
    .populate("carId")
    .populate("companyId");

  if (!booking) {
    return next(new AppError("الحجز غير موجود", 404));
  }

  const depositAmount = booking.totalPrice * 0.3;

  const paymentIntent = await fakeStripe.paymentIntents.create();

  res.status(200).json({
    success: true,
    clientSecret: paymentIntent.client_secret,
    paymentIntentId: paymentIntent.id,
    amount: depositAmount,
    currency: "usd",
    message: "هذه عملية دفع وهمية لغرض التجربة"
  });
});

export const confirmPayment = catchAsync(async (req, res, next) => {
  const { bookingId, paymentIntentId } = req.body;

  const booking = await Booking.findById(bookingId);
  if (!booking) {
    return next(new AppError("الحجز غير موجود", 404));
  }

  const paymentIntent = await fakeStripe.paymentIntents.retrieve(paymentIntentId);

  if (paymentIntent.status === "succeeded") {
    booking.paymentStatus = "completed";
    booking.depositStatus = "paid";
    booking.status = "confirmed";
    booking.paymentMethod = "credit_card";
    
    await booking.save();

    await sendNotification({
      userId: booking.userId,
      title: "تم دفع العربون",
      message: `تم تأكيد دفع العربون بنجاح لحجزك رقم ${booking.confirmationCode}. يمكنك الآن رؤية موقع السيارة.`,
      type: "payment_received",
      relatedBooking: booking._id
    });

    res.status(200).json({
      success: true,
      message: "تم تأكيد دفع العربون بنجاح (وهمي)",
      booking
    });
  } else {
    return next(new AppError("فشلت عملية الدفع الوهمية", 400));
  }
});

export const stripeWebhook = async (req, res) => {
  res.json({ received: true, mode: "fake_testing" });
};

export const getPaymentStatus = catchAsync(async (req, res, next) => {
  const { bookingId } = req.params;

  const booking = await Booking.findById(bookingId);
  if (!booking) {
    return next(new AppError("الحجز غير موجود", 404));
  }

  res.status(200).json({
    success: true,
    paymentStatus: booking.paymentStatus,
    depositStatus: booking.depositStatus,
    totalPrice: booking.totalPrice,
    depositAmount: booking.totalPrice * 0.3
  });
});