/**
 * ملف اختبار نظام العمولات
 * يحتوي على أمثلة عملية لاستخدام نظام العمولات
 */

// مثال 1: حساب العمولة البسيطة
const exampleCalculateCommission = {
  description: "حساب العمولة لحجز بسيط",
  scenario: {
    companyName: "شركة الراقي للنقل",
    bookingAmount: 500,
    commissionPercentage: 15,
    commissionFixedAmount: 0,
  },
  calculation: {
    bookingAmount: 500,
    percentageAmount: (500 * 15) / 100, // = 75
    fixedAmount: 0,
    totalCommission: 75,
    netAmount: 425, // 500 - 75
  },
};

// مثال 2: حساب العمولة مع مبلغ ثابت
const exampleCalculateCommissionWithFixed = {
  description: "حساب العمولة مع مبلغ ثابت إضافي",
  scenario: {
    companyName: "شركة الفرات للسيارات",
    bookingAmount: 1000,
    commissionPercentage: 12,
    commissionFixedAmount: 5,
  },
  calculation: {
    bookingAmount: 1000,
    percentageAmount: (1000 * 12) / 100, // = 120
    fixedAmount: 5,
    totalCommission: 125, // 120 + 5
    netAmount: 875, // 1000 - 125
  },
};

// مثال 3: إنشاء شركة مع عمولة
const exampleCreateCompanyWithCommission = {
  endpoint: "POST /api/companies",
  requestBody: {
    name: "شركة أجني للتأجير",
    phone: "07700123456",
    address: "بغداد، المنصور",
    logo: "https://example.com/logo.png",
    commissionPercentage: 10,
    commissionFixedAmount: 0,
  },
  expectedResponse: {
    success: true,
    message: "تم إنشاء الشركة والعمولة بنجاح",
    data: {
      company: {
        _id: "507f1f77bcf86cd799439012",
        name: "شركة أجني للتأجير",
        phone: "07700123456",
        address: "بغداد، المنصور",
        commission: "507f1f77bcf86cd799439011",
      },
      commission: {
        _id: "507f1f77bcf86cd799439011",
        company: "507f1f77bcf86cd799439012",
        percentage: 10,
        fixedAmount: 0,
        isActive: true,
      },
    },
  },
};

// مثال 4: تعديل عمولة شركة
const exampleUpdateCommission = {
  endpoint: "PUT /api/commissions/507f1f77bcf86cd799439011",
  requestBody: {
    percentage: 18,
    fixedAmount: 2,
    notes: "تم زيادة العمولة للربع الأول من 2024",
  },
  expectedResponse: {
    success: true,
    message: "تم تعديل العمولة بنجاح",
    data: {
      _id: "507f1f77bcf86cd799439011",
      company: "507f1f77bcf86cd799439012",
      percentage: 18,
      fixedAmount: 2,
      isActive: true,
      notes: "تم زيادة العمولة للربع الأول من 2024",
      updatedAt: "2024-01-26T15:45:00Z",
    },
  },
};

// مثال 5: إنشاء حجز مع حساب العمولة
const exampleCreateBookingWithCommission = {
  endpoint: "POST /api/bookings",
  requestBody: {
    userId: "507f1f77bcf86cd799439001",
    carId: "507f1f77bcf86cd799439002",
    companyId: "507f1f77bcf86cd799439012",
    startDate: "2024-02-01",
    endDate: "2024-02-05",
    totalPrice: 500,
  },
  expectedResponse: {
    success: true,
    message: "تم إنشاء الحجز بنجاح",
    data: {
      booking: {
        _id: "507f1f77bcf86cd799439099",
        user: "507f1f77bcf86cd799439001",
        car: "507f1f77bcf86cd799439002",
        company: "507f1f77bcf86cd799439012",
        startDate: "2024-02-01",
        endDate: "2024-02-05",
        totalPrice: 500,
        commission: {
          amount: 92, // (500 * 18/100) + 2 = 90 + 2 = 92
          percentage: 18,
          fixedAmount: 2,
        },
        status: "pending",
      },
      commissionDetails: {
        totalPrice: 500,
        commissionAmount: "92.00",
        netAmount: "408.00",
      },
    },
  },
};

// مثال 6: الحصول على جميع العمولات
const exampleGetAllCommissions = {
  endpoint: "GET /api/commissions",
  headers: {
    Authorization: "Bearer YOUR_ADMIN_JWT_TOKEN",
  },
  expectedResponse: {
    success: true,
    count: 3,
    data: [
      {
        _id: "507f1f77bcf86cd799439011",
        company: {
          _id: "507f1f77bcf86cd799439012",
          name: "شركة الراقي للنقل",
        },
        percentage: 15,
        fixedAmount: 2,
        isActive: true,
        updatedBy: {
          _id: "507f1f77bcf86cd799439013",
          name: "محمد علي",
        },
      },
      {
        _id: "507f1f77bcf86cd799439021",
        company: {
          _id: "507f1f77bcf86cd799439022",
          name: "شركة الفرات للسيارات",
        },
        percentage: 12,
        fixedAmount: 0,
        isActive: true,
        updatedBy: {
          _id: "507f1f77bcf86cd799439013",
          name: "محمد علي",
        },
      },
      {
        _id: "507f1f77bcf86cd799439031",
        company: {
          _id: "507f1f77bcf86cd799439032",
          name: "شركة أجني للتأجير",
        },
        percentage: 10,
        fixedAmount: 0,
        isActive: false,
        updatedBy: {
          _id: "507f1f77bcf86cd799439013",
          name: "محمد علي",
        },
      },
    ],
  },
};

