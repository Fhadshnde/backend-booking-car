import { prisma } from "../lib/prisma.js";

export const toggleFavorite = async (req, res) => {
  try {
    const { carId } = req.body;
    const userId = req.user.id;

    const existingFavorite = await prisma.favorite.findUnique({
      where: {
        userId_carId: { userId, carId: parseInt(carId) }
      }
    });

    if (existingFavorite) {
      await prisma.favorite.delete({
        where: { id: existingFavorite.id }
      });
      return res.status(200).json({ success: true, isFavorite: false, message: "Removed from favorites" });
    }

    await prisma.favorite.create({
      data: { userId, carId: parseInt(carId) }
    });
    res.status(201).json({ success: true, isFavorite: true, message: "Added to favorites" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const getMyFavorites = async (req, res) => {
  try {
    const favorites = await prisma.favorite.findMany({
      where: { userId: req.user.id },
      include: {
        car: {
          include: {
            brand: { select: { name: true, logo: true } },
            category: { select: { name: true, icon: true } },
            company: { select: { name: true, rating: true } }
          }
        }
      }
    });

    const cars = favorites.map(fav => fav.car).filter(car => car !== null);

    res.status(200).json({
      success: true,
      count: cars.length,
      cars
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};