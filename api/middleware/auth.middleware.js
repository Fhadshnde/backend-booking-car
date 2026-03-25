import jwt from "jsonwebtoken";
import User from "../models/user.model.js";

export const protect = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return next(); 
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (user) {
      req.user = user;
    }
    
    next();
  } catch (error) {
    next(); 
  }
};

export const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }
    next();
  };
};

export const checkCompanyOwner = async (req, res, next) => {
  try {
    const companyId = req.params.id;
    
    if (req.user.role === "admin") {
      return next();
    }

    if (req.user.role === "company" && req.user.companyId === companyId) {
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