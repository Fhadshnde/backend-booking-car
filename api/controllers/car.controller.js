import mongoose from "mongoose";
import Car from "../models/car.model.js";
import Company from "../models/company.model.js";
import Booking from "../models/booking.model.js";
import Brand from "../models/brand.model.js";
import Ad from "../models/ad.model.js";
import { paginate } from "../helpers/pagination.helper.js";

const applyDiscountToCar = async (car) => {
  if (!car) return null;
  
  const activeAd = await Ad.findOne({
    carIds: car._id,
    isActive: true
  });
  
  let discountPercentage = 0;
  let discountAd = null;
  
  if (activeAd) {
    discountPercentage = activeAd.discountPercentage;
    discountAd = {
      id: activeAd._id,
      title: activeAd.title,
      discountPercentage: activeAd.discountPercentage,
      image: activeAd.image
    };
  }
  
  const originalPrice = car.pricePerDay;
  const discountedPrice = originalPrice * (1 - discountPercentage / 100);
  
  return {
    ...car.toObject ? car.toObject() : car,
    originalPrice: originalPrice,
    discountedPrice: discountedPrice,
    currentPrice: discountedPrice,
    discountPercentage: discountPercentage,
    hasDiscount: discountPercentage > 0,
    discountAd: discountAd
  };
};

const applyDiscountToCars = async (cars) => {
  if (!cars || cars.length === 0) return [];
  
  const carIds = cars.map(car => car._id);
  
  const activeAds = await Ad.find({
    carIds: { $in: carIds },
    isActive: true
  });
  
  const discountMap = new Map();
  activeAds.forEach(ad => {
    ad.carIds.forEach(carId => {
      const carIdStr = carId.toString();
      if (!discountMap.has(carIdStr) || discountMap.get(carIdStr).discountPercentage < ad.discountPercentage) {
        discountMap.set(carIdStr, {
          discountPercentage: ad.discountPercentage,
          discountAd: {
            id: ad._id,
            title: ad.title,
            discountPercentage: ad.discountPercentage,
            image: ad.image
          }
        });
      }
    });
  });
  
  return cars.map(car => {
    const carIdStr = car._id.toString();
    const discount = discountMap.get(carIdStr);
    const discountPercentage = discount ? discount.discountPercentage : 0;
    const originalPrice = car.pricePerDay;
    const discountedPrice = originalPrice * (1 - discountPercentage / 100);
    
    return {
      ...car.toObject ? car.toObject() : car,
      originalPrice: originalPrice,
      discountedPrice: discountedPrice,
      currentPrice: discountedPrice,
      discountPercentage: discountPercentage,
      hasDiscount: discountPercentage > 0,
      discountAd: discount ? discount.discountAd : null
    };
  });
};

export const getCars = async (req, res) => {
  try {
    const { 
      page, 
      limit, 
      isAvailable, 
      categoryId, 
      brandId,
      minPrice, 
      maxPrice, 
      transmission, 
      fuelType, 
      sort 
    } = req.query;

    const filter = { isSuspended: false };

    if (req.user && req.user.role.toLowerCase() === "company") {
      filter.companyId = req.user.companyId;
    } else {
      filter.isAvailable = true;
    }

    if (isAvailable === "true") filter.isAvailable = true;
    if (categoryId) filter.category = categoryId;
    if (brandId) filter.brand = brandId;
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

    const result = await paginate(Car, filter, {
      page,
      limit,
      sort: sortOptions,
      populate: [
        { path: "category", select: "name" },
        { path: "brand", select: "name logo" }
      ]
    });

    const carsData = result.data || result.cars || [];
    const carsWithDiscount = await applyDiscountToCars(carsData);
    
    let filteredCars = carsWithDiscount;
    if (minPrice || maxPrice) {
      filteredCars = carsWithDiscount.filter(car => {
        const priceToFilter = car.currentPrice;
        if (minPrice && priceToFilter < Number(minPrice)) return false;
        if (maxPrice && priceToFilter > Number(maxPrice)) return false;
        return true;
      });
    }
    
    res.status(200).json({
      success: true,
      ...result,
      data: filteredCars,
      cars: filteredCars
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "فشل في جلب البيانات" });
  }
};

