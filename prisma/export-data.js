import { PrismaClient } from '@prisma/client';
import fs from 'fs';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Starting Export from Local DB ---');
  
  const data = {};

  // List of tables to export in order (to handle relationships)
  const tables = [
    'brand',
    'category',
    'company',
    'car',
    'ad',
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
    console.log(`Exporting ${table}...`);
    data[table] = await prisma[table].findMany();
  }

  fs.writeFileSync('prisma/data_dump.json', JSON.stringify(data, null, 2));
  console.log('--- Export Finished! Data saved to prisma/data_dump.json ---');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