// مثال 7: الحصول على عمولة شركة محددة
const exampleGetCommissionForCompany = {
  endpoint: "GET /api/commissions/company/507f1f77bcf86cd799439012",
  expectedResponse: {
    success: true,
    data: {
      _id: "507f1f77bcf86cd799439011",
      company: {
        _id: "507f1f77bcf86cd799439012",
        name: "شركة الراقي للنقل",
      },
      percentage: 15,
      fixedAmount: 2,
      isActive: true,
      notes: "عمولة خاصة للشركات الكبرى",
      createdAt: "2024-01-15T10:30:00Z",
      updatedAt: "2024-01-20T14:25:00Z",
    },
  },
};

// مثال 8: تعطيل عمولة مؤقتاً
const exampleDisableCommission = {
  endpoint: "PUT /api/commissions/507f1f77bcf86cd799439011",
  requestBody: {
    isActive: false,
    notes: "تم تعطيل العمولة للفترة الترويجية (فبراير 2024)",
  },
  expectedResponse: {
    success: true,
    message: "تم تعديل العمولة بنجاح",
    data: {
      _id: "507f1f77bcf86cd799439011",
      company: "507f1f77bcf86cd799439012",
      percentage: 15,
      fixedAmount: 2,
      isActive: false,
      notes: "تم تعطيل العمولة للفترة الترويجية (فبراير 2024)",
      updatedAt: "2024-01-26T16:00:00Z",
    },
  },
};

// مثال 9: سيناريو واقعي - شركة جديدة
const exampleRealScenario = {
  title: "سيناريو واقعي: إضافة شركة جديدة وإدارة عمولتها",
  steps: [
    {
      step: 1,
      action: "إنشاء شركة جديدة",
      endpoint: "POST /api/companies",
      data: {
        name: "شركة الحسين للتأجير",
        phone: "07777888999",
        address: "بغداد، الكرادة",
        commissionPercentage: 12,
      },
      result: "تم إنشاء الشركة والعمولة الافتراضية (12%)",
    },
    {
      step: 2,
      action: "بعد شهر، ارتفع الأداء - زيادة العمولة",
      endpoint: "PUT /api/commissions/507f1f77bcf86cd799439011",
      data: {
        percentage: 20,
        notes: "تم زيادة العمولة من 12% إلى 20% نتيجة الأداء الممتاز",
      },
      result: "تم تحديث العمولة",
    },
    {
      step: 3,
      action: "العميل يحجز سيارة بـ 600$",
      endpoint: "POST /api/bookings",
      data: {
        totalPrice: 600,
        companyId: "507f1f77bcf86cd799439012",
      },
      result: "تم حساب العمولة = (600 * 20%) = 120$",
    },
    {
      step: 4,
      action: "فترة ترويجية - تعطيل العمولة",
      endpoint: "PUT /api/commissions/507f1f77bcf86cd799439011",
      data: {
        isActive: false,
        notes: "فترة ترويجية لمدة أسبوع",
      },
      result: "الحجوزات الجديدة لن تحتسب عمولة",
    },
    {
      step: 5,
      action: "تفعيل العمولة مجدداً",
      endpoint: "PUT /api/commissions/507f1f77bcf86cd799439011",
      data: {
        isActive: true,
        notes: "إعادة تفعيل العمولة بعد انتهاء الفترة الترويجية",
      },
      result: "الحجوزات الجديدة ستحتسب العمولة (20%)",
    },
  ],
};

// مثال 10: معادلة حساب العمولة المعقدة
const exampleComplexCalculation = {
  title: "حساب العمولة معقد",
  scenario: {
    company: "شركة الراقي للنقل",
    commissionPercentage: 15,
    commissionFixedAmount: 3,
    bookingAmount: 1200,
  },
  calculation: {
    step1: "حساب النسبة المئوية: 1200 × 15% = 180",
    step2: "إضافة المبلغ الثابت: 180 + 3 = 183",
    step3: "حساب الصافي: 1200 - 183 = 1017",
  },
  result: {
    grossAmount: 1200,
    commissionPercentageAmount: 180,
    commissionFixedAmount: 3,
    totalCommission: 183,
    netAmount: 1017,
  },
};

// التصدير
export const commissionExamples = {
  exampleCalculateCommission,
  exampleCalculateCommissionWithFixed,
  exampleCreateCompanyWithCommission,
  exampleUpdateCommission,
  exampleCreateBookingWithCommission,
  exampleGetAllCommissions,
  exampleGetCommissionForCompany,
  exampleDisableCommission,
  exampleRealScenario,
  exampleComplexCalculation,
};

export default commissionExamples;
