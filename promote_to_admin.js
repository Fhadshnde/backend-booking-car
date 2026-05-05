import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const phone = '07721603705';
  
  const updatedUser = await prisma.user.update({
    where: { phone: phone },
    data: { role: 'admin' }
  });
  
  console.log(`Success! User ${updatedUser.name} (${updatedUser.phone}) is now an ADMIN.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
