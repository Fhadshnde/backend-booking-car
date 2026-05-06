import express from "express";
import { getBlacklist, addToBlacklist, removeFromBlacklist } from "../controllers/blacklist.controller.js";
import { protect, restrictTo } from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(protect);
router.use(restrictTo("admin"));

router.get("/", getBlacklist);
router.post("/", addToBlacklist);
router.delete("/:id", removeFromBlacklist);

export default router;
