import { prisma } from "../lib/prisma.js";

export const getMyNotifications = async (req, res) => {
  try {
    const { page = 1, limit = 10, unreadOnly } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    let where = { userId: parseInt(req.user.id) };
    if (unreadOnly === "true") where.isRead = false;

    const [notifications, total, unreadCount] = await prisma.$transaction([
      prisma.notification.findMany({ where, skip, take: parseInt(limit), orderBy: { createdAt: "desc" } }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { userId: parseInt(req.user.id), isRead: false } })
    ]);

    res.status(200).json({
      success: true,
      unreadCount,
      notifications,
      pagination: { total, page: parseInt(page), limit: parseInt(limit) }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch notifications" });
  }
};

export const markAsRead = async (req, res) => {
  try {
    const notification = await prisma.notification.update({
      where: { id: parseInt(req.params.id) },
      data: { isRead: true }
    });
    res.status(200).json({ success: true, message: "Notification marked as read", notification });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to update notification" });
  }
};

export const markAllAsRead = async (req, res) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: parseInt(req.user.id), isRead: false },
      data: { isRead: true }
    });
    res.status(200).json({ success: true, message: "All notifications marked as read" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to update notifications" });
  }
};

export const deleteNotification = async (req, res) => {
  try {
    await prisma.notification.delete({ where: { id: parseInt(req.params.id) } });
    res.status(200).json({ success: true, message: "Notification deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to delete notification" });
  }
};

export const sendNotification = async ({ userId, title, message, type, relatedBooking, relatedCompany }) => {
  try {
    await prisma.notification.create({
      data: {
        userId: parseInt(userId),
        title,
        message,
        type: type || "general",
        bookingId: relatedBooking ? parseInt(relatedBooking) : null,
        companyId: relatedCompany ? parseInt(relatedCompany) : null
      }
    });
  } catch (error) {
    console.error("Failed to send notification:", error.message);
  }
};