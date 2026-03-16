import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    password: { type: String, required: true, select: false , minlength: 6},
    phone: { type: String, required: true, unique: true, match: /^\d{10}$/ },
    role: { type: String, enum: ["user", "company", "admin"], default: "user" },
    isActive: { type: Boolean, default: true },
    profileImage: String,
    address: String,
    city: String,
    country: String,
    dateOfBirth: Date,
    companyId: { type: mongoose.Schema.ObjectId, ref: "Company" },
    lastLogin: Date,
    createdAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);