export const getRecommendedCars = async (req, res) => {
  try {
    const cars = await Car.find({
      isAvailable: true,
      isSuspended: false
    })
      .sort({ totalBookings: -1, rating: -1 })
      .limit(8)
      .populate("companyId", "name rating")
      .populate("category", "name icon")
      .populate("brand", "name logo")
      .lean();

    const carsWithDiscount = await applyDiscountToCars(cars);

    res.status(200).json({
      success: true,
      cars: carsWithDiscount
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "فشل في جلب السيارات الموصى بها" });
  }
};

export const getCar = async (req, res) => {
  try {
    const car = await Car.findById(req.params.id)
      .populate("companyId", "name phone address rating city")
      .populate("category", "name icon")
      .populate("brand", "name logo")
      .lean();
    
    if (!car) return res.status(404).json({ success: false, message: "Car not found" });
    
    const carWithDiscount = await applyDiscountToCar(car);
    
    res.status(200).json({ success: true, car: carWithDiscount });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch car" });
  }
};

export const createCar = async (req, res) => {
  try {
    let data = req.body;

    if (req.user.role.toLowerCase() === "company") {
      data.companyId = req.user.companyId;
    }

    const existingCar = await Car.findOne({ licensePlate: data.licensePlate });
    if (existingCar) {
      return res.status(400).json({ 
        success: false, 
        message: "رقم اللوحة مسجل مسبقاً لسيارة أخرى" 
      });
    }

    if (data.insurancePrice) {
      data.insurancePrice = Number(data.insurancePrice);
    } else {
      data.insurancePrice = 0;
    }

    const car = await Car.create(data);

    await Company.findByIdAndUpdate(data.companyId, { 
      $inc: { totalCars: 1 } 
    });

    res.status(201).json({ 
      success: true, 
      message: "تم إنشاء السيارة بنجاح مع سعر التأمين المحدد", 
      car 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: "فشل في إنشاء السيارة: " + error.message 
    });
  }
};

export const updateCar = async (req, res) => {
  try {
    const { id } = req.params;
    let updateData = req.body;

    if (updateData.latitude && updateData.longitude) {
      updateData.location = {
        type: "Point",
        coordinates: [Number(updateData.longitude), Number(updateData.latitude)]
      };
    }

    if (updateData.insurancePrice) updateData.insurancePrice = Number(updateData.insurancePrice);
    if (updateData.pricePerDay) updateData.pricePerDay = Number(updateData.pricePerDay);

    const car = await Car.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!car) {
      return res.status(404).json({
        success: false,
        message: "لم يتم العثور على السيارة المطلوبة"
      });
    }

    res.status(200).json({
      success: true,
      message: "تم تحديث بيانات السيارة بنجاح بما في ذلك الموقع",
      car
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "فشل تحديث السيارة: " + error.message
    });
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
    res.status(500).json({ success: false, message: "Failed to delete car" });
  }
};

export const searchCars = async (req, res) => {
  try {
    const { 
      query, 
      brand, 
      category, 
      minPrice, 
      maxPrice, 
      fuelType, 
      transmission, 
      city 
    } = req.query;

    let filter = { 
      isSuspended: false, 
      isAvailable: true 
    };

    if (query) {
      filter.model = new RegExp(query, "i");
    }

    if (brand) {
      filter.brand = brand;
    }

    if (category) {
      filter.category = category;
    }

    if (fuelType) {
      filter.fuelType = fuelType;
    }

    if (transmission) {
      filter.transmission = transmission.toLowerCase();
    }

    if (minPrice || maxPrice) {
      filter.pricePerDay = {};
      if (minPrice) filter.pricePerDay.$gte = parseInt(minPrice);
      if (maxPrice) filter.pricePerDay.$lte = parseInt(maxPrice);
    }

    if (city) {
      const companiesInCity = await Company.find({ 
        city: new RegExp(city, "i") 
      }).select("_id");
      
      const companyIds = companiesInCity.map(c => c._id);
      filter.companyId = { $in: companyIds };
    }

    const cars = await Car.find(filter)
      .populate("companyId", "name address city rating")
      .populate("category", "name icon")
      .populate("brand", "name logo")
      .lean();

    const carsWithDiscount = await applyDiscountToCars(cars);
    
    let filteredCars = carsWithDiscount;
    if (minPrice || maxPrice) {
      filteredCars = carsWithDiscount.filter(car => {
        const priceToFilter = car.currentPrice;
        if (minPrice && priceToFilter < Number(minPrice)) return false;
        if (maxPrice && priceToFilter > Number(maxPrice)) return false;
        return true;
      });
    }

    res.status(200).json({ 
      success: true, 
      count: filteredCars.length, 
      cars: filteredCars 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: "Failed to search cars" 
    });
  }
};

