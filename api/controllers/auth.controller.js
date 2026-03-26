import User from "../models/user.model.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || "7d"
  });
};

export const register = async (req, res) => {
  try {
    const name = req.body.name?.trim();
    const phone = req.body.phone?.trim();
    const password = req.body.password?.trim();
    const role = req.body.role;

    if (!name || !phone || !password || !role) {
      return res.status(400).json({ success: false, message: "All fields are required" });
    }

    if (role === "admin") {
      return res.status(403).json({ success: false, message: "لا يمكن إنشاء حساب بصلاحية مسؤول" });
    }

    const allowedRoles = ["user", "company"];
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ success: false, message: "الدور يجب أن يكون user أو company" });
    }

    const existingUser = await User.findOne({ phone });
    if (existingUser) {
      return res.status(400).json({ success: false, message: "User with this phone already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await User.create({
      name,
      phone,
      password: hashedPassword,
      role
    });

    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      token,
      user: {
        id: user._id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        walletBalance: user.walletBalance
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Registration failed" });
  }
};

export const login = async (req, res) => {
  try {
    const phone = req.body.phone?.trim();
    const password = req.body.password?.trim();

    if (!phone || !password) {
      return res.status(400).json({ success: false, message: "Phone and password are required" });
    }

    const user = await User.findOne({ phone }).select("+password");
    
    if (!user) {
      return res.status(401).json({ success: false, message: "Invalid phone or password" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Invalid phone or password" });
    }

    const token = generateToken(user._id);

    // التعديل هنا: أضف walletBalance داخل كائن user
    res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        companyId: user.companyId,
        walletBalance: user.walletBalance || 0 // سيظهر المبلغ هنا
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Login failed" });
  }
};

export const getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    res.status(200).json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch user" });
  }
};

export const changePassword = async (req, res) => {
  try {
    const oldPassword = req.body.oldPassword?.trim();
    const newPassword = req.body.newPassword?.trim();

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ success: false, message: "All fields are required" });
    }

    const user = await User.findById(req.user.id).select("+password");
    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: "Old password is incorrect" });
    }

    user.password = await bcrypt.hash(newPassword, 12);
    await user.save();

    res.status(200).json({ success: true, message: "Password changed successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to change password" });
  }
};