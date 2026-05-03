import { prisma } from "../lib/prisma.js";
import { notifyUser } from "../services/notification.service.js";
import { calculateBookingBreakdown } from "../helpers/pricing.helper.js";
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

    const breakdown = await calculateBookingBreakdown({
      car: booking.car,
      startDate: booking.startDate,
      endDate: booking.endDate,
      useInsurance: booking.insurance,
      hasDriver: booking.hasDriver,
      promoCodeId: booking.promoCodeId,
      pickupLocation: booking.pickupLocation,
      walletAmount: booking.walletDiscount, // Current wallet usage
    });

    const { totalPrice, remainingDeposit, initialDepositAmount } = breakdown;

    let amount = 0;
    let description = "";

    if (paymentType === "deposit") {
      if (booking.paymentStatus === "paid" || booking.paymentStatus === "verified") {
        return res.status(400).json({ success: false, message: "تم دفع العربون مسبقاً" });
      }
      amount = booking.deposit; // This is the remaining deposit saved in DB
      description = `دفع عربون حجز السيارة ${booking.car.brand.name} ${booking.car.model}`;
    } else if (paymentType === "remaining" || paymentType === "full") {
      const alreadyPaid = (booking.paymentStatus === "verified" || booking.paymentStatus === "paid") ? initialDepositAmount : 0;
      amount = Math.max(0, totalPrice - booking.walletDiscount - alreadyPaid);
      description = paymentType === "remaining" ? `دفع المبلغ المتبقي لحجز السيارة ${booking.car.brand.name} ${booking.car.model}` : `دفع كامل مبلغ حجز السيارة ${booking.car.brand.name} ${booking.car.model}`;
    } else if (paymentType === "partial_wallet") {
      // This case handles additional wallet payments
      amount = Math.max(0, totalPrice - booking.walletDiscount);
      description = `دفع جزء من المبلغ لحجز السيارة ${booking.car.brand.name} ${booking.car.model}`;
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
      include: { 
        user: true,
        car: { include: { brand: true } } 
      }
    });

    if (!booking) {
      return res.status(404).json({ success: false, message: "الحجز غير موجود" });
    }

    const breakdown = await calculateBookingBreakdown({
      car: booking.car,
      startDate: booking.startDate,
      endDate: booking.endDate,
      useInsurance: booking.insurance,
      hasDriver: booking.hasDriver,
      promoCodeId: booking.promoCodeId,
      pickupLocation: booking.pickupLocation,
      walletAmount: booking.walletDiscount + walletAmount, // الإجمالي بعد الخصم الجديد
    });

    const { totalPrice, initialDepositAmount, paymentStatus: newPaymentStatus, walletDiscount: totalWalletUsed } = breakdown;

    // حساب المبلغ المتبقي بناءً على نوع الدفع المطلوب حالياً
    let totalDue = 0;
    if (paymentType === "deposit") {
      totalDue = booking.deposit;
    } else if (paymentType === "remaining" || paymentType === "full") {
      const alreadyPaidDeposit = (booking.paymentStatus === "verified" || booking.paymentStatus === "paid") ? initialDepositAmount : 0;
      totalDue = Math.max(0, totalPrice - booking.walletDiscount - alreadyPaidDeposit);
    }

    const user = await prisma.user.findUnique({ where: { id: booking.userId } });
    const requiredFromWallet = walletAmount; 

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
      paymentStatus: newPaymentStatus,
      walletDiscount: { increment: requiredFromWallet },
      deposit: Math.max(0, (booking.deposit || 0) - (paymentMethod === "wallet" ? requiredFromWallet : 0))
    };

    if (newPaymentStatus === "verified" || newPaymentStatus === "paid") {
      dataToUpdate.status = "confirmed";
    }

    const results = await prisma.$transaction([
      prisma.booking.update({ where: { id: id }, data: dataToUpdate }),
      prisma.user.update({
        where: { id: booking.userId },
        data: { walletBalance: { decrement: requiredFromWallet } }
      })
    ]);

    const updatedUser = results[1];

    if (requiredFromWallet > 0) {
      notifyUser({
        userId: booking.userId,
        title: "تم خصم مبلغ من محفظتك 💳",
        message: `تم خصم ${requiredFromWallet.toLocaleString()} د.ع من محفظتك كدفعة للحجز #${booking.confirmationCode}.`,
        type: "wallet",
        relatedBooking: booking.id
      });
    }

    if (paymentMethod === "cash") {
      // Notify Company about pending cash deposit
      const companyUsers = await prisma.user.findMany({
        where: { companyId: booking.companyId, role: "company" },
        select: { id: true }
      });
      companyUsers.forEach(admin => {
        notifyUser({
          userId: admin.id,
          title: "طلب دفع نقدي جديد 💵",
          message: `المستخدم ${user.name} يرغب بالدفع نقداً للحجز #${booking.confirmationCode}. يرجى تأكيد استلام العربون يدوياً.`,
          type: "booking",
          relatedBooking: booking.id
        });
      });
    }

    const updatedBooking = await prisma.booking.findUnique({ where: { id } });

    res.status(200).json({
      success: true,
      message: paymentMethod === "wallet"
        ? "تم الدفع من المحفظة وخصم المبلغ بنجاح"
        : paymentMethod === "cash"
          ? "تم استلام طلب الدفع النقدي. يرجى مراجعة المكتب لتسديد المبلغ وتأكيد الحجز."
          : "تم تأكيد الدفع بنجاح",
      booking: updatedBooking,
      user: updatedUser,
      transactionId,
      requiresVerification: paymentMethod === "cash"
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