import Ad from "../models/ad.model.js";
import catchAsync from "../helpers/catchAsync.js";
import AppError from "../helpers/AppError.js";

export const getAllAds = catchAsync(async (req, res, next) => {
  const ads = await Ad.find({ isActive: true }).populate("carIds");
  res.status(200).json({
    success: true,
    results: ads.length,
    ads
  });
});

export const getAdById = catchAsync(async (req, res, next) => {
  const ad = await Ad.findById(req.params.id).populate("carIds");
  if (!ad) return next(new AppError("Ad not found", 404));
  res.status(200).json({ success: true, ad });
});

export const createAd = catchAsync(async (req, res, next) => {
  const newAd = await Ad.create(req.body);
  res.status(201).json({ success: true, ad: newAd });
});

export const updateAd = catchAsync(async (req, res, next) => {
  const ad = await Ad.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });
  if (!ad) return next(new AppError("Ad not found", 404));
  res.status(200).json({ success: true, ad });
});

export const deleteAd = catchAsync(async (req, res, next) => {
  const ad = await Ad.findByIdAndDelete(req.params.id);
  if (!ad) return next(new AppError("Ad not found", 404));
  res.status(204).json({ success: true, data: null });
});