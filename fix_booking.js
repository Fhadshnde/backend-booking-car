import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  await prisma.booking.update({ 
    where: { confirmationCode: 'GKXZSFNG' },
    data: {
      deposit: 152500,
      paymentStatus: 'pending'
    }
  });
  console.log("Fixed GKXZSFNG");
}
main().catch(console.error).finally(() => prisma.$disconnect());
