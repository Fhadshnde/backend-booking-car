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
    depositPercentage: { type: Number, default: 0.3 },
    depositStatus: { 
      type: String, 
      enum: ["pending", "pending_verification", "paid", "refunded"], 
      default: "pending" 
    },
    depositPaidAt: { type: Date },
    walletDiscount: { type: Number, default: 0 },
    remainingAmount: { type: Number, default: 0 },
    status: { 
      type: String, 
      enum: ["pending", "pending_verification", "confirmed", "on_trip", "completed", "cancelled", "payment_rejected"], 
      default: "pending" 
    },
    paymentStatus: { 
      type: String, 
      enum: ["pending", "pending_verification", "partial", "completed", "failed", "refunded"], 
      default: "pending" 
    },
    paymentMethod: { 
      type: String, 
      enum: ["credit_card", "debit_card", "wallet", "bank_transfer", "cash"], 
      default: "credit_card" 
    },
    paymentType: {
      type: String,
      enum: ["deposit", "remaining", "full"],
      default: "deposit"
    },
    paymentVerificationStatus: {
      type: String,
      enum: ["pending", "verified", "rejected"],
      default: "pending"
    },
    paymentVerificationNote: { type: String },
    paymentVerifiedAt: { type: Date },
    paymentVerifiedBy: { type: mongoose.Schema.ObjectId, ref: "User" },
    confirmationCode: { type: String, unique: true },
    transactionId: { type: String },
    pickupLocation: { type: String, required: true },
    dropoffLocation: { type: String, required: true },
    driverLicense: { type: String },
    cancellationReason: String,
    cancelledAt: Date,
    cancelledBy: { type: String, enum: ["user", "company", "admin"] },
    cashbackAfterCompletion: { type: Number, default: 0 },
    cashbackAfterCompletionPercentage: { type: Number, default: 0 },
    cashbackAddedAfterCompletion: { type: Boolean, default: false },
    cashbackAfterCompletionAddedAt: { type: Date },
    cashbackAfterCompletionAddedBy: { type: mongoose.Schema.ObjectId, ref: "User" },
    cashbackAfterExpiry: { type: Number, default: 0 },
    cashbackAfterExpiryPercentage: { type: Number, default: 0 },
    cashbackAddedAfterExpiry: { type: Boolean, default: false },
    cashbackAfterExpiryAddedAt: { type: Date },
  },
  { timestamps: true }
);

const Booking = mongoose.model("Booking", bookingSchema);
export default Booking;