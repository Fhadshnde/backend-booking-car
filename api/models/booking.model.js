import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.ObjectId, ref: "User", required: true },
    carId: { type: mongoose.Schema.ObjectId, ref: "Car", required: true },
    companyId: { type: mongoose.Schema.ObjectId, ref: "Company", required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    totalDays: { type: Number, required: true },
    pricePerDay: { type: Number, required: true },
    basePrice: { type: Number, default: 0 },
    insurance: { type: Boolean, default: false },
    insurancePrice: { type: Number, default: 0 },
    totalPrice: { type: Number, required: true },
    deposit: { type: Number, default: 0 },
    depositStatus: { 
      type: String, 
      enum: ["pending", "paid", "refunded"], 
      default: "pending" 
    },
    depositPaidAt: { type: Date },
    walletDiscount: { type: Number, default: 0 },
    remainingAmount: { type: Number, default: 0 },
    status: { 
      type: String, 
      enum: ["pending", "confirmed", "on_trip", "completed", "cancelled"], 
      default: "pending" 
    },
    paymentStatus: { 
      type: String, 
      enum: ["pending", "partial", "completed", "failed", "refunded"], 
      default: "pending" 
    },
    paymentMethod: { 
      type: String, 
      enum: ["credit_card", "debit_card", "wallet", "bank_transfer", "cash"], 
      default: "credit_card" 
    },
    confirmationCode: { type: String, unique: true },
    transactionId: { type: String },
    pickupLocation: { type: String, required: true },
    dropoffLocation: { type: String, required: true },
    driverLicense: { type: String },
    cancellationReason: String,
    cancelledAt: Date,
    cancelledBy: { type: String, enum: ["user", "company", "admin"] }
  },
  { timestamps: true }
);

const Booking = mongoose.model("Booking", bookingSchema);
export default Booking;