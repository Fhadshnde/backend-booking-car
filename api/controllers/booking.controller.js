import { prisma } from "../lib/prisma.js";
import { notifyUser } from "../services/notification.service.js";
import { calculateBookingBreakdown } from "../helpers/pricing.helper.js";

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
      driverLicense, // Still here for backward compatibility
      hasDriver,
      promoCodeId,
      digitalSignature,
      secondDriverName,
      secondDriverIdNumber,
      secondDriverLicenseNumber,
      secondDriverLicenseImage,
    } = req.body;

    if (!carId) {
      return res.status(400).json({ success: false, message: "معرف السيارة مطلوب" });
    }

    const parsedCarId = Number(carId);
    if (isNaN(parsedCarId)) {
      return res.status(400).json({ success: false, message: "معرف السيارة غير صالح" });
    }

    console.log("🚀 Starting Booking Creation...");
    // 1. التحقق من وجود السيارة والتأريخ
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
    const now = new Date();

    // 1. الأساسيات: التأكد من أن التواريخ صالحة وفي المستقبل
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ success: false, message: "تواريخ غير صالحة" });
    }

    if (start < new Date(now.getTime() - 5 * 60 * 1000)) { // السماح بـ 5 دقائق هامش
      return res.status(400).json({ success: false, message: "تاريخ البداية يجب أن يكون في المستقبل" });
    }

    if (end <= start) {
      return res.status(400).json({ success: false, message: "تاريخ الانتهاء يجب أن يكون بعد تاريخ البداية" });
    }

    console.log("🛡️ Checking security for user:", req.user.id);
    // 2. نظام التحقق المشروط (KYC Logic) & القائمة السوداء
    const [user, previousBookingsCount] = await Promise.all([
      prisma.user.findUnique({ where: { id: req.user.id } }),
      prisma.booking.count({ 
        where: { 
          userId: req.user.id, 
          status: { in: ["confirmed", "completed", "on_trip"] } 
        } 
      })
    ]);

    if (!user) {
      return res.status(404).json({ success: false, message: "المستخدم غير موجود" });
    }

    // أ. فحص الحظر المباشر على الحساب
    if (user.isBlacklisted) {
      return res.status(403).json({ 
        success: false, 
        message: `عذراً، لا يمكنك الحجز حالياً. السبب: ${user.blacklistReason || "مخالفة الشروط والأحكام"}` 
      });
    }

    // ب. فحص رقم الهوية في القائمة السوداء العامة
    if (user.idNumber) {
      const blacklisted = await prisma.blacklist.findUnique({ where: { idNumber: user.idNumber } });
      if (blacklisted) {
        return res.status(403).json({ 
          success: false, 
          message: `عذراً، تم حظر رقم الهوية هذا من النظام. السبب: ${blacklisted.reason || "غير محدد"}` 
        });
      }
    }

    if (hasDriver) {
      // تأجير بسائق: الهوية فقط
      if (user.identityStatus !== "verified") {
        return res.status(400).json({ 
          success: false, 
          message: "يرجى استكمال وثائق الهوية الشخصية لتتمكن من الحجز مع سائق",
          requireKYC: true 
        });
      }
    } else {
      // قيادة ذاتية: هوية + إجازة سوق
      if (user.identityStatus !== "verified" || !user.licenseNumber) {
        return res.status(400).json({ 
          success: false, 
          message: "يرجى استكمال وثائق الهوية وإجازة السوق لتتمكن من حجز سيارة للقيادة الذاتية",
          requireKYC: true 
        });
      }

      // التحقق من صلاحية الإجازة خلال فترة الحجز
      if (user.licenseExpiry && new Date(user.licenseExpiry) < end) {
        return res.status(400).json({ 
          success: false, 
          message: "عذراً، إجازة السوق الخاصة بك ستنتهي خلال فترة الحجز. يرجى تحديثها أولاً." 
        });
      }
    }

    // 3. التحقق من تضارب الحجوزات
    const conflictingBookings = await prisma.booking.findFirst({
      where: {
        carId: parsedCarId,
        status: { in: ["pending", "pending_verification", "confirmed", "on_trip", "pending_document_review"] },
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

    // 4. حساب المبالغ باستخدام الهيلبر الموحد
    let promo = null;
    if (promoCodeId) {
      promo = await prisma.promoCode.findUnique({ where: { id: Number(promoCodeId) } });
    }

    console.log("💰 Calculating breakdown for car:", car.id);
    const breakdown = await calculateBookingBreakdown({
      car,
      startDate: start,
      endDate: end,
      useInsurance: Boolean(useInsurance),
      hasDriver: Boolean(hasDriver),
      promoCodeId: promoCodeId ? Number(promoCodeId) : null,
      pickupLocation,
      walletAmount: Number(walletAmount || 0),
      userId: req.user.id
    });

    const {
      totalDays,
      pricePerDay,
      totalPrice,
      insurancePrice,
      driverPrice,
      deliveryFee,
      discountAmount,
      walletDiscount,
      remainingDeposit,
      paymentStatus
    } = breakdown;

    const generateConfirmationCode = () => {
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789";
      let code = "";
      for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return code;
    };

    // 1. Determine final status
    let finalStatus = "pending";
    // If user documents are pending OR it's their first booking, set to document review
    if (user.identityStatus === "pending" || previousBookingsCount === 0) {
      finalStatus = "pending_document_review";
    } else if (paymentStatus === "paid" || paymentStatus === "verified") {
      finalStatus = "confirmed";
    }

    // Execute everything in a transaction for atomicity
    console.log("📝 Executing transaction with status:", finalStatus);
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

      // 2. Create the booking
      const newBooking = await tx.booking.create({
        data: {
          userId: req.user.id,
          carId: car.id,
          companyId: car.companyId,
          startDate: start,
          endDate: end,
          totalDays,
          pricePerDay,
          totalPrice,
          deposit: remainingDeposit,
          status: finalStatus,
          paymentStatus,
          paymentMethod: walletDiscount >= totalPrice ? "wallet" : "cash",
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
          hasDriver: Boolean(hasDriver),
          driverPrice: driverPrice,
          deliveryFee: deliveryFee,
          promoCodeId: promoCodeId ? Number(promoCodeId) : null,
          discountAmount: discountAmount,
          digitalSignature: digitalSignature || null,
          secondDriverName: secondDriverName || null,
          secondDriverIdNumber: secondDriverIdNumber || null,
          secondDriverLicenseNumber: secondDriverLicenseNumber || null,
          secondDriverLicenseImage: secondDriverLicenseImage || null,
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
    console.error("❌ Booking Creation Error Details:", {
      message: error.message,
      stack: error.stack,
      userId: req.user?.id,
      body: req.body
    });
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

    // حساب العربون الإجمالي المطلوب (عادة 30%)
    const depositPercentage = settings?.depositPercentage ?? 0.3;
    const totalRequiredDeposit = Math.floor(booking.totalPrice * depositPercentage);

    // إذا كان المستخدم قد دفع (عربون أو كامل المبلغ)
    if (booking.paymentStatus === "paid" || booking.paymentStatus === "verified") {
      // استرداد النسبة المحددة من العربون الذي تم دفعه بالفعل
      // نعتبر أن العربون المدفوع هو totalRequiredDeposit
      refundAmount = totalRequiredDeposit * refundPercentage;
    } else if (booking.paymentStatus === "partial") {
       // في حالة الدفع الجزئي، نعتمد على ما تم خصمه من المحفظة حتى الآن كدليل
       const amountPaid = booking.walletDiscount || 0;
       refundAmount = amountPaid * refundPercentage;
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
        user: { select: { name: true, phone: true, profileImage: true, idNumber: true, licenseNumber: true, identityStatus: true } }
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
    const { page = 1, limit = 10, status, paymentMethod } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    let where = {};
    if (status) where.status = status;
    if (paymentMethod) where.paymentMethod = paymentMethod;
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

    const start = startDate ? new Date(startDate) : new Date(booking.startDate);
    const end = endDate ? new Date(endDate) : new Date(booking.endDate);
    const now = new Date();

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ success: false, message: "تواريخ غير صالحة" });
    }

    if (startDate && start < new Date(now.getTime() - 5 * 60 * 1000)) {
      return res.status(400).json({ success: false, message: "تاريخ البداية يجب أن يكون في المستقبل" });
    }

    if (end <= start) {
      return res.status(400).json({ success: false, message: "تاريخ الانتهاء يجب أن يكون بعد تاريخ البداية" });
    }

    const updatedBooking = await prisma.booking.update({
      where: { id: Number(id) },
      data: {
        startDate: start,
        endDate: end,
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
    const { paymentReceived = false } = req.body; // خيار لتأكيد استلام المبلغ نقداً
    
    const booking = await prisma.booking.findUnique({ where: { id: Number(id) } });
    if (!booking) return res.status(404).json({ success: false, message: "الحجز غير موجود" });
    
    // فحص الصلاحيات
    if (req.user.role === "company" && booking.companyId !== req.user.companyId) {
      return res.status(403).json({ success: false, message: "غير مصرح لك بتأكيد هذا الحجز" });
    }

    const updated = await prisma.booking.update({
      where: { id: Number(id) },
      data: { 
        status: "confirmed",
        paymentStatus: paymentReceived ? "verified" : booking.paymentStatus,
        updatedAt: new Date()
      },
      include: { user: true, car: true, company: true }
    });

    // Notify User
    notifyUser({
      userId: updated.userId,
      title: "تم تأكيد حجزك! ✅",
      message: `مبروك! تم تأكيد حجزك للسيارة ${updated.car.model}. ${paymentReceived ? "تم تأكيد استلام العربون نقداً." : ""}`,
      type: "booking",
      relatedBooking: updated.id,
      relatedCompany: updated.companyId
    });

    res.status(200).json({ success: true, message: "تم تأكيد الحجز بنجاح", booking: updated });
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