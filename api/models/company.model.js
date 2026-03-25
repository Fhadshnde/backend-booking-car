import mongoose from "mongoose";

const companySchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String },
    owner: { type: mongoose.Schema.ObjectId, ref: "User", required: true },
    description: String,
    logo: String,
    coverImage: String,
    
    address: String,
    city: { type: String, required: true },
    country: { type: String, default: "Iraq" },
    
    location: {
      type: { type: String, default: "Point" },
      coordinates: { type: [Number], default: [0, 0] }
    },

    licenseNumber: { type: String, required: true },
    taxNumber: String,
    identityDocuments: [String],
    
    isApproved: { type: Boolean, default: false },
    isRejected: { type: Boolean, default: false },
    rejectionReason: String,
    
    rating: { type: Number, default: 0, min: 0, max: 5 },
    totalReviews: { type: Number, default: 0 },
    totalCars: { type: Number, default: 0 },
    totalBookings: { type: Number, default: 0 },
    
    workingHours: {
      open: String,
      close: String
    },
    
    socialMedia: {
      facebook: String,
      instagram: String,
      website: String
    },

    isActive: { type: Boolean, default: true },
    approvedAt: Date
  },
  { timestamps: true }
);

companySchema.index({ location: "2dsphere" });

export default mongoose.model("Company", companySchema);