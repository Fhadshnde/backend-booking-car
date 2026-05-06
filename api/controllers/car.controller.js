import { prisma } from "../lib/prisma.js";

export const applyDiscountToCar = async (car) => {
  if (!car) return null;
  
  const activeAd = await prisma.ad.findFirst({
    where: {
      cars: { some: { id: car.id } },
      isActive: true,
      endDate: { gte: new Date() }
    }
  });
  
  let discountPercentage = 0;
  let discountAd = null;
  
  if (activeAd) {
    discountPercentage = activeAd.discountPercentage;
    discountAd = {
      id: activeAd.id,
      title: activeAd.title,
      discountPercentage: activeAd.discountPercentage,
      image: activeAd.image
    };
  }

  // Check if car has its own direct discountPrice that is better or if no Ad exists
  const today = new Date();
  const hasDirectDiscount = car.discountPrice > 0 && car.discountPrice < originalPrice;
  
  const originalPrice = car.pricePerDay;
  let currentPrice = originalPrice;

  if (discountPercentage > 0) {
    currentPrice = originalPrice * (1 - discountPercentage / 100);
  } else if (hasDirectDiscount) {
    currentPrice = car.discountPrice;
    discountPercentage = Math.round(((originalPrice - currentPrice) / originalPrice) * 100);
  }
  
  return {
    ...car,
    originalPrice,
    currentPrice,
    discountedPrice: currentPrice,
    discountPercentage,
    hasDiscount: discountPercentage > 0,
    discountAd
  };
};

export const applyDiscountToCars = async (cars) => {
  if (!cars || cars.length === 0) return [];
  
  const carIds = cars.map(car => car.id);
  
  const activeAds = await prisma.ad.findMany({
    where: {
      cars: { some: { id: { in: carIds } } },
      isActive: true,
      endDate: { gte: new Date() }
    },
    include: { cars: { select: { id: true } } }
  });
  
  const discountMap = new Map();
  activeAds.forEach(ad => {
    ad.cars.forEach(c => {
      const carId = c.id;
      if (!discountMap.has(carId) || discountMap.get(carId).discountPercentage < ad.discountPercentage) {
        discountMap.set(carId, {
          discountPercentage: ad.discountPercentage,
          discountAd: {
            id: ad.id,
            title: ad.title,
            discountPercentage: ad.discountPercentage,
            image: ad.image
          }
        });
      }
    });
  });
  
  return cars
    .filter(car => car && car.id) // Ensure car and id exist
    .map(car => {
      const discount = discountMap.get(car.id);
      const discountPercentage = discount ? discount.discountPercentage : 0;
      const originalPrice = car.pricePerDay || 0;
      const today = new Date();
      
      // Be more lenient with direct discounts
      const hasDirectDiscount = car.discountPrice > 0 && car.discountPrice < originalPrice;

      let finalDiscountPercent = discountPercentage;
      let finalCurrentPrice = originalPrice * (1 - discountPercentage / 100);

      if (hasDirectDiscount && (discountPercentage === 0 || car.discountPrice < finalCurrentPrice)) {
        finalCurrentPrice = car.discountPrice;
        finalDiscountPercent = Math.round(((originalPrice - finalCurrentPrice) / originalPrice) * 100);
      }
      
      // Final safety check: if we have a percent but current price is same as original, or vice versa
      if (finalDiscountPercent > 0 && finalCurrentPrice >= originalPrice) {
          finalCurrentPrice = originalPrice * (1 - finalDiscountPercent / 100);
      }

      return {
        ...car,
        brand: car.brand || { name: "Unknown" },
        category: car.category || { name: "General" },
        images: Array.isArray(car.images) && car.images.length > 0 ? car.images : ["https://cdn-icons-png.flaticon.com/512/744/744465.png"],
        originalPrice,
        discountedPrice: finalCurrentPrice,
        currentPrice: finalCurrentPrice,
        discountPercentage: finalDiscountPercent,
        hasDiscount: finalDiscountPercent > 0,
        discountAd: discount ? discount.discountAd : null
      };
    });
};

