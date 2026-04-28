import { PrismaClient } from '@prisma/client';
import fs from 'fs';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Starting Import to Neon DB ---');
  
  const rawData = fs.readFileSync('prisma/data_dump.json');
  const data = JSON.parse(rawData);

  // Order matters for insertion due to foreign key constraints
  const tables = [
    'brand',
    'category',
    'company',
    'ad',
    'car',
    'user',
    'promoCode',
    'driver',
    'setting',
    'booking',
    'commission',
    'notification',
    'walletTopUpRequest',
    'favorite',
    'review',
    'conversation',
    'message',
    'ticket',
    'ticketMessage',
    'damageReport'
  ];

  for (const table of tables) {
    const items = data[table];
    if (items && items.length > 0) {
      console.log(`Importing ${items.length} items into ${table}...`);
      
      // We use createMany for speed if supported, or loop through create
      for (const item of items) {
        try {
          await prisma[table].create({
            data: item
          });
        } catch (err) {
          console.error(`Failed to import item into ${table}:`, err.message);
        }
      }
    }
  }

  console.log('--- Import Finished! Your data is now on Neon ---');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
