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
  getCarsByBrand,
  getRecommendedCars
} from "../controllers/car.controller.js";

import { protect, optionalAuth, restrictTo } from "../middleware/auth.middleware.js";
import { uploadCarImages } from "../middleware/upload.js";
import { validate, createCarSchema, updateCarSchema } from "../middleware/validation.js";

const router = express.Router();

router.get("/", optionalAuth, getCars);
router.get("/home/cars", getHomeCars);
router.get("/recommended", getRecommendedCars);
router.get("/search", searchCars);
router.get("/brand/:brandId", getCarsByBrand);
router.get("/company/:companyId", optionalAuth, getCarsByCompany);
router.get("/:id", getCar);
router.get("/:id/details", getCarDetails);
router.get("/:id/availability", getCarAvailability);

router.get("/analytics", protect, restrictTo("company", "admin"), getCompanyAnalytics);
router.patch("/:id/toggle-status", protect, restrictTo("admin", "company"), toggleCarAvailability);

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

export default router;