import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import path from "path";
import fs from "fs";
import { createServer } from "http";
import { fileURLToPath } from "url";
import { initSocket } from "./lib/socket.js";
import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/user.routes.js";
import companyRoutes from "./routes/company.routes.js";
import carRoutes from "./routes/car.routes.js";
import bookingRoutes from "./routes/booking.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import categoryRoutes from "./routes/category.routes.js";
import adRoutes from "./routes/ad.routes.js";
import brandRoutes from "./routes/brand.routes.js";
import favoriteRoutes from "./routes/favorite.routes.js";
import notificationRoutes from "./routes/notification.routes.js";
import paymentRoutes from "./routes/payment.routes.js";
import reviewRoutes from "./routes/review.routes.js";
import settingRoute from "./routes/settings.routes.js";
import chatRoutes from "./routes/chat.routes.js";
import ticketRoutes from "./routes/ticket.routes.js";
import promoRoutes from "./routes/promo.routes.js";
import driverRoutes from "./routes/driver.routes.js";
import damageReportRoutes from "./routes/damageReport.routes.js";
import { globalErrorHandler } from "./middleware/error.middleware.js";
import AppError from "./helpers/AppError.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

const uploadDir = path.resolve(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

app.use(helmet());

const allowOrigins = process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(",") : ["http://localhost:3000", "http://localhost:8081", "https://backend-booking-car.vercel.app"];
app.use(cors({ origin: allowOrigins, credentials: true }));
app.use(express.json());
app.use(morgan("dev"));

app.use("/uploads", express.static(uploadDir));

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: {
    success: false,
    message: "Too many requests"
  }
});

app.use(globalLimiter);

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/companies", companyRoutes);
app.use("/api/cars", carRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/ads", adRoutes);
app.use("/api/brands", brandRoutes);
app.use("/api/favorites", favoriteRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/settings", settingRoute);
app.use("/api/chat", chatRoutes);
app.use("/api/tickets", ticketRoutes);
app.use("/api/promos", promoRoutes);
app.use("/api/drivers", driverRoutes);
app.use("/api/damage-reports", damageReportRoutes);

app.all("*", (req, res, next) => {
  next(new AppError(`المسار غير موجود: ${req.originalUrl}`, 404));
});

app.use(globalErrorHandler);

const PORT = process.env.PORT || 5000;
const httpServer = createServer(app);
initSocket(httpServer);

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});