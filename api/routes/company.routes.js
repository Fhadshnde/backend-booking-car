import express from "express";
import { getCompanies, getCompany, createCompany, updateCompany, deleteCompany, getCompanyProfile, updateCompanyProfile, getCompanyDashboard, getCompanyCars } from "../controllers/company.controller.js";
import { protect, restrictTo } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/", getCompanies);
router.get("/:id", getCompany);

router.post("/", protect, restrictTo("admin"), createCompany);
router.put("/:id", protect, restrictTo("admin"), updateCompany);
router.delete("/:id", protect, restrictTo("admin"), deleteCompany);

router.get("/profile/view", protect, restrictTo("company"), getCompanyProfile);
router.put("/profile/update", protect, restrictTo("company"), updateCompanyProfile);
router.get("/dashboard/main", protect, restrictTo("company"), getCompanyDashboard);
router.get("/:companyId/cars", protect, getCompanyCars);

export default router;