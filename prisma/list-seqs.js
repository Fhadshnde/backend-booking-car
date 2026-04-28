import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const sequences = await prisma.$queryRaw`SELECT relname FROM pg_class WHERE relkind = 'S'`;
  console.log('--- Database Sequences ---');
  console.log(JSON.stringify(sequences, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
