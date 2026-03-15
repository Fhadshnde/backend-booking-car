import express from "express";
import { createPaymentIntent, confirmPayment, stripeWebhook, getPaymentStatus } from "../controllers/payment.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = express.Router();

// Webhook (يجب أن يكون قبل express.json middleware — يتم تسجيله في server.js)
router.post("/webhook", express.raw({ type: "application/json" }), stripeWebhook);

// Routes محمية
router.post("/create-intent", protect, createPaymentIntent);
router.post("/confirm", protect, confirmPayment);
router.get("/status/:bookingId", protect, getPaymentStatus);

export default router;
