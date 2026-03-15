import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    message: {
      type: String,
      required: true,
      trim: true
    },
    type: {
      type: String,
      enum: [
        "booking_created",
        "booking_confirmed",
        "booking_cancelled",
        "booking_completed",
        "company_approved",
        "company_rejected",
        "payment_received",
        "review_received",
        "general"
      ],
      default: "general"
    },
    isRead: {
      type: Boolean,
      default: false
    },
    relatedBooking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking"
    },
    relatedCompany: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company"
    }
  },
  { timestamps: true }
);

// Index مركب لتسريع الاستعلامات
notificationSchema.index({ user: 1, isRead: 1, createdAt: -1 });

export default mongoose.model("Notification", notificationSchema);
