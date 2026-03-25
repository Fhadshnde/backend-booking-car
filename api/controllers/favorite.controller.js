import Favorite from "../models/favorite.model.js";
import Car from "../models/car.model.js";

export const toggleFavorite = async (req, res) => {
  try {
    const { carId } = req.body;
    const userId = req.user._id;

    const existingFavorite = await Favorite.findOne({ userId, carId });

    if (existingFavorite) {
      await Favorite.findByIdAndDelete(existingFavorite._id);
      return res.status(200).json({ success: true, isFavorite: false, message: "Removed from favorites" });
    }

    await Favorite.create({ userId, carId });
    res.status(201).json({ success: true, isFavorite: true, message: "Added to favorites" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const getMyFavorites = async (req, res) => {
  try {
    const favorites = await Favorite.find({ userId: req.user._id })
      .populate({
        path: "carId",
        populate: [
          { path: "brand", select: "name logo" },
          { path: "category", select: "name icon" }
        ]
      })
      .lean();

    const cars = favorites.map(fav => fav.carId).filter(car => car !== null);

    res.status(200).json({
      success: true,
      count: cars.length,
      cars
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};