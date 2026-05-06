import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const b = await prisma.booking.findUnique({ where: { confirmationCode: 'GKXZSFNG' } });
  console.log("ID for GKXZSFNG:", b.id);
}
main().catch(console.error).finally(() => prisma.$disconnect());
