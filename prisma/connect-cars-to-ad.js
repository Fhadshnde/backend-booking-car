import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const adId = 2; // رقم الإعلان الذي وجدته
  
  console.log(`Connecting all cars to Ad ID: ${adId}...`);
  
  const cars = await prisma.car.findMany({ select: { id: true } });
  const carIds = cars.map(c => c.id);
  
  if (carIds.length === 0) {
    console.log('No cars found in database.');
    return;
  }

  const updatedAd = await prisma.ad.update({
    where: { id: adId },
    data: {
      cars: {
        connect: carIds.map(id => ({ id }))
      }
    },
    include: { _count: { select: { cars: true } } }
  });

  console.log(`Success! Connected ${updatedAd._count.cars} cars to Ad ID: ${adId}.`);
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
