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
    totalPrice: { type: Number, required: true },

    deposit: { type: Number, default: 0 }, 
    depositStatus: { type: String, enum: ["pending", "paid", "refunded"], default: "pending" },

    status: { 
      type: String, 
      enum: ["pending", "confirmed", "on_trip", "completed", "cancelled"], 
      default: "pending" 
    },
    
    paymentStatus: { type: String, enum: ["pending", "completed", "failed", "refunded"], default: "pending" },
    paymentMethod: { type: String, enum: ["credit_card", "debit_card", "wallet", "bank_transfer", "cash"], default: "credit_card" },
    transactionId: { type: String },

    pickupLocation: { type: String, required: true },
    dropoffLocation: { type: String, required: true },
    pickupTime: String,
    dropoffTime: String,
    
    driverLicense: { type: String },
    insurance: { type: Boolean, default: false },
    insurancePrice: { type: Number, default: 0 },
    
    cancellationReason: String,
    cancelledAt: Date,
    cancelledBy: { type: String, enum: ["user", "company", "admin"] },
    
    notes: String,
    rating: { type: Number, min: 0, max: 5 },
    review: String,
    reviewedAt: Date,
    
    confirmationCode: { type: String, unique: true },
    createdAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

export default mongoose.model("Booking", bookingSchema);