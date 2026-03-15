import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    car: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Car",
      required: true
    },
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true
    },
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
      unique: true
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5
    },
    comment: {
      type: String,
      trim: true,
      maxlength: 1000
    }
  },
  { timestamps: true }
);

// حساب معدل التقييم للسيارة بعد كل حفظ
reviewSchema.statics.calcAverageRating = async function (carId, companyId) {
  const carStats = await this.aggregate([
    { $match: { car: carId } },
    {
      $group: {
        _id: "$car",
        avgRating: { $avg: "$rating" },
        count: { $sum: 1 }
      }
    }
  ]);

  if (carStats.length > 0) {
    await mongoose.model("Car").findByIdAndUpdate(carId, {
      rating: Math.round(carStats[0].avgRating * 10) / 10,
      totalReviews: carStats[0].count
    });
  }

  // حساب معدل تقييم الشركة
  const companyStats = await this.aggregate([
    { $match: { company: companyId } },
    {
      $group: {
        _id: "$company",
        avgRating: { $avg: "$rating" },
        count: { $sum: 1 }
      }
    }
  ]);

  if (companyStats.length > 0) {
    await mongoose.model("Company").findByIdAndUpdate(companyId, {
      rating: Math.round(companyStats[0].avgRating * 10) / 10
    });
  }
};

reviewSchema.post("save", function () {
  this.constructor.calcAverageRating(this.car, this.company);
});

reviewSchema.post("findOneAndDelete", async function (doc) {
  if (doc) {
    await doc.constructor.calcAverageRating(doc.car, doc.company);
  }
});

export default mongoose.model("Review", reviewSchema);
