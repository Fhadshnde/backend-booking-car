import { prisma } from "../lib/prisma.js";

export const getSettings = async (req, res) => {
  try {
    let settings = await prisma.setting.findFirst({
      orderBy: { createdAt: "desc" }
    });

    if (!settings) {
      settings = await prisma.setting.create({
        data: {
          depositPercentage: 0.3,
          insurancePrice: 50000,
          cashbackPercentage: 0.05,
          minCashbackToUse: 10000,
          updatedBy: parseInt(req.user.id)
        }
      });
    }

    res.status(200).json({
      success: true,
      data: {
        depositPercentage: settings.depositPercentage,
        insurancePrice: settings.insurancePrice,
        cashbackPercentage: settings.cashbackPercentage,
        minCashbackToUse: settings.minCashbackToUse,
        defaultDriverPrice: settings.defaultDriverPrice
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateSettings = async (req, res) => {
  try {
    const { depositPercentage, insurancePrice, cashbackPercentage, minCashbackToUse, defaultDriverPrice } = req.body;
    let settings = await prisma.setting.findFirst({
      orderBy: { createdAt: "desc" }
    });

    if (!settings) {
      settings = await prisma.setting.create({
        data: {
          depositPercentage: depositPercentage || 0.3,
          insurancePrice: insurancePrice || 50000,
          cashbackPercentage: cashbackPercentage || 0.05,
          minCashbackToUse: minCashbackToUse || 10000,
          defaultDriverPrice: defaultDriverPrice || 15000,
          updatedBy: parseInt(req.user.id)
        }
      });
    } else {
      settings = await prisma.setting.update({
        where: { id: settings.id },
        data: {
          depositPercentage: depositPercentage !== undefined ? depositPercentage : settings.depositPercentage,
          insurancePrice: insurancePrice !== undefined ? insurancePrice : settings.insurancePrice,
          cashbackPercentage: cashbackPercentage !== undefined ? cashbackPercentage : settings.cashbackPercentage,
          minCashbackToUse: minCashbackToUse !== undefined ? minCashbackToUse : settings.minCashbackToUse,
          defaultDriverPrice: defaultDriverPrice !== undefined ? defaultDriverPrice : settings.defaultDriverPrice,
          updatedBy: parseInt(req.user.id)
        }
      });
    }

    res.status(200).json({
      success: true,
      data: {
        depositPercentage: settings.depositPercentage,
        insurancePrice: settings.insurancePrice,
        cashbackPercentage: settings.cashbackPercentage,
        minCashbackToUse: settings.minCashbackToUse,
        defaultDriverPrice: settings.defaultDriverPrice
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getDepositPercentage = async (req, res) => {
  try {
    let settings = await prisma.setting.findFirst({
      orderBy: { createdAt: "desc" }
    });

    if (!settings) {
      settings = await prisma.setting.create({
        data: {
          depositPercentage: 0.3,
          insurancePrice: 50000,
          cashbackPercentage: 0.05,
          minCashbackToUse: 10000,
          updatedBy: parseInt(req.user.id)
        }
      });
    }

    res.status(200).json({
      success: true,
      depositPercentage: settings.depositPercentage
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getCashbackSettings = async (req, res) => {
  try {
    let settings = await prisma.setting.findFirst({
      orderBy: { createdAt: "desc" }
    });

    if (!settings) {
      settings = await prisma.setting.create({
        data: {
          depositPercentage: 0.3,
          insurancePrice: 50000,
          cashbackPercentage: 0.05,
          minCashbackToUse: 10000,
          updatedBy: parseInt(req.user.id)
        }
      });
    }

    res.status(200).json({
      success: true,
      cashbackPercentage: settings.cashbackPercentage,
      minCashbackToUse: settings.minCashbackToUse
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const setGlobalDepositPercentage = async (req, res) => {
  try {
    const { depositPercentage } = req.body;

    if (depositPercentage === undefined) {
      return res.status(400).json({ success: false, message: "نسبة العربون مطلوبة" });
    }

    let settings = await prisma.setting.findFirst({
      orderBy: { createdAt: "desc" }
    });

    if (!settings) {
      settings = await prisma.setting.create({
        data: {
          depositPercentage,
          updatedBy: parseInt(req.user.id)
        }
      });
    } else {
      settings = await prisma.setting.update({
        where: { id: settings.id },
        data: {
          depositPercentage,
          updatedBy: parseInt(req.user.id)
        }
      });
    }

    res.status(200).json({
      success: true,
      depositPercentage: settings.depositPercentage
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const setCashbackSettings = async (req, res) => {
  try {
    const { cashbackPercentage, minCashbackToUse } = req.body;

    let settings = await prisma.setting.findFirst({
      orderBy: { createdAt: "desc" }
    });

    if (!settings) {
      settings = await prisma.setting.create({
        data: {
          cashbackPercentage: cashbackPercentage !== undefined ? cashbackPercentage : 0.05,
          minCashbackToUse: minCashbackToUse !== undefined ? minCashbackToUse : 10000,
          updatedBy: parseInt(req.user.id)
        }
      });
    } else {
      settings = await prisma.setting.update({
        where: { id: settings.id },
        data: {
          cashbackPercentage: cashbackPercentage !== undefined ? cashbackPercentage : settings.cashbackPercentage,
          minCashbackToUse: minCashbackToUse !== undefined ? minCashbackToUse : settings.minCashbackToUse,
          updatedBy: parseInt(req.user.id)
        }
      });
    }

    res.status(200).json({
      success: true,
      cashbackPercentage: settings.cashbackPercentage,
      minCashbackToUse: settings.minCashbackToUse
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getInsurancePrice = async (req, res) => {
  try {
    let settings = await prisma.setting.findFirst({
      orderBy: { createdAt: "desc" }
    });

    if (!settings) {
      settings = await prisma.setting.create({
        data: {
          depositPercentage: 0.3,
          insurancePrice: 50000,
          cashbackPercentage: 0.05,
          minCashbackToUse: 10000,
          updatedBy: parseInt(req.user.id)
        }
      });
    }

    res.status(200).json({
      success: true,
      insurancePrice: settings.insurancePrice
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const setInsurancePrice = async (req, res) => {
  try {
    const { insurancePrice } = req.body;

    if (insurancePrice === undefined) {
      return res.status(400).json({ success: false, message: "سعر التأمين مطلوب" });
    }

    let settings = await prisma.setting.findFirst({
      orderBy: { createdAt: "desc" }
    });

    if (!settings) {
      settings = await prisma.setting.create({
        data: {
          insurancePrice,
          updatedBy: parseInt(req.user.id)
        }
      });
    } else {
      settings = await prisma.setting.update({
        where: { id: settings.id },
        data: {
          insurancePrice,
          updatedBy: parseInt(req.user.id)
        }
      });
    }

    res.status(200).json({
      success: true,
      insurancePrice: settings.insurancePrice
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};