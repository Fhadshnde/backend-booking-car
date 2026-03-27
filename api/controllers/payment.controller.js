import Booking from "../models/booking.model.js";
import Settings from "../models/settings.model.js";
import catchAsync from "../helpers/catchAsync.js";
import AppError from "../helpers/AppError.js";

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

  const booking = await Booking.findById(bookingId);
  if (!booking) {
    return next(new AppError("الحجز غير موجود", 404));
  }

  if (booking.userId.toString() !== req.user.id) {
    return next(new AppError("غير مصرح لك بتنفيذ هذا الإجراء", 403));
  }

  if (booking.depositStatus === "paid") {
    return next(new AppError("تم دفع العربون مسبقاً", 400));
  }

  const paymentIntent = await fakeStripe.paymentIntents.create();

  res.status(200).json({
    success: true,
    clientSecret: paymentIntent.client_secret,
    paymentIntentId: paymentIntent.id,
    amount: booking.deposit,
    currency: "iqd",
    bookingId: booking._id,
  });
});

export const confirmPayment = catchAsync(async (req, res, next) => {
  const { bookingId, paymentIntentId } = req.body;

  const booking = await Booking.findById(bookingId)
    .populate("companyId")
    .populate("carId")
    .populate("userId");

  if (!booking) {
    return next(new AppError("الحجز غير موجود", 404));
  }

  if (booking.userId.toString() !== req.user.id) {
    return next(new AppError("غير مصرح لك بتنفيذ هذا الإجراء", 403));
  }

  if (booking.depositStatus === "paid") {
    return next(new AppError("تم دفع العربون مسبقاً", 400));
  }

  const paymentIntent = await fakeStripe.paymentIntents.retrieve(paymentIntentId);

  if (paymentIntent.status === "succeeded") {
    booking.paymentStatus = "partial";
    booking.depositStatus = "paid";
    booking.status = "confirmed";
    booking.depositPaidAt = new Date();
    booking.transactionId = paymentIntentId;

    await booking.save();

    const populatedBooking = await Booking.findById(booking._id)
      .populate("companyId")
      .populate("carId")
      .populate("userId")
      .lean();

    res.status(200).json({
      success: true,
      booking: populatedBooking,
      paymentIntentId: paymentIntent.id,
    });
  } else {
    return next(new AppError("فشلت عملية الدفع", 400));
  }
});

export const stripeWebhook = async (req, res) => {
  res.json({ received: true });
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
    bookingStatus: booking.status,
  });
});