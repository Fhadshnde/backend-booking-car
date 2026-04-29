import { prisma } from "../lib/prisma.js";
import { notifyUser } from "../services/notification.service.js";

export const getAdminDashboard = async (req, res) => {
  try {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const [
      totalUsers,
      activeUsers,
      totalCompanies,
      approvedCompanies,
      totalCars,
      availableCars,
      totalBookings,
      totalRevenue,
      commissionStats,
      topCars,
      recentBookings,
      pendingCompanies,
      bookingsByStatus
    ] = await Promise.all([
      prisma.user.count({ where: { role: "user" } }),
      prisma.user.count({ where: { role: "user", isActive: true } }),
      prisma.company.count(),
      prisma.company.count({ where: { isApproved: true } }),
      prisma.car.count(),
      prisma.car.count({ where: { isAvailable: true, isSuspended: false } }),
      prisma.booking.count(),
      prisma.booking.aggregate({
        where: { paymentStatus: "completed" },
        _sum: { totalPrice: true }
      }),
      prisma.commission.aggregate({
        _count: { id: true },
        _avg: { percentage: true, fixedAmount: true }
      }),
      prisma.car.findMany({
        take: 5,
        orderBy: { totalBookings: "desc" },
        include: { company: { select: { name: true } } }
      }),
      prisma.booking.findMany({
        take: 10,
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { name: true } },
          car: { select: { brand: { select: { name: true } }, model: true } },
          company: { select: { name: true } }
        }
      }),
      prisma.company.findMany({
        where: { isApproved: false, isRejected: false },
        include: { users: { take: 1, select: { name: true } } }
      }),
      prisma.booking.groupBy({
        by: ["status"],
        _count: { id: true }
      })
    ]);

    const monthlyData = await prisma.$queryRaw`
      SELECT 
        EXTRACT(YEAR FROM "createdAt") as year,
        EXTRACT(MONTH FROM "createdAt") as month,
        COUNT(id) as bookings,
        SUM("totalPrice") as revenue,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled
      FROM "Booking"
      WHERE "createdAt" >= ${sixMonthsAgo}
      GROUP BY year, month
      ORDER BY year DESC, month DESC
    `;

    res.status(200).json({
      success: true,
      dashboard: {
        users: { total: totalUsers, active: activeUsers },
        companies: { total: totalCompanies, approved: approvedCompanies },
        cars: { total: totalCars, available: availableCars },
        bookings: {
          total: totalBookings,
          byStatus: bookingsByStatus.map(item => ({ _id: item.status, count: item._count.id }))
        },
        totalRevenue: totalRevenue._sum.totalPrice || 0,
        commissions: {
          totalCommissions: commissionStats._count.id,
          avgPercentage: commissionStats._avg.percentage || 0,
          avgFixedAmount: commissionStats._avg.fixedAmount || 0
        },
        monthlyReports: monthlyData,
        topCars,
        recentBookings,
        pendingCompanies
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

    res.status(200).json({
      success: true,
      message: "Car unsuspended successfully",
      car
    });
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