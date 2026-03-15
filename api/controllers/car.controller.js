import mongoose from "mongoose";
import Car from "../models/car.model.js";
import Company from "../models/company.model.js";
import Booking from "../models/booking.model.js";

export const getCars = async (req, res) => {
  try {
    const { page = 1, limit = 10, isAvailable, categoryId, minPrice, maxPrice, transmission, fuelType, sort } = req.query;
    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);
    const skip = (pageNumber - 1) * limitNumber;

    const filter = { isSuspended: false };

    if (req.user && req.user.role.toLowerCase() === "company") {
      filter.companyId = req.user.companyId;
    } else {
      filter.isAvailable = true;
    }

    if (isAvailable === "true") filter.isAvailable = true;
    if (categoryId) filter.category = categoryId;
    if (transmission) filter.transmission = transmission;
    if (fuelType) filter.fuelType = fuelType;
    
    if (minPrice || maxPrice) {
      filter.pricePerDay = {};
      if (minPrice) filter.pricePerDay.$gte = Number(minPrice);
      if (maxPrice) filter.pricePerDay.$lte = Number(maxPrice);
    }

    let sortOptions = { createdAt: -1 };
    if (sort === "price_asc") sortOptions = { pricePerDay: 1 };
    if (sort === "price_desc") sortOptions = { pricePerDay: -1 };
    if (sort === "rating") sortOptions = { rating: -1 };

    const [cars, total] = await Promise.all([
      Car.find(filter)
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNumber)
        .populate("companyId", "name rating city")
        .populate("category", "name icon")
        .lean(),
      Car.countDocuments(filter)
    ]);

    res.status(200).json({
      success: true,
      cars,
      pagination: { total, page: pageNumber, limit: limitNumber, pages: Math.ceil(total / limitNumber) }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || "Failed to fetch cars" });
  }
};

export const getCar = async (req, res) => {
  try {
    const car = await Car.findById(req.params.id)
      .populate("companyId", "name phone address rating city")
      .populate("category", "name icon")
      .lean();
    if (!car) return res.status(404).json({ success: false, message: "Car not found" });
    res.status(200).json({ success: true, car });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || "Failed to fetch car" });
  }
};

export const createCar = async (req, res) => {
  try {
    let data = req.body;
    if (req.user.role.toLowerCase() === "company") data.companyId = req.user.companyId;

    const existingCar = await Car.findOne({ licensePlate: data.licensePlate });
    if (existingCar) return res.status(400).json({ success: false, message: "License plate already exists" });

    const car = await Car.create(data);
    await Company.findByIdAndUpdate(data.companyId, { $inc: { totalCars: 1 } });
    res.status(201).json({ success: true, message: "Car created successfully", car });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || "Failed to create car" });
  }
};

export const updateCar = async (req, res) => {
  try {
    const car = await Car.findById(req.params.id);
    if (!car) return res.status(404).json({ success: false, message: "Car not found" });
    if (req.user.role.toLowerCase() === "company" && car.companyId.toString() !== req.user.companyId.toString()) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }
    Object.assign(car, req.body);
    await car.save();
    res.status(200).json({ success: true, message: "Car updated successfully", car });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || "Failed to update car" });
  }
};

export const deleteCar = async (req, res) => {
  try {
    const car = await Car.findById(req.params.id);
    if (!car) return res.status(404).json({ success: false, message: "Car not found" });
    if (req.user.role.toLowerCase() === "company" && car.companyId.toString() !== req.user.companyId.toString()) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }
    await Promise.all([
      Car.findByIdAndDelete(req.params.id),
      Company.findByIdAndUpdate(car.companyId, { $inc: { totalCars: -1 } })
    ]);
    res.status(200).json({ success: true, message: "Car deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || "Failed to delete car" });
  }
};

export const searchCars = async (req, res) => {
  try {
    const { brand, model, categoryId, priceMin, priceMax, fuelType, city } = req.query;
    
    let companyFilter = {};
    if (city) {
      const companiesInCity = await Company.find({ city: new RegExp(city, "i") }).select("_id");
      const companyIds = companiesInCity.map(c => c._id);
      companyFilter.companyId = { $in: companyIds };
    }

    const filter = { isSuspended: false, isAvailable: true, ...companyFilter };
    if (brand) filter.brand = new RegExp(brand, "i");
    if (model) filter.model = new RegExp(model, "i");
    if (categoryId) filter.category = categoryId;
    if (fuelType) filter.fuelType = fuelType;
    if (priceMin || priceMax) {
      filter.pricePerDay = {};
      if (priceMin) filter.pricePerDay.$gte = parseInt(priceMin);
      if (priceMax) filter.pricePerDay.$lte = parseInt(priceMax);
    }

    const cars = await Car.find(filter)
      .populate("companyId", "name address city rating")
      .populate("category", "name icon")
      .lean();

    res.status(200).json({ success: true, count: cars.length, cars });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || "Failed to search cars" });
  }
};

