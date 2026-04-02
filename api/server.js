import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import mongoose from "mongoose";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import mongoSanitize from "express-mongo-sanitize";

// **Routes**
import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/user.routes.js";
import companyRoutes from "./routes/company.routes.js";
import carRoutes from "./routes/car.routes.js";
import bookingRoutes from "./routes/booking.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import commissionRoutes from "./routes/commissionRoutes.js";
import categoryRoutes from "./routes/category.routes.js";
import adRoutes from "./routes/ad.routes.js";
import brandRoutes from "./routes/brand.routes.js";
import favoriteRoutes from "./routes/favorite.routes.js";
import notificationRoutes from "./routes/notification.routes.js";
import paymentRoutes from "./routes/payment.routes.js";
import reviewRoutes from "./routes/review.routes.js";
import settingRoute from "./routes/settings.routes.js";
dotenv.config();

const app = express();

// ============= Security Middleware =============
// HTTP Security Headers
app.use(helmet());

// CORS - تقييد الـ domains المسموحة
const allowedOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(",")
  : ["http://localhost:3000", "http://localhost:8081", "http://localhost:19006"];

app.use(cors({
  origin: function (origin, callback) {
    // السماح بالطلبات بدون origin (مثل تطبيقات الموبايل و Postman)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error("Not allowed by CORS"), false);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

// منع NoSQL Injection
app.use(mongoSanitize());

// Body parsing
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// HTTP request logging (في بيئة التطوير فقط)
if (process.env.NODE_ENV !== "production") {
  app.use(morgan("dev"));
}

// ============= Rate Limiting =============
// Rate limit عام
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 دقيقة
  max: 200,
  message: {
    success: false,
    message: "طلبات كثيرة جداً. حاول مرة أخرى بعد 15 دقيقة"
  },
  standardHeaders: true,
  legacyHeaders: false
});
app.use("/api", globalLimiter);

// Rate limit مشدد على المصادقة
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 دقيقة
  max: 10, // 10 محاولات فقط
  message: {
    success: false,
    message: "محاولات تسجيل دخول كثيرة. حاول مرة أخرى بعد 15 دقيقة"
  },
  standardHeaders: true,
  legacyHeaders: false
});
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);

// ============= Database Connection =============
let isConnected = false;

const connectDB = async () => {
  if (isConnected) return;

  try {
    const db = await mongoose.connect(process.env.MONGODB_URI);
    isConnected = db.connections[0].readyState;
    console.log("✅ MongoDB connected");
  } catch (error) {
    console.error("❌ MongoDB connection error:", error.message);
  }
};

await connectDB();

// ============= Routes =============
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/companies", companyRoutes);
app.use("/api/cars", carRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/commissions", commissionRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/ads", adRoutes);
app.use("/api/brands", brandRoutes);
app.use("/api/favorites", favoriteRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/settings", settingRoute);

// Health check
app.get("/api/health", (req, res) => {
  res.json({ success: true, message: "Server is running" });
});

// DB test (تطوير فقط)
if (process.env.NODE_ENV !== "production") {
  app.get("/api/test-db", async (req, res) => {
    try {
      await mongoose.connection.db.admin().ping();
      res.json({ success: true, message: "MongoDB connected!" });
    } catch (err) {
      res.status(500).json({ success: false, message: "MongoDB connection failed" });
    }
  });
}

import testMongoRouter from "./routes/testMongo.js";
app.use("/api", testMongoRouter);

// ============= Error Handling =============
// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);

  const statusCode = err.statusCode || err.status || 500;
  const message = err.isOperational
    ? err.message
    : "حدث خطأ داخلي في السيرفر";

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV !== "production" && { error: err.message, stack: err.stack })
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: "المسار غير موجود" });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT} in ${process.env.NODE_ENV || "development"} mode`);
});

export default app;
