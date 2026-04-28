import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function test() {
  try {
    const where = { isAvailable: true, isSuspended: false };
    const include = {
      company: { select: { name: true, rating: true } },
      category: { select: { name: true, icon: true } },
      brand: { select: { name: true, logo: true } }
    };

    console.log("Fetching cars...");
    const [topRated, cheapest, newest] = await Promise.all([
      prisma.car.findMany({ where, orderBy: { rating: "desc" }, take: 8, include }),
      prisma.car.findMany({ where, orderBy: { pricePerDay: "asc" }, take: 8, include }),
      prisma.car.findMany({ where, orderBy: { createdAt: "desc" }, take: 8, include })
    ]);
    
    console.log(`Found ${topRated.length} top rated, ${cheapest.length} cheapest, ${newest.length} newest.`);

    const applyDiscountToCars = async (cars) => {
      if (!cars || cars.length === 0) return [];
      
      const carIds = cars.map(car => car.id);
      
      console.log(`Checking ads for car IDs: ${carIds}`);
      const activeAds = await prisma.ad.findMany({
        where: {
          cars: { some: { id: { in: carIds } } },
          isActive: true,
          endDate: { gte: new Date() }
        },
        include: { cars: { select: { id: true } } }
      });
      
      console.log(`Found ${activeAds.length} active ads.`);

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
      
      return cars.map(car => {
        const discount = discountMap.get(car.id);
        const discountPercentage = discount ? discount.discountPercentage : 0;
        const originalPrice = car.pricePerDay;
        const today = new Date();
        const hasDirectDiscount = car.discountPrice > 0 && (!car.offerEndsAt || new Date(car.offerEndsAt) > today);

        let finalDiscountPercent = discountPercentage;
        let finalCurrentPrice = originalPrice * (1 - discountPercentage / 100);

        if (hasDirectDiscount && (discountPercentage === 0 || car.discountPrice < finalCurrentPrice)) {
          finalCurrentPrice = car.discountPrice;
          finalDiscountPercent = Math.round(((originalPrice - finalCurrentPrice) / originalPrice) * 100);
        }
        
        return {
          ...car,
          originalPrice,
          discountedPrice: finalCurrentPrice,
          currentPrice: finalCurrentPrice,
          discountPercentage: finalDiscountPercent,
          hasDiscount: finalDiscountPercent > 0,
          discountAd: discount ? discount.discountAd : null
        };
      });
    };

    const results = await applyDiscountToCars(topRated);
    console.log("Success! Sample car:", results[0]?.model);
  } catch (error) {
    console.error("CRASHED:", error);
  } finally {
    await prisma.$disconnect();
  }
}

test();
