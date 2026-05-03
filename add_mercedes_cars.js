import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // 1. Create Mercedes Brand
  const brand = await prisma.brand.create({
    data: {
      name: "مرسيدس-بنز",
      logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/Mercedes-Benz_logo.svg/2048px-Mercedes-Benz_logo.svg.png",
      description: "رمز الفخامة والاداء الألماني العالي.",
      isActive: true
    }
  });
  console.log('Created Brand:', brand.name, 'with ID:', brand.id);

  const luxuryCategoryId = 1002;
  const companyId = 1;

  // 2. Add Mercedes S-Class
  const sClass = await prisma.car.create({
    data: {
      brandId: brand.id,
      categoryId: luxuryCategoryId,
      companyId: companyId,
      model: "S-Class S580",
      year: 2024,
      licensePlate: "LUX-001",
      pricePerDay: 250000,
      color: "أسود ميتاليك",
      transmission: "automatic",
      fuelType: "petrol",
      seats: 5,
      mileage: 100,
      description: "تجربة الرفاهية المطلقة مع مرسيدس S-Class. أحدث التقنيات وأقصى درجات الراحة.",
      features: ["شاشات خلفية", "مقاعد مساج", "نظام صوتي Burmester", "قيادة ذاتية جزئية"],
      images: [
        "https://www.mercedes-benz.com.iq/en/passengercars/models/sedan/s-class/overview/_jcr_content/root/responsivegrid/tabs/tabitem/hotspot_module/image.component.dam_assets.1620133494793.jpg",
        "https://images.mercedes-benz.com/v1/variant/S-Class-Sedan-W223-AMG-Line-Obsidian-Black-Metallic.jpg"
      ],
      isAvailable: true,
      rating: 5.0,
      insurancePrice: 75000,
      driverPricePerDay: 30000
    }
  });
  console.log('Created Car:', sClass.model);

  // 3. Add Mercedes G-Wagon
  const gWagon = await prisma.car.create({
    data: {
      brandId: brand.id,
      categoryId: luxuryCategoryId,
      companyId: companyId,
      model: "G-Class G63 AMG",
      year: 2023,
      licensePlate: "G-6363",
      pricePerDay: 400000,
      color: "مطفي (Matte Black)",
      transmission: "automatic",
      fuelType: "petrol",
      seats: 5,
      mileage: 500,
      description: "وحش الطرقات الوعرة والفخامة، مرسيدس G63 AMG. قوة جبارة وحضور لا يضاهى.",
      features: ["V8 Biturbo", "دفع رباعي مستمر", "داخلية حمراء رياضية", "نظام عادم رياضي"],
      images: [
        "https://static1.topspeedimages.com/wordpress/wp-content/uploads/2024/03/2024-mercedes-amg-gls-63.jpg",
        "https://images.autotrader.com/hn/c/47101859942a4e23961021498894178a.jpg"
      ],
      isAvailable: true,
      rating: 5.0,
      insurancePrice: 100000,
      driverPricePerDay: 50000
    }
  });
  console.log('Created Car:', gWagon.model);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
