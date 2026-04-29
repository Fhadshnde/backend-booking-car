import { prisma } from "../lib/prisma.js";
import { notifyUser } from "../services/notification.service.js";

export const createBooking = async (req, res) => {
  try {
    const {
      carId,
      startDate,
      endDate,
      useInsurance,
      walletAmount,
      pickupLocation,
      dropoffLocation,
      pickupLat,
      pickupLng,
      dropoffLat,
      dropoffLng,
      driverLicense,
      hasDriver,
      promoCodeId,
    } = req.body;

    if (!carId) {
      return res.status(400).json({ success: false, message: "معرف السيارة مطلوب" });
    }

    const parsedCarId = Number(carId);
    if (isNaN(parsedCarId)) {
      return res.status(400).json({ success: false, message: "معرف السيارة غير صالح" });
    }

    const car = await prisma.car.findUnique({
      where: { id: parsedCarId }
    });

    if (!car) {
      return res.status(404).json({ success: false, message: "السيارة غير موجودة" });
    }

    if (!car.isAvailable || car.isSuspended) {
      return res.status(400).json({ success: false, message: "السيارة غير متاحة للحجز حالياً" });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (end <= start) {
      return res.status(400).json({ success: false, message: "تاريخ الانتهاء يجب أن يكون بعد تاريخ البداية" });
    }

    const conflictingBookings = await prisma.booking.findFirst({
      where: {
        carId: parsedCarId,
        status: { in: ["pending", "pending_verification", "confirmed", "on_trip"] },
        OR: [
          {
            AND: [
              { startDate: { lt: end } },
              { endDate: { gt: start } }
            ]
          }
        ]
      }
    });

    if (conflictingBookings) {
      return res.status(400).json({ success: false, message: "السيارة غير متاحة في الفترة المحددة" });
    }

    const diffTime = end - start;
    const diffHours = diffTime / (1000 * 60 * 60);
    const totalDays = diffHours <= 24 ? 1 : Math.ceil(diffHours / 24);

    const today = new Date();
    
    // Logic matching car.controller.js: Check for active Ads first
    const activeAd = await prisma.ad.findFirst({
      where: {
        cars: { some: { id: car.id } },
        isActive: true,
        endDate: { gte: today }
      }
    });

    let discountPercentage = 0;
    if (activeAd) {
      discountPercentage = activeAd.discountPercentage;
    }

    const originalPrice = car.pricePerDay;
    let currentPrice = originalPrice;

    if (discountPercentage > 0) {
      currentPrice = originalPrice * (1 - discountPercentage / 100);
    } else if (car.discountPrice > 0 && (!car.offerEndsAt || new Date(car.offerEndsAt) > today)) {
      currentPrice = car.discountPrice;
    }

    const basePrice = totalDays * currentPrice;

    const globalSettings = await prisma.setting.findFirst({ orderBy: { createdAt: "desc" } });

    let insurancePrice = 0;
    if (useInsurance) {
      insurancePrice = car.insurancePrice || (globalSettings ? globalSettings.insurancePrice : 0);
    }

    let driverPrice = 0;
    if (hasDriver) {
      const driverPricePerDay = (car.driverPricePerDay !== null && car.driverPricePerDay !== undefined) 
        ? car.driverPricePerDay 
        : (globalSettings?.defaultDriverPrice ?? 0);
      driverPrice = totalDays * driverPricePerDay;
    }

    const deliveryFee = (pickupLocation && pickupLocation !== "مكتب الشركة الرئيسي" && !hasDriver) ? (globalSettings?.deliveryFee || 0) : 0;
    let totalPrice = basePrice + insurancePrice + driverPrice + deliveryFee;

    let discountAmount = 0;
    let promo = null;
    if (promoCodeId) {
      promo = await prisma.promoCode.findUnique({ where: { id: promoCodeId } });
      if (promo && promo.isActive) {
        if (promo.type === "percentage") {
          discountAmount = (totalPrice * promo.value) / 100;
          if (promo.maxDiscount && discountAmount > promo.maxDiscount) {
            discountAmount = promo.maxDiscount;
          }
        } else {
          discountAmount = promo.value;
        }
        totalPrice = Math.max(0, totalPrice - discountAmount);
      }
    }

    const depositPercentage = globalSettings ? globalSettings.depositPercentage : 0.3;
    const initialDepositAmount = Math.floor(totalPrice * depositPercentage);

    let walletDiscount = 0;
    if (walletAmount && walletAmount > 0) {
      const user = await prisma.user.findUnique({ where: { id: req.user.id } });
      if (user.walletBalance >= walletAmount) {
        walletDiscount = walletAmount;
        // NOTE: We no longer subtract walletDiscount from totalPrice here 
        // because totalPrice represents the trip cost before payments.
      } else {
        return res.status(400).json({ success: false, message: "رصيد المحفظة غير كافٍ" });
      }
    }

    const depositAmount = Math.max(0, initialDepositAmount - walletDiscount);
    
    // Determine initial payment status
    let initialPaymentStatus = "pending";
    if (walletDiscount >= totalPrice) {
      initialPaymentStatus = "paid";
    } else if (walletDiscount >= initialDepositAmount) {
      initialPaymentStatus = "verified"; // Covered deposit via wallet
    }

    const generateConfirmationCode = () => {
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789";
      let code = "";
      for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return code;
    };

    // Execute everything in a transaction for atomicity
    const result = await prisma.$transaction(async (tx) => {
      let confirmationCode = generateConfirmationCode();
      let isUnique = false;
      while (!isUnique) {
        const existing = await tx.booking.findUnique({ where: { confirmationCode } });
        if (!existing) {
          isUnique = true;
        } else {
          confirmationCode = generateConfirmationCode();
        }
      }

      // 1. Create the booking
      const newBooking = await tx.booking.create({
        data: {
          userId: req.user.id,
          carId: car.id,
          companyId: car.companyId,
          startDate: start,
          endDate: end,
          totalDays,
          pricePerDay: currentPrice,
          totalPrice,
          deposit: depositAmount,
          status: (initialPaymentStatus === "paid" || initialPaymentStatus === "verified") ? "confirmed" : "pending",
          paymentStatus: initialPaymentStatus,
          confirmationCode,
          pickupLocation: pickupLocation || "مكتب الشركة",
          dropoffLocation: dropoffLocation || "مكتب الشركة",
          pickupLat: pickupLat ? parseFloat(pickupLat) : null,
          pickupLng: pickupLng ? parseFloat(pickupLng) : null,
          dropoffLat: dropoffLat ? parseFloat(dropoffLat) : null,
          dropoffLng: dropoffLng ? parseFloat(dropoffLng) : null,
          driverLicense,
          insurance: Boolean(useInsurance),
          insurancePrice: insurancePrice,
          walletDiscount: walletDiscount,
          hasDriver: hasDriver || false,
          driverPrice: driverPrice,
          driverDailyHours: globalSettings?.driverDailyHours || 8,
          driverOvertimePrice: globalSettings?.driverOvertimePrice || 0,
          deliveryFee: (pickupLocation && pickupLocation !== "مكتب الشركة الرئيسي" && !hasDriver) ? (globalSettings?.deliveryFee || 0) : 0,
          promoCodeId: promoCodeId,
          discountAmount: discountAmount,
        },
        include: {
          user: { select: { name: true, phone: true } },
          car: { select: { model: true, images: true, licensePlate: true, pricePerDay: true } },
          company: { select: { name: true, address: true, phone: true } }
        }
      });

      // 2. Decrement wallet if used
      let updatedUser = null;
      if (walletDiscount > 0) {
        updatedUser = await tx.user.update({
          where: { id: req.user.id },
          data: { walletBalance: { decrement: walletDiscount } }
        });
      }

      // 3. Increment promo code usage if used
      if (promoCodeId && promo) {
        await tx.promoCode.update({
          where: { id: promoCodeId },
          data: { usedCount: { increment: 1 } }
        });
      }

      return { booking: newBooking, user: updatedUser };
    });

    res.status(201).json({ success: true, booking: result.booking, user: result.user });

    // Send Notifications (Non-blocking)
    const booking = result.booking;
    // 1. Notify User
    const isConfirmed = booking.status === "confirmed";
    notifyUser({
      userId: booking.userId,
      title: isConfirmed ? "تم تأكيد الحجز بنجاح! ✅" : "تم استلام طلب الحجز 🚗",
      message: isConfirmed 
        ? `تم تأكيد حجزك للسيارة ${booking.car.model} بنجاح. يمكنك مراجعة التفاصيل في قائمة حجوزاتك.`
        : `تم استلام طلب حجزك للسيارة ${booking.car.model}. سنقوم بإشعارك عند تأكيد الحجز من قبل الشركة.`,
      type: "booking",
      relatedBooking: booking.id,
      relatedCompany: booking.companyId
    });

    // 2. Notify Company Users
    prisma.user.findMany({
      where: { companyId: booking.companyId, role: "company" },
      select: { id: true }
    }).then(companyUsers => {
      companyUsers.forEach(admin => {
        notifyUser({
          userId: admin.id,
          title: "حجز جديد وارد! 🔔",
          message: `لديك طلب حجز جديد للسيارة ${booking.car.model} من المستخدم ${booking.user.name}.`,
          type: "booking",
          relatedBooking: booking.id,
          relatedCompany: booking.companyId
        });
      });
    });
  } catch (error) {
    console.error("Booking Creation Error:", error);
    res.status(500).json({ success: false, message: error.message || "حدث خطأ أثناء إتمام الحجز" });
  }
};

export const getReservedDates = async (req, res) => {
  try {
    const { carId } = req.params;
    const bookings = await prisma.booking.findMany({
      where: {
        carId: Number(carId),
        status: { in: ["pending", "pending_verification", "confirmed", "on_trip"] }
      },
      select: { startDate: true, endDate: true }
    });
    res.status(200).json({ success: true, reservedDates: bookings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getUserBookings = async (req, res) => {
  try {
    const bookings = await prisma.booking.findMany({
      where: { userId: req.user.id },
      include: {
        car: { select: { model: true, images: true, licensePlate: true, pricePerDay: true } },
        company: { select: { name: true, address: true, phone: true } },
        driver: { select: { name: true, phone: true, image: true } }
      },
      orderBy: { createdAt: "desc" }
    });
    res.status(200).json({ success: true, bookings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const cancelBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    const booking = await prisma.booking.findUnique({ 
      where: { id: Number(id) },
      include: { user: true, car: true }
    });

    if (!booking) return res.status(404).json({ success: false, message: "الحجز غير موجود" });
    if (booking.userId !== req.user.id) return res.status(403).json({ success: false, message: "غير مصرح لك" });
    if (booking.status === "cancelled") return res.status(400).json({ success: false, message: "الحجز ملغي بالفعل" });
    if (booking.status === "completed") return res.status(400).json({ success: false, message: "لا يمكن إلغاء حجز مكتمل" });
    if (booking.status === "on_trip") return res.status(400).json({ success: false, message: "لا يمكن إلغاء حجز أثناء الرحلة" });

    let refundAmount = 0;
    let message = "تم الإلغاء بنجاح";

    // جلب الإعدادات الحالية من قاعدة البيانات
    const settings = await prisma.setting.findFirst({ orderBy: { createdAt: "desc" } });
    const refundPercentage = settings?.cancellationRefundPercentage ?? 0.5;

    // إذا كان المستخدم قد دفع (عربون أو كامل المبلغ)
    if (booking.paymentStatus === "paid" || booking.paymentStatus === "partial" || booking.paymentStatus === "verified") {
      // استرداد النسبة المحددة من العربون
      refundAmount = booking.deposit * refundPercentage;
    }

    const operations = [
      prisma.booking.update({
        where: { id: Number(id) },
        data: {
          status: "cancelled",
          refundStatus: refundAmount > 0 ? "pending" : null,
          refundAmount: refundAmount > 0 ? refundAmount : 0,
          updatedAt: new Date()
        },
        include: { car: true }
      })
    ];

    message = "تم إلغاء الحجز بنجاح. سيتم مراجعة استرداد المبلغ من قبل الإدارة.";
    if (refundAmount === 0) {
      message = "تم إلغاء الحجز بنجاح.";
    }

    const results = await prisma.$transaction(operations);
    const updatedBooking = results[0];

    // Send Notification using service
    notifyUser({
      userId: booking.userId,
      title: "تم إلغاء الحجز ❌",
      message: refundAmount > 0 
        ? `تم إلغاء حجزك #${booking.confirmationCode}. طلب استرداد المبلغ (${refundAmount.toLocaleString()} د.ع) قيد المراجعة الآن.`
        : `تم إلغاء حجزك #${booking.confirmationCode} بنجاح.`,
      type: "booking",
      relatedBooking: booking.id
    });

    res.status(200).json({ 
      success: true, 
      message,
      booking: updatedBooking,
      refundAmount
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getBookingDetails = async (req, res) => {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        car: true,
        company: true,
        user: { select: { name: true, phone: true, profileImage: true } }
      }
    });
    if (!booking) return res.status(404).json({ success: false, message: "الحجز غير موجود" });
    res.status(200).json({ success: true, booking });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getBookings = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    let where = status ? { status } : {};
    if (req.user.role === "company") where.companyId = req.user.companyId;

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        skip,
        take: Number(limit),
        include: { user: { select: { name: true } }, car: { select: { model: true, images: true } }, company: { select: { name: true } } },
        orderBy: { createdAt: "desc" }
      }),
      prisma.booking.count({ where })
    ]);

    res.status(200).json({
      success: true,
      bookings,
      pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / limit) }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getBooking = async (req, res) => {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        user: { select: { name: true, phone: true } },
        car: { select: { model: true, images: true, licensePlate: true } },
        company: { select: { name: true, address: true, phone: true } }
      }
    });
    if (!booking) return res.status(404).json({ success: false, message: "الحجز غير موجود" });
    res.status(200).json({ success: true, booking });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const { startDate, endDate, pickupLocation, dropoffLocation } = req.body;
    const booking = await prisma.booking.findUnique({ where: { id: Number(id) } });
    if (!booking) return res.status(404).json({ success: false, message: "الحجز غير موجود" });
    if (booking.userId !== req.user.id) return res.status(403).json({ success: false, message: "غير مصرح لك" });
    if (booking.status !== "pending") return res.status(400).json({ success: false, message: "لا يمكن تعديل الحجز بعد تأكيده" });

    const updatedBooking = await prisma.booking.update({
      where: { id: Number(id) },
      data: {
        startDate: startDate ? new Date(startDate) : booking.startDate,
        endDate: endDate ? new Date(endDate) : booking.endDate,
        pickupLocation: pickupLocation || booking.pickupLocation,
        dropoffLocation: dropoffLocation || booking.dropoffLocation
      }
    });
    res.status(200).json({ success: true, booking: updatedBooking });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const confirmBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const booking = await prisma.booking.findUnique({ where: { id: Number(id) } });
    if (!booking) return res.status(404).json({ success: false, message: "الحجز غير موجود" });
    if (req.user.role === "company" && booking.companyId !== req.user.companyId) return res.status(403).json({ success: false, message: "غير مصرح لك" });

    const updated = await prisma.booking.update({
      where: { id: Number(id) },
      data: { status: "confirmed" },
      include: { user: true, car: true, company: true }
    });
    res.status(200).json({ success: true, booking: updated });

    // Notify User
    notifyUser({
      userId: updated.userId,
      title: "تم تأكيد حجزك! ✅",
      message: `مبروك! تم تأكيد حجزك للسيارة ${updated.car.model}. يمكنك الآن متابعة تفاصيل الرحلة.`,
      type: "booking",
      relatedBooking: updated.id,
      relatedCompany: updated.companyId
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const completeBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const booking = await prisma.booking.findUnique({ where: { id: Number(id) } });
    if (!booking) return res.status(404).json({ success: false, message: "الحجز غير موجود" });
    
    const defaultSettings = { cashbackPercentage: 5 };
    const settings = await prisma.setting.findFirst({ orderBy: { createdAt: "desc" } }) || defaultSettings;
    const cashbackAmount = (booking.totalPrice * settings.cashbackPercentage) / 100;

    const result = await prisma.$transaction([
      prisma.booking.update({
        where: { id: Number(id) },
        data: {
          status: "completed",
          cashbackAddedAfterCompletion: true,
          cashbackAfterCompletion: cashbackAmount,
          cashbackAfterCompletionAddedAt: new Date()
        }
      }),
      prisma.user.update({
        where: { id: booking.userId },
        data: { walletBalance: { increment: cashbackAmount } }
      })
    ]);
    res.status(200).json({ success: true, booking: result[0], cashbackAmount });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getCompanyBookings = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { page = 1, limit = 10, status } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const where = { companyId: Number(companyId) };
    if (status) where.status = status;

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        skip,
        take: Number(limit),
        include: { user: { select: { name: true, phone: true } }, car: { select: { model: true, licensePlate: true } } },
        orderBy: { createdAt: "desc" }
      }),
      prisma.booking.count({ where })
    ]);
    res.status(200).json({ success: true, bookings, total });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const confirmDeposit = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await prisma.booking.update({
      where: { id: Number(id) },
      data: {
        status: "confirmed",
        paymentStatus: "partial",
        updatedAt: new Date()
      }
    });
    res.status(200).json({ success: true, booking: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const completePayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { transactionId } = req.body;
    const booking = await prisma.booking.findUnique({ where: { id: Number(id) } });
    if (!booking) return res.status(404).json({ success: false, message: "الحجز غير موجود" });

    const updated = await prisma.booking.update({
      where: { id: Number(id) },
      data: {
        paymentStatus: "completed",
        status: "confirmed",
        updatedAt: new Date()
      }
    });
    res.status(200).json({ success: true, booking: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const processExpiredBookingsCashback = async (req, res) => {
  try {
    const today = new Date();
    const expiredBookings = await prisma.booking.findMany({
      where: { endDate: { lt: today }, status: "confirmed", cashbackAddedAfterCompletion: false }
    });

    const defaultSettings = { cashbackPercentage: 5 };
    const settings = await prisma.setting.findFirst({ orderBy: { createdAt: "desc" } }) || defaultSettings;

    for (const booking of expiredBookings) {
      const cashbackAmount = (booking.totalPrice * settings.cashbackPercentage) / 100;
      await prisma.$transaction([
        prisma.user.update({ where: { id: booking.userId }, data: { walletBalance: { increment: cashbackAmount } } }),
        prisma.booking.update({ where: { id: booking.id }, data: { cashbackAddedAfterCompletion: true, cashbackAfterCompletion: cashbackAmount } })
      ]);
    }
    res.status(200).json({ success: true, processed: expiredBookings.length });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const addManualCashbackAfterCompletion = async (req, res) => {
  try {
    const { id } = req.params;
    const { cashbackPercentage } = req.body;
    const booking = await prisma.booking.findUnique({ where: { id: Number(id) } });
    if (!booking || booking.status !== "completed") return res.status(400).json({ success: false, message: "الحجز غير مكتمل" });

    const defaultSettings = { cashbackPercentage: 5 };
    const settings = await prisma.setting.findFirst({ orderBy: { createdAt: "desc" } }) || defaultSettings;
    
    const finalPercentage = cashbackPercentage || settings.cashbackPercentage;
    const amount = (booking.totalPrice * finalPercentage) / 100;

    await prisma.$transaction([
      prisma.user.update({ where: { id: booking.userId }, data: { walletBalance: { increment: amount } } }),
      prisma.booking.update({ where: { id: booking.id }, data: { cashbackAddedAfterCompletion: true, cashbackAfterCompletion: amount } })
    ]);
    res.status(200).json({ success: true, amount });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};