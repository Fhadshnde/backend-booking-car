import express from "express";
import {
  getCars,
  getCar,
  createCar,
  updateCar,
  deleteCar,
  searchCars,
  getCarDetails,
  getCarAvailability,
  getCarsByCompany,
  getHomeCars,
  toggleCarAvailability,
  getCompanyAnalytics,
  getCarsByBrand, getRecommendedCars

} from "../controllers/car.controller.js";

import { protect } from "../middleware/auth.middleware.js";
import { uploadCarImages } from "../middleware/upload.js";
import { validate, createCarSchema, updateCarSchema } from "../middleware/validation.js";

export const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.map(r => r.toLowerCase()).includes(req.user.role.toLowerCase())) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }
    next();
  };
};

const router = express.Router();

router.get("/home/cars", getHomeCars);
router.get("/recommended", getRecommendedCars);

router.get("/search", protect, searchCars);

router.get("/analytics", protect, restrictTo("company", "admin"), getCompanyAnalytics);

router.get("/company/:companyId", protect, getCarsByCompany);

router.get("/:id/details", protect, getCarDetails);

router.get("/:id/availability", protect, getCarAvailability);

router.patch("/:id/toggle-status", protect, restrictTo("admin", "company"), toggleCarAvailability);

router.get("/:id", protect, getCar);

router.get("/", protect, getCars);

router.post(
  "/",
  protect,
  restrictTo("admin", "company"),
  uploadCarImages,
  validate(createCarSchema),
  createCar
);

router.put(
  "/:id",
  protect,
  restrictTo("admin", "company"),
  uploadCarImages,
  validate(updateCarSchema),
  updateCar
);

router.delete(
  "/:id",
  protect,
  restrictTo("admin", "company"),
  deleteCar
);

router.get("/brand/:brandId", protect, getCarsByBrand);
export default router;

