import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const b = await prisma.booking.findUnique({ where: { confirmationCode: 'GKXZSFNG' } });
  const user = await prisma.user.findUnique({ where: { id: b.userId } });
  const completedCount = await prisma.booking.count({ where: { userId: b.userId, status: "completed" } });
  console.log("Identity Status:", user.identityStatus);
  console.log("Completed Count:", completedCount);
}
main().catch(console.error).finally(() => prisma.$disconnect());
