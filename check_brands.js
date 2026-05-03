import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const brands = await prisma.brand.findMany();
  console.log('Brands in database:', JSON.stringify(brands, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
