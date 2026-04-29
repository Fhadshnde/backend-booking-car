import { Expo } from 'expo-server-sdk';
import { prisma } from '../lib/prisma.js';

let expo = new Expo();

export const sendPushNotification = async (userId, title, body, data = {}) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: parseInt(userId) },
      select: { fcmToken: true }
    });

    if (!user || !user.fcmToken) {
      console.log(`No push token for user ${userId}`);
      return;
    }

    if (!Expo.isExpoPushToken(user.fcmToken)) {
      console.error(`Push token ${user.fcmToken} is not a valid Expo push token`);
      return;
    }

    const messages = [{
      to: user.fcmToken,
      sound: 'default',
      title: title,
      body: body,
      data: data,
    }];

    let chunks = expo.chunkPushNotifications(messages);
    let tickets = [];
    
    for (let chunk of chunks) {
      try {
        let ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
      } catch (error) {
        console.error("Error sending push notification chunk:", error);
      }
    }
    
    return tickets;
  } catch (error) {
    console.error("Error in sendPushNotification:", error);
  }
};

/**
 * Sends both an in-app database notification and a push notification
 */
export const notifyUser = async ({ userId, title, message, type, relatedBooking, relatedCompany, data = {} }) => {
  try {
    // 1. Create In-App Notification (Database)
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

    // 2. Send Push Notification
    await sendPushNotification(userId, title, message, {
      ...data,
      type: type || "general",
      bookingId: relatedBooking || null
    });
  } catch (error) {
    console.error("Failed to notify user:", error.message);
  }
};
