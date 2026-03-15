import mongoose from "mongoose";

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    slug: { type: String, required: true, unique: true },
    icon: { type: String },
    image: { type: String },
    description: String,
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.ObjectId, ref: "User" }
  },
  { timestamps: true }
);

export default mongoose.model("Category", categorySchema);