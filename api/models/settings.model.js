import mongoose from "mongoose";

const settingsSchema = new mongoose.Schema(
  {
    depositPercentage: {
      type: Number,
      default: 0.3,
      min: 0,
      max: 1,
      required: true,
    },
    insurancePrice: {
      type: Number,
      default: 50000,
      min: 0,
      required: true,
    },
    cashbackPercentage: {
      type: Number,
      default: 0.05,
      min: 0,
      max: 1,
      required: true,
    },
    minCashbackToUse: {
      type: Number,
      default: 10000,
      min: 0,
      required: true,
    },
    updatedBy: {
      type: mongoose.Schema.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const Settings = mongoose.model("Settings", settingsSchema);
export default Settings;