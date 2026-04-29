import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const settings = await prisma.setting.findFirst({
    orderBy: { createdAt: 'desc' }
  });
  console.log('Current Settings:', JSON.stringify(settings, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
