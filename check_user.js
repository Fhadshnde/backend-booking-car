import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({
    where: { phone: '12341234' }
  });
  
  if (user) {
    console.log("User Found:", {
      id: user.id,
      name: user.name,
      phone: user.phone,
      identityStatus: user.identityStatus,
      licenseNumber: user.licenseNumber,
      isVerified: user.isVerified
    });
  } else {
    console.log("User not found with phone 12341234");
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
