import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const category = await prisma.category.create({
    data: {
      name: "سيارات فاخرة",
      icon: "https://static1.topspeedimages.com/wordpress/wp-content/uploads/2024/03/2024-mercedes-amg-gls-63.jpg",
      description: "تضم هذه الفئة السيارات الراقية والفاخرة.",
      isActive: true,
      slug: "سيارات-فاخرة"
    }
  });
  console.log('Successfully created category:', JSON.stringify(category, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
