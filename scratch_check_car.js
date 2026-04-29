import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const car = await prisma.car.findFirst({
    where: {
      model: {
        contains: 'Land Cruiser',
        mode: 'insensitive'
      }
    }
  });
  console.log(JSON.stringify(car, null, 2));
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
