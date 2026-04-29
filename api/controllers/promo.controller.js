import { prisma } from "../lib/prisma.js";

export const validatePromoCode = async (req, res) => {
  try {
    const { code, amount } = req.body;
    
    const promo = await prisma.promoCode.findFirst({
      where: { 
        code: {
          equals: code,
          mode: 'insensitive'
        }
      }
    });

    if (!promo || !promo.isActive) {
      return res.status(404).json({ success: false, message: "كود الخصم غير صحيح أو منتهي" });
    }

    const now = new Date();
    if (now < promo.startDate || now > promo.endDate) {
      return res.status(400).json({ success: false, message: "كود الخصم منتهي الصلاحية" });
    }

    if (promo.usageLimit && promo.usedCount >= promo.usageLimit) {
      return res.status(400).json({ success: false, message: "تم تجاوز حد استخدام هذا الكود" });
    }

    if (amount < promo.minOrderValue) {
      return res.status(400).json({ success: false, message: `يجب أن يكون مبلغ الحجز على الأقل ${promo.minOrderValue}` });
    }

    let discount = 0;
    if (promo.type === "percentage") {
      discount = (amount * promo.value) / 100;
      if (promo.maxDiscount && discount > promo.maxDiscount) {
        discount = promo.maxDiscount;
      }
    } else {
      discount = promo.value;
    }

    res.status(200).json({
      success: true,
      discount,
      promoId: promo.id,
      message: "تم تطبيق كود الخصم بنجاح"
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createPromoCode = async (req, res) => {
  try {
    const promo = await prisma.promoCode.create({
      data: req.body
    });
    res.status(201).json({ success: true, promo });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
