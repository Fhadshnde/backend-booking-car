import { prisma } from "../lib/prisma.js";

export const getAllBrands = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [brands, total] = await prisma.$transaction([
      prisma.brand.findMany({
        skip,
        take: parseInt(limit),
        orderBy: { id: "desc" }
      }),
      prisma.brand.count()
    ]);

    res.status(200).json({
      success: true,
      brands,
      pagination: { 
        total, 
        page: parseInt(page), 
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const carInBrand = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const brandId = parseInt(req.params.id);

    const [cars, total] = await prisma.$transaction([
      prisma.car.findMany({
        where: { brandId },
        skip,
        take: parseInt(limit),
        include: { 
          company: { select: { name: true, rating: true } }, 
          category: { select: { name: true } } 
        }
      }),
      prisma.car.count({ where: { brandId } })
    ]);

    res.status(200).json({
      success: true,
      cars,
      pagination: { 
        total, 
        page: parseInt(page), 
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createBrand = async (req, res) => {
  try {
    const { name, logo, description, isActive } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: "اسم الماركة مطلوب" });
    }

    const brand = await prisma.brand.create({
      data: {
        name,
        logo: logo || null,
        description: description || null,
        isActive: isActive !== undefined ? isActive : true
      }
    });

    res.status(201).json({ success: true, brand });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateBrand = async (req, res) => {
  try {
    const { id } = req.params;
    const brandId = parseInt(id);

    const brand = await prisma.brand.update({
      where: { id: brandId },
      data: req.body
    });

    res.status(200).json({ success: true, brand });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteBrand = async (req, res) => {
  try {
    const { id } = req.params;
    const brandId = parseInt(id);

    await prisma.brand.delete({
      where: { id: brandId }
    });

    res.status(200).json({ success: true, message: "تم حذف الماركة بنجاح" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};