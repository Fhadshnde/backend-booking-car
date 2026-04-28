import { prisma } from "../lib/prisma.js";
import { applyDiscountToCars } from "./car.controller.js";

export const getCategories = async (req, res) => {
  try {
    const categories = await prisma.category.findMany({ where: { isActive: true } });
    res.status(200).json({ success: true, categories });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch categories" });
  }
};

export const getCategoryCars = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [cars, total] = await prisma.$transaction([
      prisma.car.findMany({
        where: { categoryId: id, isSuspended: false },
        skip,
        take: parseInt(limit),
        include: { 
          company: { select: { name: true, rating: true, city: true, address: true, phone: true } }, 
          category: { select: { name: true, icon: true } } 
        }
      }),
      prisma.car.count({ where: { categoryId: id, isSuspended: false } })
    ]);

    const carsWithDiscounts = await applyDiscountToCars(cars);

    res.status(200).json({
      success: true,
      cars: carsWithDiscounts,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch category cars" });
  }
};

// category.controller.js
export const createCategory = async (req, res) => {
  try {
    const { name, description } = req.body;
    
    // إضافة فحص بسيط
    if (!name) {
       return res.status(400).json({ success: false, message: "اسم الفئة مطلوب" });
    }

    const iconPath = req.file ? `/uploads/${req.file.filename}` : null;

    const category = await prisma.category.create({
      data: {
        name,
        description,
        icon: iconPath,
        slug: name.toLowerCase().replace(/ /g, '-')
      }
    });
    
    res.status(201).json({ success: true, category });
  } catch (error) {
    // هنا تكمن المشكلة: أنت ترسل رسالة عامة، غيرها لترى الخطأ الحقيقي:
    console.error("Prisma Error:", error); 
    res.status(500).json({ success: false, message: error.message }); 
  }
};