import { prisma } from "../lib/prisma.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || "secret", {
    expiresIn: "7d"
  });
};

export const register = async (req, res) => {
  try {
    const { name, phone, password, role } = req.body;

    if (!name || !phone || !password) {
      return res.status(400).json({ success: false, message: "جميع الحقول مطلوبة" });
    }

    const validRoles = ["user", "company"];
    const assignedRole = validRoles.includes(role) ? role : "user";

    const existingUser = await prisma.user.findUnique({
      where: { phone: phone.trim() }
    });

    if (existingUser) {
      return res.status(400).json({ success: false, message: "رقم الهاتف مسجل مسبقاً" });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        name,
        phone: phone.trim(),
        password: hashedPassword,
        role: assignedRole
      }
    });

    const token = generateToken(user.id);

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        walletBalance: user.walletBalance
      }
    });
  } catch (error) {
    console.error("خطأ في التسجيل:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const login = async (req, res) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({ success: false, message: "رقم الهاتف وكلمة المرور مطلوبان" });
    }

    const user = await prisma.user.findUnique({ where: { phone: phone.trim() } });
    if (!user) {
      return res.status(401).json({ success: false, message: "بيانات الدخول غير صحيحة" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: "بيانات الدخول غير صحيحة" });
    }

    const token = generateToken(user.id);

    res.status(200).json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        walletBalance: user.walletBalance
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getCurrentUser = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        name: true,
        phone: true,
        role: true,
        walletBalance: true,
        city: true
      }
    });
    if (!user) return res.status(404).json({ success: false, message: "المستخدم غير موجود" });
    res.status(200).json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) return res.status(400).json({ success: false, message: "كلمة المرور القديمة خاطئة" });
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: req.user.id },
      data: { password: hashedPassword }
    });
    res.status(200).json({ success: true, message: "تم تغيير كلمة المرور بنجاح" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};