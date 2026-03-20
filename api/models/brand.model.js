import mongoose from "mongoose";

const brandSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    logo: { type: String },
    isActive: { type: Boolean, default: true },
    cars: [
      {
        type: mongoose.Schema.ObjectId,
        ref: "Car"
      }
    ]  },
  { timestamps: true }
);

export default mongoose.model("Brand", brandSchema);