import express from "express";
import { 
  createPaymentIntent, 
  confirmPayment, 
  stripeWebhook, 
  getPaymentStatus 
} from "../controllers/payment.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/webhook", stripeWebhook);
router.post("/create-intent", protect, createPaymentIntent);
router.post("/confirm", protect, confirmPayment);
router.get("/status/:bookingId", protect, getPaymentStatus);

export default router;