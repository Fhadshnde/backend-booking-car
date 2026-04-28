import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Fixing Database Sequences ---');
  
  // List of tables with autoincrement IDs
  const tables = [
    'User', 'Company', 'Car', 'Driver', 'PromoCode', 'Booking', 
    'Notification', 'Brand', 'Category', 'Ad', 'Favorite', 'Review',
    'Ticket', 'TicketMessage', 'WalletTopUpRequest'
  ];

  for (const table of tables) {
    try {
      // Find the current max ID
      const result = await prisma.$queryRawUnsafe(`SELECT MAX(id) as max FROM "${table}"`);
      const maxId = result[0].max || 0;
      
      // We will set the next ID to be much higher than current maxId to be safe, 
      // or at least maxId + 1. Let's use 1000 if maxId is small.
      const nextId = Math.max(maxId + 1, 1000);
      
      const sequenceName = `"${table}_id_seq"`;
      // Use ALTER SEQUENCE to be more definitive
      await prisma.$executeRawUnsafe(`ALTER SEQUENCE ${sequenceName} RESTART WITH ${nextId}`);
      
      console.log(`Reset sequence for ${table}. Next ID will be: ${nextId}`);
    } catch (err) {
      console.error(`Failed to reset sequence for ${table}:`, err.message);
    }
  }

  console.log('--- All Sequences Updated! ---');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
