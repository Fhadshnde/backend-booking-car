import multer from "multer";
import path from "path";

// إعداد التخزين
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

// فلتر أنواع الملفات
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

// إعداد multer
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 5MB حد أقصى
    files: 10 // 10 صور كحد أقصى
  }
});

// middleware لرفع صور السيارات
export const uploadCarImages = upload.array("images", 10);

// middleware لرفع صورة واحدة (logo, profile)
export const uploadSingleImage = upload.single("image");

export default upload;