export const getCarDetails = async (req, res) => {
  try {
    const car = await Car.findById(req.params.id).populate("companyId", "name phone address rating logo").populate("category", "name icon").lean();
    if (!car) return res.status(404).json({ success: false, message: "Car not found" });
    const reviews = await Booking.find({ carId: req.params.id, status: "completed", rating: { $exists: true } })
      .populate("userId", "name avatar").select("rating review createdAt").sort({ createdAt: -1 }).lean();
    res.status(200).json({ success: true, car, reviews });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || "Failed to fetch car details" });
  }
};

export const getCarAvailability = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) return res.status(400).json({ success: false, message: "Dates required" });
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ success: false, message: "Invalid date format" });
    }

    const car = await Car.findById(req.params.id).lean();
    if (!car) return res.status(404).json({ success: false, message: "Car not found" });

    const conflicts = await Booking.find({
      carId: req.params.id,
      status: { $in: ["pending", "confirmed"] },
      $or: [{ startDate: { $lte: end }, endDate: { $gte: start } }]
    }).lean();
    
    res.status(200).json({ success: true, isAvailable: conflicts.length === 0 && car.isAvailable && !car.isSuspended });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || "Failed to check availability" });
  }
};

export const getHomeCars = async (req, res) => {
  try {
    const baseFilter = { isAvailable: true, isSuspended: false };
    const [topRated, cheapest, newest] = await Promise.all([
      Car.find(baseFilter).sort({ rating: -1 }).limit(8).populate("companyId", "name rating").populate("category", "name icon").lean(),
      Car.find(baseFilter).sort({ pricePerDay: 1 }).limit(8).populate("companyId", "name rating").populate("category", "name icon").lean(),
      Car.find(baseFilter).sort({ createdAt: -1 }).limit(8).populate("companyId", "name rating").populate("category", "name icon").lean()
    ]);
    res.status(200).json({ success: true, data: { topRated, cheapest, newest } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || "Failed" });
  }
};

export const toggleCarAvailability = async (req, res) => {
  try {
    const car = await Car.findById(req.params.id);
    if (!car) return res.status(404).json({ success: false, message: "Car not found" });
    if (req.user.role.toLowerCase() === "company" && car.companyId.toString() !== req.user.companyId.toString()) {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }
    car.isAvailable = !car.isAvailable;
    await car.save();
    res.status(200).json({ success: true, isAvailable: car.isAvailable });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || "Failed" });
  }
};

export const getCompanyAnalytics = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const [stats, carStats] = await Promise.all([
      Booking.aggregate([
        { $match: { companyId: new mongoose.Types.ObjectId(companyId) } },
        { $group: { _id: null, totalRevenue: { $sum: "$totalPrice" }, totalBookings: { $sum: 1 }, completedBookings: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } }, cancelledBookings: { $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] } } } }
      ]),
      Car.aggregate([
        { $match: { companyId: new mongoose.Types.ObjectId(companyId) } },
        { $group: { _id: "$category", count: { $sum: 1 }, avgPrice: { $avg: "$pricePerDay" } } }
      ])
    ]);
    res.status(200).json({ success: true, analytics: stats[0] || {}, inventoryDistribution: carStats });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || "Failed" });
  }
};

export const getCarsByCompany = async (req, res) => {
  try {
    let companyId;
    if (req.user.role.toLowerCase() === "company") {
      companyId = req.user.companyId;
    } else {
      companyId = req.params.companyId;
    }

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: "Company ID is required"
      });
    }

    const { page = 1, limit = 10 } = req.query;
    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);
    const skip = (pageNumber - 1) * limitNumber;

    const [cars, total] = await Promise.all([
      Car.find({ companyId })
        .skip(skip)
        .limit(limitNumber)
        .populate("category", "name icon")
        .sort({ createdAt: -1 })
        .lean(),
      Car.countDocuments({ companyId })
    ]);

    res.status(200).json({
      success: true,
      count: cars.length,
      cars,
      pagination: {
        total,
        page: pageNumber,
        limit: limitNumber,
        pages: Math.ceil(total / limitNumber)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch company cars"
    });
  }
};