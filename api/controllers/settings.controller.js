import Settings from "../models/settings.model.js";
import catchAsync from "../helpers/catchAsync.js";
import AppError from "../helpers/AppError.js";

export const getSettings = catchAsync(async (req, res, next) => {
  let settings = await Settings.findOne().sort({ createdAt: -1 });
  
  if (!settings) {
    settings = await Settings.create({
      depositPercentage: 0.3,
      insurancePrice: 50000,
      cashbackPercentage: 0.05,
      minCashbackToUse: 10000,
      updatedBy: req.user.id,
    });
  }
  
  res.status(200).json({
    success: true,
    data: {
      depositPercentage: settings.depositPercentage,
      insurancePrice: settings.insurancePrice,
      cashbackPercentage: settings.cashbackPercentage,
      minCashbackToUse: settings.minCashbackToUse,
    },
  });
});

export const updateSettings = catchAsync(async (req, res, next) => {
  const { depositPercentage, insurancePrice, cashbackPercentage, minCashbackToUse } = req.body;
  
  let settings = await Settings.findOne().sort({ createdAt: -1 });
  
  if (!settings) {
    settings = new Settings({
      updatedBy: req.user.id,
    });
  }
  
  if (depositPercentage !== undefined) {
    settings.depositPercentage = depositPercentage;
  }
  if (insurancePrice !== undefined) {
    settings.insurancePrice = insurancePrice;
  }
  if (cashbackPercentage !== undefined) {
    settings.cashbackPercentage = cashbackPercentage;
  }
  if (minCashbackToUse !== undefined) {
    settings.minCashbackToUse = minCashbackToUse;
  }
  
  settings.updatedBy = req.user.id;
  await settings.save();
  
  res.status(200).json({
    success: true,
    data: {
      depositPercentage: settings.depositPercentage,
      insurancePrice: settings.insurancePrice,
      cashbackPercentage: settings.cashbackPercentage,
      minCashbackToUse: settings.minCashbackToUse,
    },
  });
});

export const getDepositPercentage = catchAsync(async (req, res, next) => {
  let settings = await Settings.findOne().sort({ createdAt: -1 });
  
  if (!settings) {
    settings = await Settings.create({
      depositPercentage: 0.3,
      insurancePrice: 50000,
      cashbackPercentage: 0.05,
      minCashbackToUse: 10000,
      updatedBy: req.user.id,
    });
  }
  
  res.status(200).json({
    success: true,
    depositPercentage: settings.depositPercentage,
  });
});

export const getCashbackSettings = catchAsync(async (req, res, next) => {
  let settings = await Settings.findOne().sort({ createdAt: -1 });
  
  if (!settings) {
    settings = await Settings.create({
      depositPercentage: 0.3,
      insurancePrice: 50000,
      cashbackPercentage: 0.05,
      minCashbackToUse: 10000,
      updatedBy: req.user.id,
    });
  }
  
  res.status(200).json({
    success: true,
    cashbackPercentage: settings.cashbackPercentage,
    minCashbackToUse: settings.minCashbackToUse,
  });
});

export const setGlobalDepositPercentage = catchAsync(async (req, res, next) => {
  const { depositPercentage } = req.body;
  
  if (depositPercentage === undefined) {
    return next(new AppError("نسبة العربون مطلوبة", 400));
  }
  
  let settings = await Settings.findOne().sort({ createdAt: -1 });
  
  if (!settings) {
    settings = new Settings({
      updatedBy: req.user.id,
    });
  }
  
  settings.depositPercentage = depositPercentage;
  settings.updatedBy = req.user.id;
  await settings.save();
  
  res.status(200).json({
    success: true,
    depositPercentage: settings.depositPercentage,
  });
});

export const setCashbackSettings = catchAsync(async (req, res, next) => {
  const { cashbackPercentage, minCashbackToUse } = req.body;
  
  let settings = await Settings.findOne().sort({ createdAt: -1 });
  
  if (!settings) {
    settings = new Settings({
      updatedBy: req.user.id,
    });
  }
  
  if (cashbackPercentage !== undefined) {
    settings.cashbackPercentage = cashbackPercentage;
  }
  if (minCashbackToUse !== undefined) {
    settings.minCashbackToUse = minCashbackToUse;
  }
  
  settings.updatedBy = req.user.id;
  await settings.save();
  
  res.status(200).json({
    success: true,
    cashbackPercentage: settings.cashbackPercentage,
    minCashbackToUse: settings.minCashbackToUse,
  });
});