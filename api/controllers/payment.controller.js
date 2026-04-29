import { prisma } from "../lib/prisma.js";

const generateFakePaymentId = () => {
  return `pay_${Math.random().toString(36).substr(2, 12)}`;
};

const generateFakeTransactionId = () => {
  return `txn_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
};

export const createPaymentIntent = async (req, res) => {
  try {
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
    } else if (paymentType === "full") {
      amount = booking.totalPrice;
      description = `دفع كامل مبلغ حجز السيارة ${booking.car.brand.name} ${booking.car.model}`;
    } else {
      return res.status(400).json({ success: false, message: "نوع الدفع غير صالح" });
    }

    const paymentIntent = {
      id: generateFakePaymentId(),
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
    const { bookingId, paymentType, paymentMethod } = req.body;
    const id = parseInt(bookingId);

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { user: true }
    });

    if (!booking) {
      return res.status(404).json({ success: false, message: "الحجز غير موجود" });
    }

    // حساب المبلغ المطلوب دفعه
    let amountToPay = 0;
    if (paymentType === "deposit") {
      amountToPay = booking.deposit;
    } else if (paymentType === "full") {
      amountToPay = booking.totalPrice;
    }

    // التحقق من رصيد المحفظة إذا اختار الدفع عبرها
    if (paymentMethod === "wallet") {
      const user = await prisma.user.findUnique({ where: { id: booking.userId } });
      if (!user || user.walletBalance < amountToPay) {
        return res.status(400).json({
          success: false,
          message: `رصيد المحفظة غير كافٍ. الرصيد المتاح: $${user?.walletBalance || 0}، المبلغ المطلوب: $${amountToPay}`
        });
      }
    }

    const transactionId = generateFakeTransactionId();

    const dataToUpdate = {
      paymentStatus: "paid"
    };

    if (paymentType === "deposit") {
      dataToUpdate.status = "confirmed";
    } else if (paymentType === "full") {
      dataToUpdate.status = "confirmed";
      // نُحدّث الـ deposit ليساوي الإجمالي حتى تعرف الواجهة أنه دفع كل شيء
      dataToUpdate.deposit = booking.totalPrice;
    }

    let updatedUser = null;
    // تنفيذ العمليات: تحديث الحجز + خصم المحفظة (إذا لزم) في transaction واحدة
    if (paymentMethod === "wallet") {
      const results = await prisma.$transaction([
        prisma.booking.update({ where: { id }, data: dataToUpdate }),
        prisma.user.update({
          where: { id: booking.userId },
          data: { walletBalance: { decrement: amountToPay } }
        }),
        prisma.notification.create({
          data: {
            userId: booking.userId,
            title: "تم خصم مبلغ من محفظتك",
            message: `تم خصم ${amountToPay.toLocaleString()} د.ع من محفظتك كدفعة للحجز #${booking.confirmationCode}.`,
            type: "wallet"
          }
        })
      ]);
      updatedUser = results[1];
    } else {
      await prisma.booking.update({ where: { id }, data: dataToUpdate });
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