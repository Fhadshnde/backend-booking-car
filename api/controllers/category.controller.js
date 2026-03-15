import Category from "../models/category.model.js";
import Car from "../models/car.model.js";

export const getCategories = async (req, res) => {
  try {
    const categories = await Category.find({ isActive: true }).lean();
    res.status(200).json({ success: true, categories });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch categories" });
  }
};

export const getCategoryCars = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);
    const skip = (pageNumber - 1) * limitNumber;

    const [cars, total] = await Promise.all([
      Car.find({ category: id, isSuspended: false })
        .skip(skip)
        .limit(limitNumber)
        .populate("companyId", "name rating city")
        .populate("category", "name icon")
        .lean(),
      Car.countDocuments({ category: id, isSuspended: false })
    ]);

    res.status(200).json({
      success: true,
      cars,
      pagination: {
        total,
        page: pageNumber,
        limit: limitNumber,
        pages: Math.ceil(total / limitNumber)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch category cars" });
  }
};

export const createCategory = async (req, res) => {
  try {
    const { name, description, icon, image } = req.body;
    const slug = name.toLowerCase().replace(/ /g, '-');

    const category = await Category.create({
      name,
      slug,
      description,
      icon,
      image,
      createdBy: req.user.id
    });

    res.status(201).json({ success: true, category });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error creating category" });
  }
};