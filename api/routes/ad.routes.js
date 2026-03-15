import express from "express";
import * as adController from "../controllers/ad.controller.js";

const router = express.Router();

router.get("/", adController.getAllAds);
router.get("/:id", adController.getAdById);
router.post("/", adController.createAd);
router.patch("/:id", adController.updateAd);
router.delete("/:id", adController.deleteAd);

export default router;