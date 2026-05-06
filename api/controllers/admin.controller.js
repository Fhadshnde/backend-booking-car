import { prisma } from "../lib/prisma.js";
import { notifyUser } from "../services/notification.service.js";

export const getAdminDashboard = async (req, res) => {
  try {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const [
      usersStats,
      companiesStats,
      carsStats,
      bookingsStats,
      walletStats,
      topCompanies,
      topCars,
      recentBookings,
      pendingKycCount,
      monthlyReports
    ] = await Promise.all([
      // 1. إحصائيات المستخدمين
      prisma.user.aggregate({
        _count: { id: true },
        where: { role: "user" }
      }),
      // 2. إحصائيات الشركات
      prisma.company.aggregate({
        _count: { id: true },
        where: { isApproved: true }
      }),
      // 3. إحصائيات السيارات
      prisma.car.aggregate({
        _count: { id: true },
        where: { isAvailable: true, isSuspended: false }
      }),
      // 4. إحصائيات الحجوزات والوضع المالي
      prisma.booking.aggregate({
        _count: { id: true },
        _sum: { totalPrice: true },
        where: { status: "completed" }
      }),
      // 5. إحصائيات المحفظة (إجمالي أرصدة المستخدمين)
      prisma.user.aggregate({
        _sum: { walletBalance: true }
      }),
      // 6. أفضل 5 شركات من حيث الحجوزات
      prisma.company.findMany({
        take: 5,
        orderBy: { bookings: { _count: 'desc' } },
        select: {
          id: true,
          name: true,
          logo: true,
          _count: { select: { bookings: true } }
        }
      }),
      // 7. أفضل 5 سيارات مطلوبة
      prisma.car.findMany({
        take: 5,
        orderBy: { totalBookings: "desc" },
        include: { company: { select: { name: true } } }
      }),
      // 8. آخر 10 حجوزات
      prisma.booking.findMany({
        take: 10,
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { name: true } },
          car: { select: { brand: { select: { name: true } }, model: true } },
          company: { select: { name: true } }
        }
      }),
      // 9. عدد طلبات توثيق الهوية المعلقة
      prisma.user.count({ where: { identityStatus: "pending" } }),
      // 10. التقارير الشهرية (Revenue Growth)
      prisma.$queryRaw`
        SELECT 
          EXTRACT(YEAR FROM "createdAt") as year,
          EXTRACT(MONTH FROM "createdAt") as month,
          COUNT(id) as bookings,
          SUM("totalPrice") as revenue
        FROM "Booking"
        WHERE "createdAt" >= ${sixMonthsAgo} AND status = 'completed'
        GROUP BY year, month
        ORDER BY year DESC, month DESC
      `
    ]);

    res.status(200).json({
      success: true,
      dashboard: {
        stats: {
          totalUsers: usersStats._count.id,
          activeCompanies: companiesStats._count.id,
          availableCars: carsStats._count.id,
          completedBookings: bookingsStats._count.id,
          totalRevenue: Number(bookingsStats._sum.totalPrice || 0),
          totalWalletBalance: Number(walletStats._sum.walletBalance || 0),
          pendingKyc: pendingKycCount
        },
        topCompanies: topCompanies.map(c => ({
          id: c.id,
          name: c.name,
          logo: c.logo,
          bookingCount: c._count.bookings
        })),
        topCars,
        recentBookings,
        monthlyReports
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const toggleUserStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await prisma.user.findUnique({ where: { id: parseInt(userId) } });

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const updatedUser = await prisma.user.update({
      where: { id: parseInt(userId) },
      data: { isActive: !user.isActive }
    });

    res.status(200).json({
      success: true,
      message: updatedUser.isActive ? "User activated" : "User disabled",
      user: updatedUser
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const approveCompany = async (req, res) => {
  try {
    const { companyId } = req.params;
    const id = parseInt(companyId);

    const company = await prisma.company.findUnique({ where: { id } });
    if (!company) {
      return res.status(404).json({ success: false, message: "Company not found" });
    }

    const updatedCompany = await prisma.company.update({
      where: { id },
      data: {
        isApproved: true,
        isRejected: false,
        approvedAt: new Date(),
        rejectionReason: null
      }
    });

    await prisma.user.updateMany({
      where: { companyId: id },
      data: { role: "company" }
    });

    // Notify all users in this company
    const users = await prisma.user.findMany({ where: { companyId: id }, select: { id: true } });
    users.forEach(u => {
      notifyUser({
        userId: u.id,
        title: "تهانينا! تم قبول شركتكم 🎊",
        message: `تمت الموافقة على انضمام شركة "${updatedCompany.name}" إلى منصتنا. يمكنك الآن البدء في إضافة سياراتك.`,
        type: "general"
      });
    });

    res.status(200).json({
      success: true,
      message: "Company approved successfully",
      company: updatedCompany
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const rejectCompany = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { rejectionReason } = req.body;

    if (!rejectionReason) {
      return res.status(400).json({ success: false, message: "Rejection reason required" });
    }

    const updatedCompany = await prisma.company.update({
      where: { id: parseInt(companyId) },
      data: {
        isRejected: true,
        isApproved: false,
        rejectionReason: rejectionReason
      }
    });

    res.status(200).json({
      success: true,
      message: "Company rejected successfully",
      company: updatedCompany
    });

    // Notify users in the company
    const users = await prisma.user.findMany({ where: { companyId: parseInt(companyId) }, select: { id: true } });
    users.forEach(u => {
      notifyUser({
        userId: u.id,
        title: "نعتذر، تم رفض طلب الشركة ❌",
        message: `تم رفض طلب انضمام شركتك. السبب: ${rejectionReason}`,
        type: "general"
      });
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getPendingCompanies = async (req, res) => {
  try {
    const pendingCompanies = await prisma.company.findMany({
      where: { isApproved: false, isRejected: false },
      include: { users: { select: { name: true, phone: true } } }
    });

    res.status(200).json({ success: true, pendingCompanies });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getBookings = async (req, res) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    let where = {};
    if (status && status !== 'all') where.status = status;
    if (search) {
      where.OR = [
        { user: { name: { contains: search, mode: 'insensitive' } } },
        { user: { phone: { contains: search } } },
        { confirmationCode: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { name: true, phone: true, avatar: true } },
          car: { 
            include: { 
              brand: { select: { name: true } }
            } 
          },
          company: { select: { name: true, logo: true } }
        }
      }),
      prisma.booking.count({ where })
    ]);

    res.status(200).json({ success: true, data: bookings, total });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const cancelBookingAdmin = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { reason } = req.body;
    const id = parseInt(bookingId);

    const booking = await prisma.booking.findUnique({ where: { id } });
    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    const updatedBooking = await prisma.booking.update({
      where: { id },
      data: {
        status: "cancelled",
        updatedAt: new Date()
      }
    });

    const otherActiveBookings = await prisma.booking.count({
      where: {
        carId: booking.carId,
        status: { in: ["confirmed", "pending"] },
        NOT: { id: id }
      }
    });

    if (otherActiveBookings === 0) {
      await prisma.car.update({
        where: { id: booking.carId },
        data: { isAvailable: true }
      });
    }

    res.status(200).json({
      success: true,
      message: "Booking cancelled successfully",
      booking: updatedBooking
    });

    // Notify User
    notifyUser({
      userId: booking.userId,
      title: "تنبيه: تم إلغاء حجزك من قبل الإدارة ⚠️",
      message: `تم إلغاء حجزك #${booking.confirmationCode}. السبب: ${reason || "غير محدد"}`,
      type: "booking",
      relatedBooking: booking.id
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getBookingReports = async (req, res) => {
  try {
    const { startDate, endDate, status } = req.query;
    let where = {};

    if (startDate && endDate) {
      where.createdAt = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }

    if (status) {
      where.status = status;
    }

    const bookings = await prisma.booking.findMany({
      where,
      include: {
        user: { select: { name: true } },
        car: { select: { brand: { select: { name: true } }, model: true } },
        company: { select: { name: true } }
      }
    });

    const report = {
      totalBookings: bookings.length,
      totalRevenue: bookings.reduce((sum, b) => sum + b.totalPrice, 0),
      bookingsByStatus: {
        pending: bookings.filter(b => b.status === "pending").length,
        confirmed: bookings.filter(b => b.status === "confirmed").length,
        completed: bookings.filter(b => b.status === "completed").length,
        cancelled: bookings.filter(b => b.status === "cancelled").length
      },
      bookings
    };

    res.status(200).json({ success: true, report });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const suspendCar = async (req, res) => {
  try {
    const { carId } = req.params;
    const { reason } = req.body;

    const car = await prisma.car.update({
      where: { id: parseInt(carId) },
      data: {
        isSuspended: true,
        isAvailable: false
      }
    });

    res.status(200).json({
      success: true,
      message: "Car suspended successfully",
      car
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const unsuspendCar = async (req, res) => {
  try {
    const { carId } = req.params;

    const car = await prisma.car.update({
      where: { id: parseInt(carId) },
      data: {
        isSuspended: false,
        isAvailable: true
      }
    });
    res.status(200).json({
      success: true,
      message: "Car unsuspended successfully",
      car
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const approveRefund = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const id = parseInt(bookingId);

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { user: true }
    });

    if (!booking || booking.refundStatus !== "pending") {
      return res.status(400).json({ success: false, message: "لا يوجد طلب استرداد معلق لهذا الحجز" });
    }

    const refundAmount = booking.refundAmount || 0;

    await prisma.$transaction([
      prisma.booking.update({
        where: { id },
        data: {
          refundStatus: "approved",
          refundDate: new Date()
        }
      }),
      prisma.user.update({
        where: { id: booking.userId },
        data: { walletBalance: { increment: refundAmount } }
      })
    ]);

    notifyUser({
      userId: booking.userId,
      title: "تمت الموافقة على استرداد المبلغ ✅",
      message: `تمت الموافقة على استرداد ${refundAmount.toLocaleString()} د.ع إلى محفظتك للحجز #${booking.confirmationCode}.`,
      type: "wallet",
      relatedBooking: booking.id
    });

    res.status(200).json({ success: true, message: "تمت الموافقة على الاسترداد بنجاح" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const rejectRefund = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { reason } = req.body;
    const id = parseInt(bookingId);

    const booking = await prisma.booking.findUnique({ where: { id } });

    if (!booking || booking.refundStatus !== "pending") {
      return res.status(400).json({ success: false, message: "لا يوجد طلب استرداد معلق لهذا الحجز" });
    }

    await prisma.booking.update({
      where: { id },
      data: {
        refundStatus: "rejected",
        updatedAt: new Date()
      }
    });

    notifyUser({
      userId: booking.userId,
      title: "تم رفض طلب استرداد المبلغ ❌",
      message: `نعتذر، تم رفض طلب استرداد المبلغ للحجز #${booking.confirmationCode}. السبب: ${reason || "غير محدد"}.`,
      type: "booking",
      relatedBooking: booking.id
    });

    res.status(200).json({ success: true, message: "تم رفض طلب الاسترداد" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getComplaints = async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      message: "Complaints system coming soon",
      complaints: []
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const respondToComplaint = async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      message: "Response sent successfully"
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// --- KYC Management ---

export const getUsers = async (req, res) => {
  try {
    const { page = 1, limit = 20, role, search } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    let where = {};
    if (role && role !== 'all') where.role = role;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } }
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          phone: true,
          role: true,
          isActive: true,
          walletBalance: true,
          identityStatus: true,
          companyId: true,
          createdAt: true
        }
      }),
      prisma.user.count({ where })
    ]);

    res.status(200).json({ success: true, data: users, total });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await prisma.user.findUnique({
      where: { id: parseInt(id) },
      include: {
        company: true
      }
    });
    if (!user) return res.status(404).json({ success: false, message: "المستخدم غير موجود" });
    res.status(200).json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * تحديث بيانات مستخدم (تغيير الرتبة مثلاً)
 */
export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, isActive } = req.body;

    const user = await prisma.user.update({
      where: { id: parseInt(id) },
      data: { role, isActive },
      select: {
        id: true,
        name: true,
        role: true,
        isActive: true
      }
    });

    res.status(200).json({ success: true, message: "تم تحديث البيانات بنجاح", user });
  } catch (error) {
    res.status(500).json({ success: false, message: "فشل في تحديث بيانات المستخدم" });
  }
};

export const getCarsAdmin = async (req, res) => {
  try {
    const { search, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    let where = {};
    if (search) {
      where.OR = [
        { model: { contains: search, mode: 'insensitive' } },
        { licensePlate: { contains: search, mode: 'insensitive' } },
        { company: { name: { contains: search, mode: 'insensitive' } } }
      ];
    }

    const [cars, total] = await Promise.all([
      prisma.car.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          company: { select: { name: true, logo: true, city: true } },
          brand: { select: { name: true, logo: true } },
          category: { select: { name: true, icon: true } }
        }
      }),
      prisma.car.count({ where })
    ]);

    res.status(200).json({ success: true, data: cars, total });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getPendingKyc = async (req, res) => {
  try {
    const pendingUsers = await prisma.user.findMany({
      where: { identityStatus: "pending" },
      select: {
        id: true,
        name: true,
        phone: true,
        idNumber: true,
        idExpiry: true,
        idCardImage: true,
        licenseNumber: true,
        licenseExpiry: true,
        driverLicenseImage: true,
        createdAt: true
      }
    });

    res.status(200).json({ success: true, pendingUsers });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const approveKyc = async (req, res) => {
  try {
    const { userId } = req.params;
    const id = parseInt(userId);

    const user = await prisma.user.update({
      where: { id },
      data: {
        identityStatus: "verified", // or "approved"
        updatedAt: new Date()
      }
    });

    notifyUser({
      userId: id,
      title: "تم توثيق هويتك بنجاح! ✅",
      message: "تهانينا، تم قبول مستنداتك وتوثيق حسابك. يمكنك الآن الحجز بكل سهولة.",
      type: "general"
    });

    // Check if user has any bookings waiting for this verification
    const pendingBookings = await prisma.booking.findMany({
      where: { userId: id, status: "pending_document_review" }
    });

    // Automatically confirm bookings that were pending review if they are paid
    for (const booking of pendingBookings) {
      if (booking.paymentStatus === "paid" || booking.paymentStatus === "verified") {
        await prisma.booking.update({
          where: { id: booking.id },
          data: { status: "confirmed" }
        });
      }
    }

    res.status(200).json({ success: true, message: "User KYC approved", user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const rejectKyc = async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;
    const id = parseInt(userId);

    const user = await prisma.user.update({
      where: { id },
      data: {
        identityStatus: "rejected",
        updatedAt: new Date()
      }
    });

    notifyUser({
      userId: id,
      title: "تم رفض مستندات التوثيق ❌",
      message: `نعتذر، لم يتم قبول مستنداتك. السبب: ${reason || "يرجى إعادة رفع صور واضحة"}.`,
      type: "general"
    });

    res.status(200).json({ success: true, message: "User KYC rejected", user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
export const approveKycByPhone = async (req, res) => {
  try {
    const { phone } = req.params;

    const user = await prisma.user.findUnique({ where: { phone } });
    if (!user) {
      return res.status(404).json({ success: false, message: "المستخدم غير موجود" });
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        identityStatus: "verified",
        updatedAt: new Date()
      }
    });

    notifyUser({
      userId: user.id,
      title: "تم توثيق هويتك بنجاح! ✅",
      message: "تهانينا، تم قبول مستنداتك وتوثيق حسابك. يمكنك الآن الحجز بكل سهولة.",
      type: "general"
    });

    // Check if user has any bookings waiting for this verification
    const pendingBookings = await prisma.booking.findMany({
      where: { userId: user.id, status: "pending_document_review" }
    });

    for (const booking of pendingBookings) {
      if (booking.paymentStatus === "paid" || booking.paymentStatus === "verified") {
        await prisma.booking.update({
          where: { id: booking.id },
          data: { status: "confirmed" }
        });
      }
    }

    res.status(200).json({ success: true, message: "User KYC approved via phone", user: updatedUser });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * إدارة رصيد المحفظة يدوياً من قبل الأدمن
 */
export const manualWalletTransaction = async (req, res) => {
  try {
    const { userId } = req.params;
    const { amount, type, reason } = req.body; // type: 'credit' or 'debit'

    const amountNum = parseFloat(amount);
    const updateData = type === 'credit' 
      ? { increment: amountNum } 
      : { decrement: amountNum };

    const user = await prisma.user.update({
      where: { id: parseInt(userId) },
      data: { walletBalance: updateData }
    });
    
    notifyUser({
      userId: user.id,
      title: type === 'credit' ? "تم إيداع مبلغ في محفظتك" : "تم خصم مبلغ من محفظتك",
      message: `قام المسؤول بـ ${type === 'credit' ? 'إضافة' : 'خصم'} مبلغ ${amountNum.toLocaleString()} د.ع لسبب: ${reason || 'تسوية إدارية'}`,
      type: "wallet"
    });

    res.status(200).json({ success: true, message: "تم تحديث الرصيد بنجاح", balance: user.walletBalance });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * إنشاء شركة جديدة يدوياً من قبل الأدمن
 */
export const createCompany = async (req, res) => {
  try {
    const { 
      name, address, city, logo, phone, licenseNumber, description, ownerId,
      email, website, facebook, instagram, taxNumber, workingHoursOpen, workingHoursClose,
      percentage, fixedAmount 
    } = req.body;

    if (!ownerId) {
      return res.status(400).json({ success: false, message: "يجب اختيار صاحب للشركة" });
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. إنشاء الشركة بكافة الحقول
      const company = await tx.company.create({
        data: {
          name, address, city, 
          logo: req.file ? `/uploads/${req.file.filename}` : logo,
          phone, licenseNumber, description,
          email, website, facebook, instagram, taxNumber, workingHoursOpen, workingHoursClose,
          isApproved: true
        }
      });

      // 2. ربط المستخدم بالشركة وتغيير دوره
      await tx.user.update({
        where: { id: parseInt(ownerId) },
        data: { 
          companyId: company.id,
          role: 'company'
        }
      });

      // 3. إعداد سجل العمولة المالية بشكل آمن
      // نستخدم updateMany/create لضمان عدم وجود تكرار أو تعارض في المعرفات
      await tx.commission.create({
        data: {
          companyId: company.id,
          percentage: parseFloat(percentage) || 10,
          fixedAmount: parseFloat(fixedAmount) || 0,
          updatedBy: req.user?.id ? parseInt(req.user.id) : null
        }
      });

      return company;
    });

    res.status(201).json({ success: true, message: "تم إنشاء الشركة وإعداد العمولات بنجاح", company: result });
  } catch (error) {
    console.error("Commission Error:", error);
    res.status(500).json({ success: false, message: "حدث خطأ أثناء إعداد بيانات الشركة المالية، يرجى المحاولة مرة أخرى" });
  }
};

/**
 * تحديث بيانات شركة
 */
export const updateCompany = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      name, address, city, logo, phone, licenseNumber, description, ownerId,
      email, website, facebook, instagram, taxNumber, workingHoursOpen, workingHoursClose,
      percentage 
    } = req.body;

    const result = await prisma.$transaction(async (tx) => {
      // 1. تحديث بيانات الشركة
      const company = await tx.company.update({
        where: { id: parseInt(id) },
        data: {
          name, address, city, 
          logo: req.file ? `/uploads/${req.file.filename}` : logo,
          phone, licenseNumber, description,
          email, website, facebook, instagram, taxNumber, workingHoursOpen, workingHoursClose
        }
      });

      // 2. إذا تم اختيار صاحب شركة جديد
      if (ownerId) {
        // فك ارتباط أي مستخدم قديم بهذه الشركة (اختياري حسب منطق العمل)
        await tx.user.updateMany({
          where: { companyId: company.id },
          data: { companyId: null, role: 'user' }
        });

        // ربط المالك الجديد
        await tx.user.update({
          where: { id: parseInt(ownerId) },
          data: { companyId: company.id, role: 'company' }
        });
      }

      // 3. تحديث العمولة إذا تم إرسال نسبة جديدة
      if (percentage) {
        const existingComm = await tx.commission.findFirst({
          where: { companyId: company.id }
        });

        if (existingComm) {
          await tx.commission.update({
            where: { id: existingComm.id },
            data: { percentage: parseFloat(percentage) }
          });
        } else {
          await tx.commission.create({
            data: { 
              companyId: company.id, 
              percentage: parseFloat(percentage),
              updatedBy: req.user?.id ? parseInt(req.user.id) : null
            }
          });
        }
      }

      return company;
    });

    res.json({ success: true, message: "تم تحديث بيانات الشركة والعمولات بنجاح", company: result });
  } catch (error) {
    console.error("Update Company Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * حذف شركة
 */
export const deleteCompany = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.company.delete({
      where: { id: parseInt(id) }
    });
    res.status(200).json({ success: true, message: "تم حذف الشركة بنجاح" });
  } catch (error) {
    res.status(500).json({ success: false, message: "لا يمكن حذف الشركة لوجود بيانات مرتبطة بها" });
  }
};
