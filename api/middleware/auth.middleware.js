import jwt from "jsonwebtoken";
import User from "../models/user.model.js";

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

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

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

    req.user = user;
    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "رمز المصادقة غير صالح"
      });
    }
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "انتهت صلاحية رمز المصادقة. يرجى تسجيل الدخول مجدداً"
      });
    }
    return res.status(500).json({
      success: false,
      message: "خطأ في التحقق من المصادقة"
    });
  }
};

export const optionalAuth = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      req.user = null;
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (user && user.isActive) {
      req.user = user;
    } else {
      req.user = null;
    }

    next();
  } catch (error) {
    req.user = null;
    next();
  }
};

export const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "يجب تسجيل الدخول أولاً"
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "ليس لديك صلاحية للوصول إلى هذا المسار"
      });
    }
    next();
  };
};

export const checkCompanyOwner = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "يجب تسجيل الدخول أولاً"
      });
    }

    const companyId = req.params.id;

    if (req.user.role === "admin") {
      return next();
    }

    if (req.user.role === "company" && req.user.companyId?.toString() === companyId) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: "يمكنك فقط تعديل بيانات شركتك"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "خطأ في التحقق من الصلاحيات"
    });
  }
};