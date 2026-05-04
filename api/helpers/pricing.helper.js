import { prisma } from "../lib/prisma.js";

/**
 * Calculates the number of rental days based on start and end dates.
 * Includes a 2-hour grace period logic.
 */
export const calculateTotalDays = (startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  const diffTime = end - start;
  if (diffTime <= 0) return 0;
  
  const diffHours = diffTime / (1000 * 60 * 60);
  const GRACE_PERIOD = 2; // 2 hours grace period
  
  // If less than 24 hours, count as 1 day.
  // If more, subtract grace period and divide by 24.
  const totalDays = diffHours <= 24 ? 1 : Math.ceil((diffHours - GRACE_PERIOD) / 24);
  
  return totalDays;
};

/**
 * Calculates the current price per day for a car, considering active ads and discounts.
 */
export const getCarCurrentPrice = async (car, date = new Date()) => {
  const today = new Date(date);
  
  // 1. Check for active Ads first (highest priority)
  const activeAd = await prisma.ad.findFirst({
    where: {
      cars: { some: { id: car.id } },
      isActive: true,
      endDate: { gte: today },
      startDate: { lte: today }
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
  } else if (car.discountPrice > 0 && car.discountPrice < originalPrice && (!car.offerEndsAt || new Date(car.offerEndsAt) > today)) {
    currentPrice = car.discountPrice;
  }

  return {
    currentPrice: Math.floor(currentPrice),
    originalPrice,
    discountPercentage,
    isPromo: discountPercentage > 0 || currentPrice < originalPrice
  };
};

/**
 * Calculates the full breakdown of prices for a booking.
 */
export const calculateBookingBreakdown = async ({
  car,
  startDate,
  endDate,
  useInsurance,
  hasDriver,
  promoCodeId,
  pickupLocation,
  walletAmount = 0,
  settings = null,
  userId = null
}) => {
  const globalSettings = settings || await prisma.setting.findFirst({ orderBy: { createdAt: "desc" } });
  
  const totalDays = calculateTotalDays(startDate, endDate);
  const pricing = await getCarCurrentPrice(car, startDate);
  const currentPrice = pricing.currentPrice;
  
  const basePrice = totalDays * currentPrice;

  // Insurance
  let insurancePrice = 0;
  if (useInsurance) {
    insurancePrice = car.insurancePrice || (globalSettings ? globalSettings.insurancePrice : 0);
  }

  // Driver
  let driverPrice = 0;
  if (hasDriver) {
    const driverPricePerDay = (car.driverPricePerDay !== null && car.driverPricePerDay !== undefined) 
      ? car.driverPricePerDay 
      : (globalSettings?.defaultDriverPrice ?? 0);
    driverPrice = totalDays * driverPricePerDay;
  }

  // Delivery Fee
  const isOfficePickup = !pickupLocation || pickupLocation === "مكتب الشركة الرئيسي" || pickupLocation === "مكتب الشركة";
  const deliveryFee = (isOfficePickup || hasDriver) ? 0 : (globalSettings?.deliveryFee || 0);

  let totalPriceBeforePromo = basePrice + insurancePrice + driverPrice + deliveryFee;

  // Promo Code
  let discountAmount = 0;
  if (promoCodeId) {
    const promo = await prisma.promoCode.findUnique({ where: { id: promoCodeId } });
    if (promo && promo.isActive) {
      if (promo.type === "percentage") {
        discountAmount = (totalPriceBeforePromo * promo.value) / 100;
        if (promo.maxDiscount && discountAmount > promo.maxDiscount) {
          discountAmount = promo.maxDiscount;
        }
      } else {
        discountAmount = promo.value;
      }
    }
  }

  const totalPrice = Math.max(0, totalPriceBeforePromo - discountAmount);

  // Deposit Logic (Tiered based on trust)
  let depositPercentage = globalSettings ? globalSettings.depositPercentage : 0.3;
  
  if (userId) {
    const user = await prisma.user.findUnique({ 
      where: { id: userId },
      include: { 
        _count: { 
          select: { 
            bookings: { where: { status: "completed" } } 
          } 
        } 
      }
    });

    if (user && user.identityStatus === "verified") {
      if (user._count.bookings >= 3) {
        depositPercentage = 0; // "Elite" status: 0% deposit
      } else {
        depositPercentage = 0.15; // "Verified" status: 15% deposit instead of 30%
      }
    }
  }

  const initialDepositAmount = Math.floor(totalPrice * depositPercentage);
  
  const walletDiscount = Math.min(walletAmount, totalPrice);
  const remainingDeposit = Math.max(0, initialDepositAmount - walletDiscount);

  // Determine Payment Status
  let paymentStatus = "pending";
  if (walletDiscount >= totalPrice) {
    paymentStatus = "paid";
  } else if (walletDiscount >= initialDepositAmount) {
    paymentStatus = "verified";
  }

  return {
    totalDays,
    pricePerDay: currentPrice,
    basePrice,
    insurancePrice,
    driverPrice,
    deliveryFee,
    discountAmount,
    totalPrice,
    initialDepositAmount,
    walletDiscount,
    remainingDeposit,
    paymentStatus,
    depositPercentage
  };
};
