import Joi from "joi";

// ============= Auth Schemas =============
export const registerSchema = Joi.object({
  name: Joi.string().trim().min(2).max(50).required()
    .messages({ "any.required": "الاسم مطلوب", "string.min": "الاسم يجب أن يكون حرفين على الأقل" }),
  phone: Joi.string().trim().pattern(/^[0-9]{10}$/).required()
    .messages({ "any.required": "رقم الهاتف مطلوب", "string.pattern.base": "رقم الهاتف يجب أن يكون 10 أرقام" }),
  password: Joi.string().min(6).max(128).required()
    .messages({ "any.required": "كلمة المرور مطلوبة", "string.min": "كلمة المرور يجب أن تكون 6 أحرف على الأقل" }),
  role: Joi.string().valid("user", "company").required()
    .messages({ "any.required": "الدور مطلوب", "any.only": "الدور يجب أن يكون user أو company" })
});

export const loginSchema = Joi.object({
  phone: Joi.string().trim().required()
    .messages({ "any.required": "رقم الهاتف مطلوب" }),
  password: Joi.string().required()
    .messages({ "any.required": "كلمة المرور مطلوبة" })
});

export const changePasswordSchema = Joi.object({
  oldPassword: Joi.string().required()
    .messages({ "any.required": "كلمة المرور القديمة مطلوبة" }),
  newPassword: Joi.string().min(6).max(128).required()
    .messages({ "any.required": "كلمة المرور الجديدة مطلوبة", "string.min": "كلمة المرور يجب أن تكون 6 أحرف على الأقل" })
});

// ============= Booking Schemas =============
export const createBookingSchema = Joi.object({
  carId: Joi.string().hex().length(24).required()
    .messages({ "any.required": "معرف السيارة مطلوب" }),
  companyId: Joi.string().hex().length(24).required()
    .messages({ "any.required": "معرف الشركة مطلوب" }),
  startDate: Joi.date().iso().required()
    .messages({ "any.required": "تاريخ البداية مطلوب" }),
  endDate: Joi.date().iso().greater(Joi.ref("startDate")).required()
    .messages({ "any.required": "تاريخ النهاية مطلوب", "date.greater": "تاريخ النهاية يجب أن يكون بعد تاريخ البداية" }),
  pickupLocation: Joi.string().trim().max(200).allow("", null),
  dropoffLocation: Joi.string().trim().max(200).allow("", null),
  pickupTime: Joi.string().trim().allow("", null),
  dropoffTime: Joi.string().trim().allow("", null),
  insurance: Joi.boolean().default(false)
});

// ============= Car Schemas =============
export const createCarSchema = Joi.object({
  brand: Joi.string().trim().required()
    .messages({ "any.required": "الماركة مطلوبة" }),
  model: Joi.string().trim().required()
    .messages({ "any.required": "الموديل مطلوب" }),
  year: Joi.number().integer().min(1990).max(new Date().getFullYear() + 1).required()
    .messages({ "any.required": "سنة الصنع مطلوبة" }),
  licensePlate: Joi.string().trim().required()
    .messages({ "any.required": "رقم اللوحة مطلوب" }),
  companyId: Joi.string().hex().length(24).allow(null),
  pricePerDay: Joi.number().positive().required()
    .messages({ "any.required": "السعر اليومي مطلوب", "number.positive": "السعر يجب أن يكون رقم موجب" }),
    category: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required()
    .messages({ 
      "any.required": "الفئة مطلوبة",
      "string.pattern.base": "معرف الفئة غير صالح" 
    }),
  color: Joi.string().trim().allow("", null),
  transmission: Joi.string().valid("manual", "automatic").default("automatic"),
  fuelType: Joi.string().valid("petrol", "diesel", "electric").default("petrol"),
  seats: Joi.number().integer().min(1).max(50).default(5),
  description: Joi.string().trim().max(1000).allow("", null),
  images: Joi.array().items(Joi.string()).allow(null)
});

export const updateCarSchema = Joi.object({
  pricePerDay: Joi.number().positive(),
  description: Joi.string().trim().max(1000).allow("", null),
  color: Joi.string().trim().allow("", null),
  images: Joi.array().items(Joi.string()),
  isAvailable: Joi.boolean()
}).min(1).messages({ "object.min": "يجب تقديم حقل واحد على الأقل للتعديل" });

// ============= Company Schemas =============
export const createCompanySchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required()
    .messages({ "any.required": "اسم الشركة مطلوب" }),
  phone: Joi.string().trim().required()
    .messages({ "any.required": "رقم الهاتف مطلوب" }),
  ownerId: Joi.string().hex().length(24).required()
    .messages({ "any.required": "معرف المالك مطلوب" }),
  address: Joi.string().trim().max(200).allow("", null),
  description: Joi.string().trim().max(500).allow("", null),
  licenseNumber: Joi.string().trim().required()
    .messages({ "any.required": "رقم الرخصة مطلوب" }),
  percentage: Joi.number().min(0).max(100),
  fixedAmount: Joi.number().min(0)
});

// ============= Commission Schemas =============
export const createCommissionSchema = Joi.object({
  companyId: Joi.string().hex().length(24).required()
    .messages({ "any.required": "معرف الشركة مطلوب" }),
  percentage: Joi.number().min(0).max(100).default(10),
  fixedAmount: Joi.number().min(0).default(0),
  notes: Joi.string().trim().max(500).allow("", null)
});

export const updateCommissionSchema = Joi.object({
  percentage: Joi.number().min(0).max(100),
  fixedAmount: Joi.number().min(0),
  isActive: Joi.boolean(),
  notes: Joi.string().trim().max(500).allow("", null)
}).min(1);

// ============= Review Schemas =============
export const createReviewSchema = Joi.object({
  bookingId: Joi.string().hex().length(24).required()
    .messages({ "any.required": "معرف الحجز مطلوب" }),
  rating: Joi.number().integer().min(1).max(5).required()
    .messages({ "any.required": "التقييم مطلوب", "number.min": "التقييم يجب أن يكون 1 على الأقل", "number.max": "التقييم يجب أن يكون 5 على الأكثر" }),
  comment: Joi.string().trim().max(1000).allow("", null)
});

// ============= Profile Schema =============
export const updateProfileSchema = Joi.object({
  name: Joi.string().trim().min(2).max(50),
  phone: Joi.string().trim().pattern(/^[0-9]{10}$/),
  address: Joi.string().trim().max(200).allow("", null),
  city: Joi.string().trim().max(100).allow("", null),
  country: Joi.string().trim().max(100).allow("", null),
  dateOfBirth: Joi.date().iso().allow(null)
}).min(1);

// ============= Validate Middleware =============
export const validate = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) {
      const messages = error.details.map((detail) => detail.message);
      return res.status(400).json({
        success: false,
        message: "بيانات غير صحيحة",
        errors: messages
      });
    }
    next();
  };
};