export const getCars = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      isAvailable, 
      categoryId, 
      brandId,
      minPrice, 
      maxPrice, 
      transmission, 
      fuelType, 
      sort 
    } = req.query;

    const skip = (Number(page) - 1) * Number(limit);
    const where = { isSuspended: false };

    if (req.user && req.user.role.toLowerCase() === "company") {
      where.companyId = req.user.companyId;
    } else {
      where.isAvailable = true;
    }

    if (isAvailable === "true") where.isAvailable = true;
    if (categoryId) where.categoryId = Number(categoryId);
    if (brandId) where.brandId = Number(brandId);
    if (transmission) where.transmission = transmission;
    if (fuelType) where.fuelType = fuelType;
    
    if (minPrice || maxPrice) {
      where.pricePerDay = {};
      if (minPrice) where.pricePerDay.gte = Number(minPrice);
      if (maxPrice) where.pricePerDay.lte = Number(maxPrice);
    }

    let orderBy = { createdAt: "desc" };
    if (sort === "price_asc") orderBy = { pricePerDay: "asc" };
    if (sort === "price_desc") orderBy = { pricePerDay: "desc" };

    const [cars, total] = await Promise.all([
      prisma.car.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy,
        include: {
          category: { select: { name: true } },
          brand: { select: { name: true, logo: true } }
        }
      }),
      prisma.car.count({ where })
    ]);

    const carsWithDiscount = await applyDiscountToCars(cars);
    
    res.status(200).json({
      success: true,
      data: carsWithDiscount,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getCar = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, message: "معرف السيارة غير صالح" });
    }

    const car = await prisma.car.findUnique({
      where: { id },
      include: {
        company: { select: { name: true, phone: true, address: true, rating: true, city: true } },
        category: { select: { name: true, icon: true } },
        brand: { select: { name: true, logo: true } }
      }
    });
    
    if (!car) return res.status(404).json({ success: false, message: "Car not found" });
    
    const carWithDiscount = await applyDiscountToCar(car);
    res.status(200).json({ success: true, car: carWithDiscount });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createCar = async (req, res) => {
  try {
    const {
      model,
      brandId,
      categoryId,
      companyId,
      pricePerDay,
      insurancePrice,
      year,
      licensePlate,
      color,
      transmission,
      fuelType,
      seats,
      mileage,
      description,
      latitude,
      longitude,
      driverPricePerDay
    } = req.body;

    // Handle images from Multer (req.files) and any existing image URLs in req.body
    let carImages = [];
    if (req.body.images) {
      carImages = Array.isArray(req.body.images) ? req.body.images : [req.body.images];
    }
    
    if (req.files && req.files.length > 0) {
      const uploadedPaths = req.files.map(file => {
        const b64 = Buffer.from(file.buffer).toString("base64");
        return `data:${file.mimetype};base64,${b64}`;
      });
      carImages = [...carImages, ...uploadedPaths];
    }

    const targetCompanyId = req.user.role.toLowerCase() === "company" 
      ? req.user.companyId 
      : Number(companyId);

    if (!targetCompanyId) {
      return res.status(400).json({ success: false, message: "معرف الشركة مطلوب" });
    }

    const existingCar = await prisma.car.findUnique({
      where: { licensePlate: String(licensePlate) }
    });

    if (existingCar) {
      return res.status(400).json({ success: false, message: "رقم اللوحة مسجل مسبقاً" });
    }

    const car = await prisma.$transaction([
      prisma.car.create({
        data: {
          model: String(model),
          year: Number(year),
          licensePlate: String(licensePlate),
          pricePerDay: Number(pricePerDay),
          insurancePrice: Number(insurancePrice || 0),
          transmission: String(transmission),
          fuelType: String(fuelType),
          seats: Number(seats),
          mileage: Number(mileage),
          description: String(description || ""),
          color: String(color),
          images: carImages,
          latitude: latitude ? Number(latitude) : undefined,
          longitude: longitude ? Number(longitude) : undefined,
          driverPricePerDay: Number(driverPricePerDay || 0),
          brand: { connect: { id: Number(brandId) } },
          category: { connect: { id: Number(categoryId) } },
          company: { connect: { id: Number(targetCompanyId) } }
        }
      }),
      prisma.company.update({
        where: { id: Number(targetCompanyId) },
        data: { totalCars: { increment: 1 } }
      })
    ]);

    res.status(201).json({ success: true, car: car[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateCar = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      model, brandId, categoryId, companyId, pricePerDay, insurancePrice,
      year, licensePlate, color, transmission, fuelType, seats, mileage,
      description, images, latitude, longitude, driverPricePerDay
    } = req.body;

    const car = await prisma.car.update({
      where: { id: Number(id) },
      data: {
        model,
        brandId: brandId ? Number(brandId) : undefined,
        categoryId: categoryId ? Number(categoryId) : undefined,
        companyId: companyId ? Number(companyId) : undefined,
        pricePerDay: pricePerDay ? Number(pricePerDay) : undefined,
        insurancePrice: insurancePrice ? Number(insurancePrice) : undefined,
        driverPricePerDay: driverPricePerDay !== undefined ? Number(driverPricePerDay) : undefined,
        year: year ? Number(year) : undefined,
        licensePlate,
        color,
        transmission,
        fuelType,
        seats: seats ? Number(seats) : undefined,
        mileage: mileage ? Number(mileage) : undefined,
        description,
        latitude: latitude ? Number(latitude) : undefined,
        longitude: longitude ? Number(longitude) : undefined,
        images: (() => {
          let imgs = [];
          if (images) {
            imgs = Array.isArray(images) ? images : [images];
          }
          if (req.files && req.files.length > 0) {
            const uploaded = req.files.map(file => {
              const b64 = Buffer.from(file.buffer).toString("base64");
              return `data:${file.mimetype};base64,${b64}`;
            });
            imgs = [...imgs, ...uploaded];
          }
          return imgs;
        })(),
      }
    });

    res.status(200).json({ success: true, car });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteCar = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const car = await prisma.car.findUnique({ where: { id } });
    
    if (!car) return res.status(404).json({ success: false, message: "Car not found" });

    await prisma.$transaction([
      prisma.car.delete({ where: { id } }),
      prisma.company.update({
        where: { id: car.companyId },
        data: { totalCars: { decrement: 1 } }
      })
    ]);

    res.status(200).json({ success: true, message: "Car deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const searchCars = async (req, res) => {
  try {
    const { query, brand, category, minPrice, maxPrice, fuelType, transmission, city } = req.query;

    const where = { isSuspended: false, isAvailable: true };

    if (query) where.model = { contains: query, mode: "insensitive" };
    if (brand) where.brandId = Number(brand);
    if (category) where.categoryId = Number(category);
    if (fuelType) where.fuelType = fuelType;
    if (transmission) where.transmission = transmission.toLowerCase();

    if (minPrice || maxPrice) {
      where.pricePerDay = {};
      if (minPrice) where.pricePerDay.gte = Number(minPrice);
      if (maxPrice) where.pricePerDay.lte = Number(maxPrice);
    }

    if (city) {
      where.company = { city: { contains: city, mode: "insensitive" } };
    }

    const cars = await prisma.car.findMany({
      where,
      include: {
        company: { select: { name: true, address: true, city: true, rating: true } },
        category: { select: { name: true, icon: true } },
        brand: { select: { name: true, logo: true } }
      }
    });

    const carsWithDiscount = await applyDiscountToCars(cars);
    res.status(200).json({ success: true, count: carsWithDiscount.length, cars: carsWithDiscount });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getCarDetails = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const car = await prisma.car.findUnique({
      where: { id },
      include: {
        company: { select: { name: true, phone: true, address: true, rating: true, logo: true } },
        category: { select: { name: true, icon: true } },
        brand: { select: { name: true, logo: true } }
      }
    });
    
    if (!car) return res.status(404).json({ success: false, message: "Car not found" });
    
    const reviews = await prisma.booking.findMany({
      where: { carId: id, status: "completed", rating: { not: null } },
      include: { user: { select: { name: true, avatar: true } } },
      select: { rating: true, review: true, createdAt: true, user: true },
      orderBy: { createdAt: "desc" }
    });
    
    const carWithDiscount = await applyDiscountToCar(car);
    res.status(200).json({ success: true, car: carWithDiscount, reviews });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getCarAvailability = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) return res.status(400).json({ success: false, message: "Dates required" });
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    const car = await prisma.car.findUnique({ where: { id: Number(req.params.id) } });
    if (!car) return res.status(404).json({ success: false, message: "Car not found" });

    const conflicts = await prisma.booking.findMany({
      where: {
        carId: Number(req.params.id),
        status: { in: ["pending", "confirmed"] },
        OR: [
          { startDate: { lte: end }, endDate: { gte: start } }
        ]
      }
    });
    
    res.status(200).json({ success: true, isAvailable: conflicts.length === 0 && car.isAvailable && !car.isSuspended });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getHomeCars = async (req, res) => {
  try {
    const where = { isAvailable: true, isSuspended: false };
    const include = {
      company: { select: { name: true, rating: true } },
      category: { select: { name: true, icon: true } },
      brand: { select: { name: true, logo: true } }
    };

    const [topRated, cheapest, newest] = await Promise.all([
      prisma.car.findMany({ where, orderBy: { rating: "desc" }, take: 8, include }),
      prisma.car.findMany({ where, orderBy: { pricePerDay: "asc" }, take: 8, include }),
      prisma.car.findMany({ where, orderBy: { createdAt: "desc" }, take: 8, include })
    ]);
    
    const [topRatedWD, cheapestWD, newestWD] = await Promise.all([
      applyDiscountToCars(topRated),
      applyDiscountToCars(cheapest),
      applyDiscountToCars(newest)
    ]);
    
    res.status(200).json({ 
      success: true, 
      data: { topRated: topRatedWD, cheapest: cheapestWD, newest: newestWD } 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const toggleCarAvailability = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const car = await prisma.car.findUnique({ where: { id } });
    const updatedCar = await prisma.car.update({
      where: { id },
      data: { isAvailable: !car.isAvailable }
    });
    res.status(200).json({ success: true, isAvailable: updatedCar.isAvailable });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getCompanyAnalytics = async (req, res) => {
  try {
    const isCompany = req.user.role.toLowerCase() === "company";
    const companyId = isCompany ? Number(req.user.companyId) : (req.query.companyId ? Number(req.query.companyId) : null);
    
    const where = companyId ? { companyId } : {};

    const [stats, carStats, globalStats] = await Promise.all([
      prisma.booking.aggregate({
        where: { ...where, status: "completed" },
        _sum: { totalPrice: true },
        _count: { id: true }
      }),
      prisma.car.groupBy({
        by: ['categoryId'],
        where,
        _count: { id: true },
        _avg: { pricePerDay: true }
      }),
      !companyId ? prisma.car.aggregate({
        _count: { id: true },
        _avg: { pricePerDay: true }
      }) : Promise.resolve(null)
    ]);

    const analytics = {
      totalRevenue: Number(stats._sum.totalPrice || 0),
      totalBookings: stats._count.id,
      totalCars: companyId ? (carStats.reduce((acc, curr) => acc + curr._count.id, 0)) : (globalStats?._count.id || 0),
      availableCars: await prisma.car.count({ where: { ...where, isAvailable: true, isSuspended: false } }),
      averagePrice: companyId ? (carStats.reduce((acc, curr) => acc + Number(curr._avg.pricePerDay || 0), 0) / (carStats.length || 1)) : Number(globalStats?._avg.pricePerDay || 0)
    };

    res.status(200).json({ 
      success: true, 
      analytics, 
      inventoryDistribution: carStats 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getCarsByCompany = async (req, res) => {
  try {
    const companyId = req.user.role.toLowerCase() === "company" ? req.user.companyId : Number(req.params.companyId);
    const { page = 1, limit = 10 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const [cars, total] = await Promise.all([
      prisma.car.findMany({
        where: { companyId: Number(companyId) },
        skip,
        take: Number(limit),
        include: { category: { select: { name: true, icon: true } }, brand: { select: { name: true, logo: true } } },
        orderBy: { createdAt: "desc" }
      }),
      prisma.car.count({ where: { companyId: Number(companyId) } })
    ]);

    const carsWithDiscount = await applyDiscountToCars(cars);
    res.status(200).json({ success: true, count: carsWithDiscount.length, cars: carsWithDiscount, pagination: { total, page: Number(page), limit: Number(limit) } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getCarsByBrand = async (req, res) => {
  try {
    const brandId = Number(req.params.brandId);
    const { page = 1, limit = 10 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const [cars, total] = await Promise.all([
      prisma.car.findMany({
        where: { brandId, isAvailable: true, isSuspended: false },
        skip,
        take: Number(limit),
        include: { company: { select: { name: true, rating: true } }, category: { select: { name: true, icon: true } }, brand: { select: { name: true, logo: true } } }
      }),
      prisma.car.count({ where: { brandId, isAvailable: true, isSuspended: false } })
    ]);

    const carsWithDiscount = await applyDiscountToCars(cars);
    res.status(200).json({ success: true, cars: carsWithDiscount, pagination: { total, page: Number(page), limit: Number(limit) } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getRecommendedCarsAction = async (req, res) => {
  try {
    const cars = await prisma.car.findMany({
      where: { isAvailable: true, isSuspended: false },
      orderBy: [{ totalBookings: "desc" }, { rating: "desc" }],
      take: 8,
      include: { company: { select: { name: true, rating: true } }, category: { select: { name: true, icon: true } }, brand: { select: { name: true, logo: true } } }
    });
    const carsWithDiscount = await applyDiscountToCars(cars);
    res.status(200).json({ success: true, cars: carsWithDiscount });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};