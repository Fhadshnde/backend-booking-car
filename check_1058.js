import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const b = await prisma.booking.findUnique({ where: { id: 1058 } });
  console.log("ID:", b.id);
  console.log("totalPrice:", b.totalPrice);
  console.log("deposit:", b.deposit);
  console.log("walletDiscount:", b.walletDiscount);
}
main().catch(console.error).finally(() => prisma.$disconnect());
