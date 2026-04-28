import { prisma } from "../lib/prisma.js";

export const getAllAds = async (req, res) => {
  try {
    const ads = await prisma.ad.findMany({ 
      where: { isActive: true },
      include: { cars: true } 
    });
    res.status(200).json({ success: true, results: ads.length, ads });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch ads" });
  }
};

export const getAdById = async (req, res) => {
  try {
    const ad = await prisma.ad.findUnique({ 
      where: { id: parseInt(req.params.id) },
      include: { cars: true } // سيقوم Prisma بجلب تفاصيل كل السيارات المرتبطة تلقائياً
    });
    
    if (!ad) return res.status(404).json({ success: false, message: "Ad not found" });
    
    res.status(200).json({ success: true, ad });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch ad" });
  }
};

export const createAd = async (req, res) => {
  try {
    const { title, subTitle, image, discountPercentage, carIds, endDate, isActive } = req.body;

    const ad = await prisma.ad.create({
      data: {
        title,
        subTitle,
        image,
        discountPercentage: parseFloat(discountPercentage),
        cars: {
          connect: carIds.map(id => ({ id: parseInt(id) }))
        },
        isActive: isActive !== undefined ? isActive : true,
        endDate: new Date(endDate)
      }
    });
    res.status(201).json({ success: true, ad });
  } catch (error) {
    console.error("Error creating ad:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateAd = async (req, res) => {
  try {
    const { carIds, ...updateData } = req.body;
    
    const ad = await prisma.ad.update({
      where: { id: parseInt(req.params.id) },
      data: {
        ...updateData,
        cars: carIds ? {
          set: carIds.map(id => ({ id: parseInt(id) }))
        } : undefined
      }
    });
    res.status(200).json({ success: true, ad });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to update ad" });
  }
};

export const deleteAd = async (req, res) => {
  try {
    await prisma.ad.delete({ where: { id: parseInt(req.params.id) } });
    res.status(204).json({ success: true, data: null });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to delete ad" });
  }
};