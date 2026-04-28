import AppError from "../helpers/AppError.js";

const handleCastErrorDB = () => {
  const message = `البيانات المدخلة غير صحيحة.`;
  return new AppError(message, 400);
};

const handleDuplicateFieldsDB = () => {
  const message = `قيمة مكررة مدخلة. يرجى استخدام قيمة أخرى.`;
  return new AppError(message, 400);
};

const handleValidationErrorDB = () => {
  const message = `خطأ في إدخال البيانات.`;
  return new AppError(message, 400);
};

const handleJWTError = () =>
  new AppError("توكن غير صالح. الرجاء تسجيل الدخول مرة أخرى!", 401);

const handleJWTExpiredError = () =>
  new AppError("انتهت صلاحية التوكن الخاص بك! الرجاء تسجيل الدخول مرة أخرى.", 401);

const sendErrorDev = (err, res) => {
  res.status(err.statusCode).json({
    success: false,
    status: err.status,
    error: err,
    message: err.message,
    stack: err.stack,
  });
};

const sendErrorProd = (err, res) => {
  if (err.isOperational) {
    res.status(err.statusCode).json({
      success: false,
      status: err.status,
      message: err.message,
    });
  } else {
    // إخفاء الأخطاء البرمجية العميقة التي قد تكشف أسرار النظام
    console.error("ERROR 💥", err);
    res.status(500).json({
      success: false,
      status: "error",
      message: "حدث خطأ غير متوقع في الخادم!",
    });
  }
};

export const globalErrorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || "error";

  if (process.env.NODE_ENV === "development") {
    sendErrorDev(err, res);
  } else {
    let error = { ...err };
    error.message = err.message;
    error.name = err.name;

    // Prisma-specific errors handling can go here
    if (error?.code === "P2002") error = handleDuplicateFieldsDB();
    if (error?.name === "JsonWebTokenError") error = handleJWTError();
    if (error?.name === "TokenExpiredError") error = handleJWTExpiredError();

    sendErrorProd(error, res);
  }
};
