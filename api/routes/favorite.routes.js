import express from "express";
import { toggleFavorite, getMyFavorites } from "../controllers/favorite.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(protect);

router.get("/", getMyFavorites);
router.post("/toggle", toggleFavorite);

export default router;