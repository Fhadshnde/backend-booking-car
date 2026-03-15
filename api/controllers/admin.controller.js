import User from "../models/user.model.js";
import Company from "../models/company.model.js";
import Car from "../models/car.model.js";
import Booking from "../models/booking.model.js";
import Commission from "../models/Commission.js";

export const getAdminDashboard = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments({ role: "user" });
    const activeUsers = await User.countDocuments({ role: "user", isActive: true });
    const totalCompanies = await Company.countDocuments();
    const approvedCompanies = await Company.countDocuments({ isApproved: true });
    const totalCars = await Car.countDocuments();
    const availableCars = await Car.countDocuments({ isAvailable: true, isSuspended: false });
    const totalBookings = await Booking.countDocuments();
    
    const totalRevenue = await Booking.aggregate([
      { $match: { paymentStatus: "completed" } },
      { $group: { _id: null, total: { $sum: "$totalPrice" } } }
    ]);

    // إحصائيات العمولات
    const commissionStats = await Commission.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: null,
          totalCommissions: { $sum: 1 },
          avgPercentage: { $avg: "$percentage" },
          avgFixedAmount: { $avg: "$fixedAmount" }
        }
      }
    ]);

    // تقارير شهرية (آخر 6 أشهر)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlyReports = await Booking.aggregate([
      { $match: { createdAt: { $gte: sixMonthsAgo } } },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" }
          },
          bookings: { $sum: 1 },
          revenue: { $sum: "$totalPrice" },
          completed: {
            $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] }
          },
          cancelled: {
            $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] }
          }
        }
      },
      { $sort: { "_id.year": -1, "_id.month": -1 } }
    ]);

    // أكثر السيارات حجزاً
    const topCars = await Car.find()
      .sort({ totalBookings: -1 })
      .limit(5)
      .select("brand model totalBookings pricePerDay rating")
      .populate("companyId", "name");

    const recentBookings = await Booking.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .populate("userId", "name")
      .populate("carId", "brand model")
      .populate("companyId", "name");

    const pendingCompanies = await Company.find({ isApproved: false, isRejected: false })
      .populate("owner", "name");

    const bookingsByStatus = await Booking.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } }
    ]);

    res.status(200).json({
      success: true,
      dashboard: {
        users: { total: totalUsers, active: activeUsers },
        companies: { total: totalCompanies, approved: approvedCompanies },
        cars: { total: totalCars, available: availableCars },
        bookings: {
          total: totalBookings,
          byStatus: bookingsByStatus
        },
        totalRevenue: totalRevenue[0]?.total || 0,
        commissions: commissionStats[0] || { totalCommissions: 0, avgPercentage: 0, avgFixedAmount: 0 },
        monthlyReports,
        topCars,
        recentBookings,
        pendingCompanies
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch dashboard" });
  }
};

export const toggleUserStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    user.isActive = !user.isActive;
    await user.save();

    res.status(200).json({
      success: true,
      message: user.isActive ? "User activated" : "User disabled",
      user
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to update user status" });
  }
};

export const approveCompany = async (req, res) => {
  try {
    const { companyId } = req.params;

    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({ success: false, message: "Company not found" });
    }

    company.isApproved = true;
    company.isRejected = false;
    company.approvedAt = new Date();
    company.rejectionReason = null;
    await company.save();

    await User.findByIdAndUpdate(company.owner, { role: "company" });

    res.status(200).json({
      success: true,
      message: "Company approved successfully",
      company
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to approve company" });
  }
};

export const rejectCompany = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { rejectionReason } = req.body;

    if (!rejectionReason) {
      return res.status(400).json({ success: false, message: "Rejection reason required" });
    }

    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({ success: false, message: "Company not found" });
    }

    company.isRejected = true;
    company.isApproved = false;
    company.rejectionReason = rejectionReason;
    await company.save();

    res.status(200).json({
      success: true,
      message: "Company rejected successfully",
      company
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to reject company" });
  }
};

export const getPendingCompanies = async (req, res) => {
  try {
    const pendingCompanies = await Company.find({ isApproved: false, isRejected: false })
      .populate("owner", "name  phone");

    res.status(200).json({ success: true, pendingCompanies });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch pending companies" });
  }
};

export const cancelBookingAdmin = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { reason } = req.body;

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    booking.status = "cancelled";
    booking.cancellationReason = reason || "Cancelled by admin";
    booking.cancelledAt = new Date();
    await booking.save();

    const otherActiveBookings = await Booking.find({
      carId: booking.carId,
      status: { $in: ["confirmed", "pending"] }
    });

    if (otherActiveBookings.length === 0) {
      await Car.findByIdAndUpdate(booking.carId, { isAvailable: true });
    }

    res.status(200).json({
      success: true,
      message: "Booking cancelled successfully",
      booking
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to cancel booking" });
  }
};

export const getBookingReports = async (req, res) => {
  try {
    const { startDate, endDate, status } = req.query;

    let filter = {};

    if (startDate && endDate) {
      filter.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    if (status) {
      filter.status = status;
    }

    const bookings = await Booking.find(filter)
      .populate("userId", "name ")
      .populate("carId", "brand model")
      .populate("companyId", "name");

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
    res.status(500).json({ success: false, message: "Failed to fetch reports" });
  }
};

export const suspendCar = async (req, res) => {
  try {
    const { carId } = req.params;
    const { reason } = req.body;

    const car = await Car.findById(carId);
    if (!car) {
      return res.status(404).json({ success: false, message: "Car not found" });
    }

    car.isSuspended = true;
    car.suspensionReason = reason || "Suspended by admin";
    car.suspendedAt = new Date();
    car.isAvailable = false;
    await car.save();

    res.status(200).json({
      success: true,
      message: "Car suspended successfully",
      car
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to suspend car" });
  }
};

export const unsuspendCar = async (req, res) => {
  try {
    const { carId } = req.params;

    const car = await Car.findById(carId);
    if (!car) {
      return res.status(404).json({ success: false, message: "Car not found" });
    }

    car.isSuspended = false;
    car.suspensionReason = null;
    car.suspendedAt = null;
    car.isAvailable = true;
    await car.save();

    res.status(200).json({
      success: true,
      message: "Car unsuspended successfully",
      car
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to unsuspend car" });
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
    res.status(500).json({ success: false, message: "Failed to fetch complaints" });
  }
};

export const respondToComplaint = async (req, res) => {
  try {
    const { complaintId } = req.params;
    const { response } = req.body;

    res.status(200).json({
      success: true,
      message: "Response sent successfully"
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to respond to complaint" });
  }
};