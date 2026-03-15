import mongoose from "mongoose";

const adSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    subTitle: { type: String },
    image: { type: String, required: true },
    carIds: [{ type: mongoose.Schema.ObjectId, ref: "Car", required: true }],
    discountPercentage: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

export default mongoose.model("Ad", adSchema);