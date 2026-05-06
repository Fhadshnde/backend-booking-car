import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const b = await prisma.booking.findUnique({ where: { confirmationCode: 'GKXZSFNG' } });
  console.log("deposit:", b.deposit);
  console.log("walletDiscount:", b.walletDiscount);
  console.log("totalPrice:", b.totalPrice);
  console.log("paymentStatus:", b.paymentStatus);
}
main().catch(console.error).finally(() => prisma.$disconnect());
