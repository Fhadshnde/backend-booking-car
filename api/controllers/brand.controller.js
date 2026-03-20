import Brand from "../models/brand.model.js";
import { paginate } from "../helpers/pagination.helper.js";
import Car from "../models/car.model.js";

export const getAllBrands = async (req, res) => {
  try {
    const { page, limit } = req.query;

    const result = await paginate(
      Brand,
      { isActive: true },
      {
        page,
        limit,
        sort: { createdAt: -1 }
      }
    );

    res.status(200).json({
      success: true,
      ...result
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const carInBrand = async (req, res) => {
  try {
    const { page, limit } = req.query;

    const result = await paginate(
      Car,
      { brand: req.params.id },
      {
        page,
        limit,
        sort: { createdAt: -1 }
      }
    );

    res.status(200).json({
      success: true,
      ...result
    });

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

export const updateBrand = async (req, res) => {
  try {
    const brand = await Brand.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!brand) {
      return res.status(404).json({ success: false, message: "Brand not found" });
    }
    res.status(200).json({ success: true, brand });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

export const deleteBrand = async (req, res) => {
  try {
    const brand = await Brand.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!brand) {
      return res.status(404).json({ success: false, message: "Brand not found" });
    }    
    res.status(200).json({ success: true, brand });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}


