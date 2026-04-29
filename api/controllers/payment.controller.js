import { prisma } from "../lib/prisma.js";
import { notifyUser } from "../services/notification.service.js";
import crypto from "crypto";

const generateTransactionId = () => {
  return `txn_${crypto.randomUUID().replace(/-/g, '').substring(0, 16)}`;
};

export const createPaymentIntent = async (req, res) => {
  try {
    const { bookingId, paymentType } = req.body;
    const id = parseInt(bookingId);

    console.log("--- تم استدعاء createPaymentIntent ---");
    console.log("الطلب:", { bookingId, paymentType });

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        car: {
          include: { brand: true }
        },
        company: true,
        user: true
      }
    });

    if (!booking) {
      return res.status(404).json({ success: false, message: "الحجز غير موجود" });
    }

    if (booking.userId !== parseInt(req.user.id)) {
      return res.status(403).json({ success: false, message: "غير مصرح لك بتنفيذ هذا الإجراء" });
    }

    let amount = 0;
    let description = "";

    if (paymentType === "deposit") {
      if (booking.paymentStatus === "paid") {
        return res.status(400).json({ success: false, message: "تم دفع العربون مسبقاً" });
      }

      // نستخدم مبلغ العربون المخزن فعلياً في الحجز لضمان التطابق
      amount = booking.deposit;
      description = `دفع عربون حجز السيارة ${booking.car.brand.name} ${booking.car.model}`;
    } else if (paymentType === "remaining") {
      // المبلغ المتبقي الحقيقي = الإجمالي - خصم المحفظة - العربون المدفوع
      const alreadyPaidDeposit = (booking.paymentStatus === "verified" || booking.paymentStatus === "partial" || booking.paymentStatus === "paid") ? (booking.deposit || 0) : 0;
      amount = Math.max(0, booking.totalPrice - (booking.walletDiscount || 0) - alreadyPaidDeposit);
      description = `دفع المبلغ المتبقي لحجز السيارة ${booking.car.brand.name} ${booking.car.model}`;
    } else if (paymentType === "full") {
      // المبلغ المطلوب لكامل الحجز = الإجمالي - ما تم خصمه من المحفظة
      // إذا كان قد دفع العربون مسبقاً، نطرحه أيضاً
      const alreadyPaidDeposit = (booking.paymentStatus === "verified" || booking.paymentStatus === "partial" || booking.paymentStatus === "paid") ? (booking.deposit || 0) : 0;
      amount = Math.max(0, booking.totalPrice - (booking.walletDiscount || 0) - alreadyPaidDeposit);
      description = `دفع كامل مبلغ حجز السيارة ${booking.car.brand.name} ${booking.car.model}`;
    } else {
      return res.status(400).json({ success: false, message: "نوع الدفع غير صالح" });
    }

    const paymentIntent = {
      id: generateTransactionId().replace('txn_', 'pi_'),
      amount: Math.floor(amount),
      currency: "IQD",
      status: "requires_confirmation",
      description: description
    };

    console.log("تفاصيل الحجز المسترجعة للدفع:", {
      id: booking.id,
      totalPrice: booking.totalPrice,
      deposit: booking.deposit,
      driverPrice: booking.driverPrice,
      discountAmount: booking.discountAmount,
      pricePerDay: booking.pricePerDay
    });

    res.status(200).json({
      success: true,
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.id,
      amount: paymentIntent.amount,
      bookingDetails: {
        id: booking.id,
        carName: `${booking.car.brand.name} ${booking.car.model}`,
        carPricePerDay: booking.pricePerDay, // The price saved at booking time
        originalPrice: booking.car.pricePerDay, // The car's current list price
        startDate: booking.startDate,
        endDate: booking.endDate,
        totalDays: booking.totalDays,
        totalPrice: booking.totalPrice,
        deposit: booking.deposit,
        insurance: booking.insurance,
        insurancePrice: booking.insurancePrice,
        walletDiscount: booking.walletDiscount || 0,
        discountAmount: booking.discountAmount || 0,
        hasDriver: booking.hasDriver,
        driverPrice: booking.driverPrice,
        deliveryFee: booking.deliveryFee || 0,
        companyName: booking.company.name,
        companyLogo: booking.company.logo,
        carImages: booking.car.images
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const confirmPayment = async (req, res) => {
  try {
    const { bookingId, paymentType, paymentMethod, walletAmount = 0 } = req.body;
    const id = parseInt(bookingId);

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { user: true }
    });

    if (!booking) {
      return res.status(404).json({ success: false, message: "الحجز غير موجود" });
    }

    // حساب المبلغ المطلوب دفعه قبل الخصم الجديد
    let totalDue = 0;
    if (paymentType === "deposit") {
      totalDue = booking.deposit;
    } else if (paymentType === "remaining" || paymentType === "full") {
      // نتحقق من المبالغ التي دُفعت فعلياً (سواء كان عربوناً تم التحقق منه أو دفعاً كاملاً سابقاً)
      const alreadyPaidDeposit = (booking.paymentStatus === "verified" || booking.paymentStatus === "partial" || booking.paymentStatus === "paid") ? (booking.deposit || 0) : 0;
      totalDue = Math.max(0, booking.totalPrice - (booking.walletDiscount || 0) - alreadyPaidDeposit);
    }

    // المبلغ المطلوب دفعه بالوسيلة الأخرى (بطاقة/كاش) بعد خصم المحفظة الجديد
    const amountToPay = Math.max(0, totalDue - walletAmount);

    // التحقق من كفاية رصيد المحفظة
    const user = await prisma.user.findUnique({ where: { id: booking.userId } });
    const requiredFromWallet = paymentMethod === "wallet" ? totalDue : walletAmount;

    if (requiredFromWallet > 0) {
      if (!user || user.walletBalance < requiredFromWallet) {
        return res.status(400).json({
          success: false,
          message: `رصيد المحفظة غير كافٍ. المتاح: ${user?.walletBalance || 0}، المطلوب: ${requiredFromWallet}`
        });
      }
    }

    const transactionId = generateTransactionId();

    const dataToUpdate = {
      paymentStatus: (paymentType === "deposit" || paymentMethod === "cash") ? (paymentMethod === "cash" ? "partial" : "verified") : "paid",
      walletDiscount: { increment: requiredFromWallet }
    };

    if (paymentType === "deposit" || paymentType === "remaining" || paymentType === "full") {
      dataToUpdate.status = "confirmed";
      if (paymentType === "full" || paymentType === "remaining") {
        if (paymentMethod !== "cash") {
          // نُحدّث الـ deposit ليساوي المبلغ الصافي المتبقي (الإجمالي - كل خصومات المحفظة)
          const totalWalletUsed = (booking.walletDiscount || 0) + requiredFromWallet;
          dataToUpdate.deposit = Math.max(0, booking.totalPrice - totalWalletUsed);
        }
      }
    }

    let updatedUser = null;
    const results = await prisma.$transaction([
      prisma.booking.update({ where: { id }, data: dataToUpdate }),
      prisma.user.update({
        where: { id: booking.userId },
        data: { walletBalance: { decrement: requiredFromWallet } }
      })
    ]);
    updatedUser = results[1];

    if (requiredFromWallet > 0) {
      notifyUser({
        userId: booking.userId,
        title: "تم خصم مبلغ من محفظتك 💳",
        message: `تم خصم ${requiredFromWallet.toLocaleString()} د.ع من محفظتك كدفعة للحجز #${booking.confirmationCode}.`,
        type: "wallet",
        relatedBooking: booking.id
      });
    }

    const updatedBooking = await prisma.booking.findUnique({ where: { id } });

    res.status(200).json({
      success: true,
      message: paymentMethod === "wallet"
        ? "تم الدفع من المحفظة وخصم المبلغ بنجاح"
        : "تم تأكيد الدفع بنجاح",
      booking: updatedBooking,
      user: updatedUser,
      transactionId
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const verifyPayment = async (req, res) => {
  try {
    const { bookingId } = req.body;
    const booking = await prisma.booking.update({
      where: { id: parseInt(bookingId) },
      data: { paymentStatus: "verified" }
    });
    res.status(200).json({ success: true, booking });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const stripeWebhook = async (req, res) => {
  res.status(200).json({ success: true });
};

export const getPaymentStatus = async (req, res) => {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: parseInt(req.params.bookingId) },
      include: {
        car: { select: { model: true, images: true } },
        company: { select: { name: true } }
      }
    });

    if (!booking) {
      return res.status(404).json({ success: false, message: "الحجز غير موجود" });
    }

    res.status(200).json({
      success: true,
      paymentStatus: booking.paymentStatus,
      bookingStatus: booking.status,
      totalPrice: booking.totalPrice,
      deposit: booking.deposit
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};