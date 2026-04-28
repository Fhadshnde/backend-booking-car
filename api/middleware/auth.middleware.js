import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma.js";

export const protect = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "يجب تسجيل الدخول للوصول إلى هذا المسار"
      });
    }

    // التحقق من التوكن
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // استخدام Prisma بدلاً من Mongoose
    const user = await prisma.user.findUnique({
      where: { id: parseInt(decoded.id) }
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "المستخدم غير موجود أو تم حذفه"
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "تم تعطيل حسابك. تواصل مع الإدارة"
      });
    }

    // تخزين بيانات المستخدم في الطلب
    req.user = user;
    next();
  } catch (error) {
    console.error("Auth Error:", error); // لمساعدتك في رؤية الخطأ الحقيقي في الـ Terminal
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({ success: false, message: "رمز المصادقة غير صالح" });
    }
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ success: false, message: "انتهت صلاحية الرمز" });
    }
    return res.status(500).json({ success: false, message: "خطأ في التحقق من الهوية" });
  }
};

export const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "يجب تسجيل الدخول أولاً" });
    }
    
    const userRole = req.user.role.toLowerCase();
    const allowedRoles = roles.map(role => role.toLowerCase());
    
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({ success: false, message: "ليس لديك صلاحية للقيام بهذا الإجراء" });
    }
    next();
  };
};

export const checkCompanyOwner = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "يجب تسجيل الدخول أولاً" });
    }
    
    // Admin له كامل الصلاحيات
    if (req.user.role === "admin") return next();
    
    const targetId = parseInt(req.params.companyId || req.params.id);
    
    if (req.user.role === "company" && req.user.companyId === targetId) {
      return next();
    }
    
    return res.status(403).json({ success: false, message: "غير مصرح لك بالوصول لبيانات هذه الشركة" });
  } catch (error) {
    res.status(500).json({ success: false, message: "خطأ في التحقق من ملكية الشركة" });
  }
};

export const optionalAuth = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) return next();

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: parseInt(decoded.id) }
    });

    if (user && user.isActive) {
      req.user = user;
    }
    next();
  } catch (error) {
    next();
  }
};