export const getCarDetails = async (req, res) => {
  try {
    const car = await Car.findById(req.params.id)
      .populate("companyId", "name phone address rating logo")
      .populate("category", "name icon")
      .populate("brand", "name logo")
      .lean();
    
    if (!car) return res.status(404).json({ success: false, message: "Car not found" });
    
    const reviews = await Booking.find({ carId: req.params.id, status: "completed", rating: { $exists: true } })
      .populate("userId", "name avatar").select("rating review createdAt").sort({ createdAt: -1 }).lean();
    
    const carWithDiscount = await applyDiscountToCar(car);
    
    res.status(200).json({ success: true, car: carWithDiscount, reviews });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch car details" });
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
    res.status(500).json({ success: false, message: "Failed to check availability" });
  }
};

export const getHomeCars = async (req, res) => {
  try {
    const baseFilter = { isAvailable: true, isSuspended: false };
    const [topRated, cheapest, newest] = await Promise.all([
      Car.find(baseFilter).sort({ rating: -1 }).limit(8).populate("companyId", "name rating").populate("category", "name icon").populate("brand", "name logo").lean(),
      Car.find(baseFilter).sort({ pricePerDay: 1 }).limit(8).populate("companyId", "name rating").populate("category", "name icon").populate("brand", "name logo").lean(),
      Car.find(baseFilter).sort({ createdAt: -1 }).limit(8).populate("companyId", "name rating").populate("category", "name icon").populate("brand", "name logo").lean()
    ]);
    
    const topRatedWithDiscount = await applyDiscountToCars(topRated);
    const cheapestWithDiscount = await applyDiscountToCars(cheapest);
    const newestWithDiscount = await applyDiscountToCars(newest);
    
    res.status(200).json({ 
      success: true, 
      data: { 
        topRated: topRatedWithDiscount, 
        cheapest: cheapestWithDiscount, 
        newest: newestWithDiscount 
      } 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch home cars" });
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
    res.status(500).json({ success: false, message: "Failed to toggle availability" });
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
    res.status(500).json({ success: false, message: "Failed to fetch analytics" });
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
        .populate("brand", "name logo")
        .sort({ createdAt: -1 })
        .lean(),
      Car.countDocuments({ companyId })
    ]);

    const carsWithDiscount = await applyDiscountToCars(cars);

    res.status(200).json({
      success: true,
      count: carsWithDiscount.length,
      cars: carsWithDiscount,
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
      message: "Failed to fetch company cars"
    });
  }
};

export const getCarsByBrand = async (req, res) => {
  try {
    const { brandId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [cars, total] = await Promise.all([
      Car.find({ 
        brand: brandId, 
        isAvailable: true, 
        isSuspended: false 
      })
        .skip(skip)
        .limit(parseInt(limit))
        .populate("companyId", "name rating")
        .populate("category", "name icon")
        .populate("brand", "name logo")
        .lean(),
      Car.countDocuments({ brand: brandId, isAvailable: true, isSuspended: false })
    ]);

    const carsWithDiscount = await applyDiscountToCars(cars);

    res.status(200).json({
      success: true,
      count: carsWithDiscount.length,
      cars: carsWithDiscount,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch cars by brand" });
  }
};