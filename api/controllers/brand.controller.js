import Brand from "../models/brand.model.js";

export const getAllBrands = async (req, res) => {
  try {
    const brands = await Brand.find({ isActive: true }).lean();
    res.status(200).json({ success: true, brands });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createBrand = async (req, res) => {
  try {
    const brand = await Brand.create(req.body);
    res.status(201).json({ success: true, brand });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

