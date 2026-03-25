import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import Company from "../models/company.model.js";
import User from "../models/user.model.js";
import Commission from "../models/Commission.js";
import Car from "../models/car.model.js";
import Booking from "../models/booking.model.js";

export const createCompany = async (req, res) => {
  try {
    const {
      name,
      phone,
      address,
      city,
      description,
      ownerId,
      licenseNumber,
      percentage,
      fixedAmount
    } = req.body;

    if (!mongoose.Types.ObjectId.isValid(ownerId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid ownerId"
      });
    }

    const ownerUser = await User.findById(ownerId);

    if (!ownerUser) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    if (ownerUser.companyId) {
      return res.status(400).json({
        success: false,
        message: "User already owns a company"
      });
    }

    const company = await Company.create({
      name,
      phone,
      address,
      city,
      description,
      owner: ownerUser._id,
      licenseNumber
    });

    ownerUser.companyId = company._id;
    await ownerUser.save();

    await Commission.create({
      company: company._id,
      percentage: percentage || 10,
      fixedAmount: fixedAmount || 0,
      updatedBy: req.user?.id
    });

    res.status(201).json({
      success: true,
      message: "Company and commission created successfully",
      company
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to create company"
    });
  }
};

export const getCompanies = async (req, res) => {
  try {
    const { page = 1, limit = 10, isApproved } = req.query;
    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);
    const skip = (pageNumber - 1) * limitNumber;

    let filter = {};
    if (isApproved !== undefined) {
      filter.isApproved = isApproved === "true";
    }

    const [companies, total] = await Promise.all([
      Company.find(filter)
        .skip(skip)
        .limit(limitNumber)
        .populate("owner", "name phone")
        .lean(),
      Company.countDocuments(filter)
    ]);

    res.status(200).json({
      success: true,
      companies,
      pagination: { total, page: pageNumber, limit: limitNumber, pages: Math.ceil(total / limitNumber) }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch companies" });
  }
};

export const getCompany = async (req, res) => {
  try {
    const company = await Company.findById(req.params.id).populate("owner", "name phone").lean();
    if (!company) {
      return res.status(404).json({ success: false, message: "Company not found" });
    }
    res.status(200).json({ success: true, company });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch company" });
  }
};

export const updateCompany = async (req, res) => {
  try {
    const { name, phone, description, address, city, country } = req.body;
    const company = await Company.findByIdAndUpdate(
      req.params.id,
      { name, phone, description, address, city, country },
      { new: true, runValidators: true }
    );
    if (!company) {
      return res.status(404).json({ success: false, message: "Company not found" });
    }
    res.status(200).json({
      success: true,
      message: "Company updated successfully",
      company
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to update company" });
  }
};

export const deleteCompany = async (req, res) => {
  try {
    const company = await Company.findById(req.params.id);
    if (!company) {
      return res.status(404).json({ success: false, message: "Company not found" });
    }

    await Promise.all([
      User.findByIdAndUpdate(company.owner, { $unset: { companyId: 1 } }),
      Car.deleteMany({ companyId: req.params.id }),
      Commission.deleteMany({ company: req.params.id }),
      Company.findByIdAndDelete(req.params.id)
    ]);

    res.status(200).json({ success: true, message: "Company and related data deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to delete company" });
  }
};

export const getCompanyProfile = async (req, res) => {
  try {
    const company = await Company.findOne({ owner: req.user.id }).populate("owner", "name phone").lean();
    if (!company) {
      return res.status(404).json({ success: false, message: "Company not found" });
    }
    res.status(200).json({ success: true, company });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch company profile" });
  }
};

export const updateCompanyProfile = async (req, res) => {
  try {
    const { name, phone, description, address, city, country, logo } = req.body;
    const company = await Company.findOneAndUpdate(
      { owner: req.user.id },
      { name, phone, description, address, city, country, logo },
      { new: true, runValidators: true }
    );
    if (!company) {
      return res.status(404).json({ success: false, message: "Company not found" });
    }
    res.status(200).json({
      success: true,
      message: "Company profile updated successfully",
      company
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to update company profile" });
  }
};

export const getCompanyDashboard = async (req, res) => {
  try {
    const company = await Company.findOne({ owner: req.user.id }).lean();
    if (!company) {
      return res.status(404).json({ success: false, message: "Company not found" });
    }

    const [totalCars, totalBookings, completedBookings, pendingBookings, revenueData, recentBookings] = await Promise.all([
      Car.countDocuments({ companyId: company._id }),
      Booking.countDocuments({ companyId: company._id }),
      Booking.countDocuments({ companyId: company._id, status: "completed" }),
      Booking.countDocuments({ companyId: company._id, status: "pending" }),
      Booking.aggregate([
        { $match: { companyId: company._id, paymentStatus: "completed" } },
        { $group: { _id: null, total: { $sum: "$totalPrice" } } }
      ]),
      Booking.find({ companyId: company._id })
        .sort({ createdAt: -1 })
        .limit(10)
        .populate("userId", "name")
        .populate("carId", "brand model")
        .lean()
    ]);

    res.status(200).json({
      success: true,
      dashboard: {
        totalCars,
        totalBookings,
        completedBookings,
        pendingBookings,
        totalRevenue: revenueData[0]?.total || 0,
        recentBookings
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch dashboard" });
  }
};

export const getCompanyCars = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);
    const skip = (pageNumber - 1) * limitNumber;

    const [cars, total] = await Promise.all([
      Car.find({ companyId })
        .skip(skip)
        .limit(limitNumber)
        .sort({ createdAt: -1 })
        .lean(),
      Car.countDocuments({ companyId })
    ]);

    res.status(200).json({
      success: true,
      cars,
      pagination: { total, page: pageNumber, limit: limitNumber, pages: Math.ceil(total / limitNumber) }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch cars" });
  }
};