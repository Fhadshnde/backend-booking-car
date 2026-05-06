import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  const bookings = await prisma.booking.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    select: { confirmationCode: true, status: true, paymentStatus: true }
  });
  console.log('Recent bookings:', bookings);
}

check().finally(() => prisma.$disconnect());
