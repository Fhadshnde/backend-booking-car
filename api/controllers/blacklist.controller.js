import { prisma } from "../lib/prisma.js";

export const getBlacklist = async (req, res) => {
  try {
    const list = await prisma.blacklist.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.status(200).json({ success: true, blacklist: list });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const addToBlacklist = async (req, res) => {
  try {
    const { idNumber, reason } = req.body;
    
    if (!idNumber) {
      return res.status(400).json({ success: false, message: "رقم الهوية مطلوب" });
    }

    const entry = await prisma.blacklist.create({
      data: { idNumber, reason }
    });

    res.status(201).json({ success: true, entry });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({ success: false, message: "رقم الهوية موجود بالفعل في القائمة السوداء" });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

export const removeFromBlacklist = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.blacklist.delete({
      where: { id: parseInt(id) }
    });
    res.status(200).json({ success: true, message: "تم حذف الرقم من القائمة السوداء بنجاح" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
