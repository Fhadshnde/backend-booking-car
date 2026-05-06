import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// إعداد التخزين في الذاكرة (Memory Storage) لدعم البيئات ذات نظام الملفات للقراءة فقط مثل Vercel
const storage = multer.memoryStorage();

// فلتر أنواع الملفات (كما هو)
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|webp|gif/;
  const extName = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimeType = allowedTypes.test(file.mimetype);

  if (extName && mimeType) {
    cb(null, true);
  } else {
    cb(new Error("فقط صور (jpeg, jpg, png, webp, gif) مسموحة"), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB (ملاحظة: في تعليقك كتبت 5MB بينما الكود 50MB)
    files: 10
  }
});

export const uploadCarImages = upload.array("images", 10);
export const uploadSingleImage = upload.single("image");

export default upload;