import { prisma } from "../lib/prisma.js";
import bcrypt from "bcryptjs";

export const getUserProfile = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: parseInt(req.user.id) },
      include: {
        company: true
      }
    });
    
    if (!user) {
      return res.status(404).json({ success: false, message: "المستخدم غير موجود" });
    }

    const { password, ...userWithoutPassword } = user;
    res.status(200).json({
      success: true,
      user: userWithoutPassword
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "فشل في جلب البيانات الشخصية"
    });
  }
};

export const updateUserProfile = async (req, res) => {
  try {
    const { name, phone, address, city, country, dateOfBirth } = req.body;

    const user = await prisma.user.update({
      where: { id: parseInt(req.user.id) },
      data: {
        name,
        phone,
        address,
        city,
        country,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null
      }
    });

    const { password, ...userWithoutPassword } = user;
    res.status(200).json({
      success: true,
      message: "تم تحديث الملف الشخصي بنجاح",
      user: userWithoutPassword
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "فشل في تحديث الملف الشخصي"
    });
  }
};

export const getUsers = async (req, res) => {
  try {
    const { page = 1, limit = 10, role } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = role ? { role } : {};

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip: skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          phone: true,
          role: true,
          isActive: true,
          walletBalance: true,
          createdAt: true
        }
      }),
      prisma.user.count({ where })
    ]);

    res.status(200).json({
      success: true,
      data: users,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "فشل في جلب قائمة المستخدمين"
    });
  }
};

// تم تغيير الاسم هنا ليتوافق مع المسارات
export const getUser = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: parseInt(req.params.id) },
      select: {
        id: true,
        name: true,
        phone: true,
        role: true,
        isActive: true,
        walletBalance: true,
        address: true,
        city: true,
        country: true,
        dateOfBirth: true,
        createdAt: true,
        companyId: true
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "المستخدم غير موجود"
      });
    }

    res.status(200).json({
      success: true,
      user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "فشل في جلب بيانات المستخدم"
    });
  }
};

export const updateUser = async (req, res) => {
  try {
    const { name, phone, role, isActive } = req.body;

    const user = await prisma.user.update({
      where: { id: parseInt(req.params.id) },
      data: { name, phone, role, isActive },
      select: {
        id: true,
        name: true,
        phone: true,
        role: true,
        isActive: true
      }
    });

    res.status(200).json({
      success: true,
      message: "تم تحديث بيانات المستخدم بنجاح",
      user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "فشل في تحديث بيانات المستخدم"
    });
  }
};

export const deleteUser = async (req, res) => {
  try {
    await prisma.user.delete({
      where: { id: parseInt(req.params.id) }
    });

    res.status(200).json({
      success: true,
      message: "تم حذف المستخدم بنجاح"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "فشل في حذف المستخدم"
    });
  }
};

export const uploadKycDocs = async (req, res) => {
  try {
    const { idCardImage, driverLicenseImage } = req.body;
    
    if (!idCardImage || !driverLicenseImage) {
      return res.status(400).json({ success: false, message: "يرجى توفير صورة الهوية وإجازة السوق" });
    }

    const user = await prisma.user.update({
      where: { id: parseInt(req.user.id) },
      data: {
        idCardImage,
        driverLicenseImage,
        identityStatus: "pending"
      },
      select: {
        id: true,
        name: true,
        identityStatus: true
      }
    });

    res.status(200).json({
      success: true,
      message: "تم رفع المستندات بنجاح، جاري المراجعة",
      user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "فشل في رفع المستندات"
    });
  }
};

export const updateKycStatus = async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!["approved", "rejected", "pending", "unverified"].includes(status)) {
      return res.status(400).json({ success: false, message: "حالة غير صالحة" });
    }

    const user = await prisma.user.update({
      where: { id: parseInt(req.params.id) },
      data: { identityStatus: status },
      select: {
        id: true,
        name: true,
        identityStatus: true
      }
    });

    res.status(200).json({
      success: true,
      message: "تم تحديث حالة الهوية بنجاح",
      user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "فشل في تحديث حالة الهوية"
    });
  }
};
export const requestTopUpWallet = async (req, res) => {
  try {
    const { amount, proofImage } = req.body;
    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ success: false, message: "مبلغ غير صحيح" });
    }

    const request = await prisma.walletTopUpRequest.create({
      data: {
        userId: parseInt(req.user.id),
        amount: parseFloat(amount),
        proofImage: proofImage || null,
        status: "pending"
      }
    });

    res.status(201).json({ success: true, request, message: "تم رفع طلب الشحن للإدارة بنجاح" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getMyTopUpRequests = async (req, res) => {
  try {
    const requests = await prisma.walletTopUpRequest.findMany({
      where: { userId: parseInt(req.user.id) },
      orderBy: { createdAt: "desc" }
    });
    res.status(200).json({ success: true, requests });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ADMIN ONLY
export const getAllTopUpRequests = async (req, res) => {
  try {
    const requests = await prisma.walletTopUpRequest.findMany({
      include: { user: { select: { name: true, phone: true, walletBalance: true } } },
      orderBy: { createdAt: "desc" }
    });
    res.status(200).json({ success: true, requests });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ADMIN ONLY
export const approveTopUpWallet = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // 'approved' or 'rejected'

    const topUpRequest = await prisma.walletTopUpRequest.findUnique({ where: { id: parseInt(id) } });
    if (!topUpRequest) return res.status(404).json({ success: false, message: "الطلب غير موجود" });
    if (topUpRequest.status !== "pending") return res.status(400).json({ success: false, message: "الطلب تمت معالجته مسبقاً" });

    if (status === "approved") {
      await prisma.$transaction([
        prisma.walletTopUpRequest.update({
          where: { id: parseInt(id) },
          data: { status: "approved" }
        }),
        prisma.user.update({
          where: { id: topUpRequest.userId },
          data: { walletBalance: { increment: topUpRequest.amount } }
        }),
        prisma.notification.create({
          data: {
            userId: topUpRequest.userId,
            title: "تم شحن محفظتك!",
            message: `تم الموافقة على طلب الشحن بمبلغ ${topUpRequest.amount.toLocaleString()} د.ع. رصيدك الآن جاهز للاستخدام.`,
            type: "wallet"
          }
        })
      ]);
      res.status(200).json({ success: true, message: "تمت الموافقة وشحن المحفظة بنجاح" });
    } else {
      await prisma.$transaction([
        prisma.walletTopUpRequest.update({
          where: { id: parseInt(id) },
          data: { status: "rejected" }
        }),
        prisma.notification.create({
          data: {
            userId: topUpRequest.userId,
            title: "مرفوض: طلب شحن المحفظة",
            message: `نعتذر، تم رفض طلب شحن المحفظة بمبلغ ${topUpRequest.amount.toLocaleString()} د.ع. يرجى مراجعة الإدارة.`,
            type: "wallet"
          }
        })
      ]);
      res.status(200).json({ success: true, message: "تم رفض الطلب بنجاح" });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateFcmToken = async (req, res) => {
  try {
    const { fcmToken } = req.body;
    if (!fcmToken) {
      return res.status(400).json({ success: false, message: "Token is required" });
    }

    await prisma.user.update({
      where: { id: parseInt(req.user.id) },
      data: { fcmToken }
    });

    res.status(200).json({ success: true, message: "FCM token updated successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to update FCM token" });
  }
};
