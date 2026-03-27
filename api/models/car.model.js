import mongoose from "mongoose";

const carSchema = new mongoose.Schema(
  {
    brand: { 
      type: mongoose.Schema.ObjectId, 
      ref: "Brand", 
      required: true 
    },
    model: { type: String, required: true },
    year: { type: Number, required: true },
    licensePlate: { type: String, required: true, unique: true },
    companyId: { type: mongoose.Schema.ObjectId, ref: "Company", required: true },
    category: { 
      type: mongoose.Schema.ObjectId, 
      ref: "Category", 
      required: true 
    },
    pricePerDay: { type: Number, required: true },
    discountPrice: { type: Number, default: 0 },
    offerEndsAt: { type: Date },
    color: String,
    transmission: { type: String, enum: ["manual", "automatic"], default: "automatic" },
    fuelType: { type: String, enum: ["petrol", "diesel", "electric"], default: "petrol" },
    seats: { type: Number, default: 5 },
    mileage: { type: Number, default: 0 },
    images: [String],
    description: String,
    features: [String],
    isAvailable: { type: Boolean, default: true },
    isSuspended: { type: Boolean, default: false },
    suspensionReason: String,
    suspendedAt: Date,
    insurancePrice: { type: Number, default: 0 },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    totalReviews: { type: Number, default: 0 },
    totalBookings: { type: Number, default: 0 },
    location: {
      type: { type: String, default: "Point" },
      coordinates: { type: [Number], default: [0, 0] }
    }
  },
  { timestamps: true }
);

carSchema.index({ location: "2dsphere" });

export default mongoose.model("Car", carSchema);