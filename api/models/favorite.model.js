import mongoose from "mongoose";

const favoriteSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.ObjectId,
      ref: "User",
      required: true
    },
    carId: {
      type: mongoose.Schema.ObjectId,
      ref: "Car",
      required: true
    }
  },
  { timestamps: true }
);

favoriteSchema.index({ userId: 1, carId: 1 }, { unique: true });

const Favorite = mongoose.model("Favorite", favoriteSchema);
export default Favorite;