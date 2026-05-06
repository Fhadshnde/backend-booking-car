import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const updatedUser = await prisma.user.update({
    where: { phone: '12341234' },
    data: { 
      licenseNumber: 'TEST-123456',
      licenseExpiry: new Date('2030-01-01')
    }
  });
  
  console.log("User Updated Successfully:", {
    id: updatedUser.id,
    phone: updatedUser.phone,
    licenseNumber: updatedUser.licenseNumber
  });
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
