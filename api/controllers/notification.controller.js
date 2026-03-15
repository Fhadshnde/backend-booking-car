import Notification from "../models/notification.model.js";
import catchAsync from "../helpers/catchAsync.js";
import AppError from "../helpers/AppError.js";

// جلب إشعارات المستخدم الحالي
export const getMyNotifications = catchAsync(async (req, res) => {
  const { page = 1, limit = 20, unreadOnly } = req.query;
  const skip = (page - 1) * limit;

  let filter = { user: req.user._id };
  if (unreadOnly === "true") {
    filter.isRead = false;
  }

  const notifications = await Notification.find(filter)
    .skip(skip)
    .limit(parseInt(limit))
    .sort({ createdAt: -1 });

  const total = await Notification.countDocuments(filter);
  const unreadCount = await Notification.countDocuments({
    user: req.user._id,
    isRead: false
  });

  res.status(200).json({
    success: true,
    notifications,
    unreadCount,
    pagination: {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(total / limit)
    }
  });
});

// تحديد إشعار كمقروء
export const markAsRead = catchAsync(async (req, res, next) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, user: req.user._id },
    { isRead: true },
    { new: true }
  );

  if (!notification) {
    return next(new AppError("الإشعار غير موجود", 404));
  }

  res.status(200).json({
    success: true,
    message: "تم تحديد الإشعار كمقروء",
    notification
  });
});

// تحديد جميع الإشعارات كمقروءة
export const markAllAsRead = catchAsync(async (req, res) => {
  await Notification.updateMany(
    { user: req.user._id, isRead: false },
    { isRead: true }
  );

  res.status(200).json({
    success: true,
    message: "تم تحديد جميع الإشعارات كمقروءة"
  });
});

// حذف إشعار
export const deleteNotification = catchAsync(async (req, res, next) => {
  const notification = await Notification.findOneAndDelete({
    _id: req.params.id,
    user: req.user._id
  });

  if (!notification) {
    return next(new AppError("الإشعار غير موجود", 404));
  }

  res.status(200).json({
    success: true,
    message: "تم حذف الإشعار بنجاح"
  });
});

// ============= Helper Function =============
// دالة مساعدة لإرسال إشعار (تُستخدم من controllers أخرى)
export const sendNotification = async ({ userId, title, message, type, relatedBooking, relatedCompany }) => {
  try {
    await Notification.create({
      user: userId,
      title,
      message,
      type,
      relatedBooking,
      relatedCompany
    });
  } catch (error) {
    console.error("فشل إرسال الإشعار:", error.message);
  }
};
