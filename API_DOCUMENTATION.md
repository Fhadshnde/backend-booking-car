# API Documentation - نظام حجز السيارات

## 📌 معلومات العام

**Base URL:** `http://localhost:5000/api`

**Authentication:** Bearer Token (JWT)

---

## 🔐 1. المصادقة (Authentication)

### تسجيل حساب جديد
```
POST /auth/register
Content-Type: application/json

{
  "name": "أحمد محمد",
  "email": "ahmed@example.com",
  "password": "SecurePassword123",
  "phone": "+966501234567"
}

Response (201):
{
  "success": true,
  "message": "تم إنشاء الحساب بنجاح",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user_id",
    "name": "أحمد محمد",
    "email": "ahmed@example.com",
    "role": "user"
  }
}
```

### تسجيل الدخول
```
POST /auth/login
Content-Type: application/json

{
  "email": "ahmed@example.com",
  "password": "SecurePassword123"
}

Response (200):
{
  "success": true,
  "message": "تم تسجيل الدخول بنجاح",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user_id",
    "name": "أحمد محمد",
    "email": "ahmed@example.com",
    "role": "user",
    "profileImage": null
  }
}
```

### الحصول على بيانات المستخدم الحالي
```
GET /auth/me
Authorization: Bearer <token>

Response (200):
{
  "success": true,
  "user": {
    "id": "user_id",
    "name": "أحمد محمد",
    "email": "ahmed@example.com",
    "role": "user",
    "isActive": true,
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

### تغيير كلمة المرور
```
PUT /auth/change-password
Authorization: Bearer <token>
Content-Type: application/json

{
  "oldPassword": "SecurePassword123",
  "newPassword": "NewPassword123",
  "confirmPassword": "NewPassword123"
}

Response (200):
{
  "success": true,
  "message": "تم تحديث كلمة المرور بنجاح"
}
```

---

## 👥 2. المستخدمين (Users)

### الملف الشخصي
```
GET /users/profile
Authorization: Bearer <token>

Response (200):
{
  "success": true,
  "user": {
    "id": "user_id",
    "name": "أحمد محمد",
    "email": "ahmed@example.com",
    "phone": "+966501234567",
    "address": "الرياض، شارع النيل",
    "city": "الرياض",
    "country": "السعودية"
  }
}
```

### تحديث الملف الشخصي
```
PUT /users/profile
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "أحمد محمد الأحمد",
  "phone": "+966501234568",
  "address": "جدة، شارع المعز",
  "city": "جدة",
  "country": "السعودية",
  "dateOfBirth": "1995-05-15"
}

Response (200):
{
  "success": true,
  "message": "تم تحديث الملف الشخصي بنجاح",
  "user": {...}
}
```

### جميع المستخدمين (Admin فقط)
```
GET /users?page=1&limit=10&role=user
Authorization: Bearer <admin_token>

Response (200):
{
  "success": true,
  "users": [...],
  "pagination": {
    "total": 50,
    "page": 1,
    "limit": 10,
    "pages": 5
  }
}
```

---

## 🏢 3. الشركات (Companies)

### جميع الشركات
```
GET /companies?page=1&limit=10&isApproved=true

Response (200):
{
  "success": true,
  "companies": [
    {
      "id": "company_id",
      "name": "شركة النقل الذهبية",
      "email": "company@example.com",
      "phone": "+966501234567",
      "address": "الرياض",
      "city": "الرياض",
      "country": "السعودية",
      "isApproved": true,
      "rating": 4.5,
      "totalCars": 25,
      "totalBookings": 150
    }
  ]
}
```

### شركة محددة
```
GET /companies/:companyId

Response (200):
{
  "success": true,
  "company": {...}
}
```

### ملف الشركة الشخصي
```
GET /companies/profile/view
Authorization: Bearer <company_token>

Response (200):
{
  "success": true,
  "company": {...}
}
```

### تحديث الملف الشخصي
```
PUT /companies/profile/update
Authorization: Bearer <company_token>
Content-Type: application/json

{
  "name": "شركة النقل الذهبية - الفرع الجديد",
  "phone": "+966501234568",
  "description": "أفضل شركة تأجير سيارات في المملكة",
  "address": "جدة، شارع الملك فهد",
  "city": "جدة",
  "country": "السعودية"
}
```

### لوحة التحكم
```
GET /companies/dashboard/main
Authorization: Bearer <company_token>

Response (200):
{
  "success": true,
  "dashboard": {
    "totalCars": 25,
    "totalBookings": 150,
    "completedBookings": 140,
    "pendingBookings": 10,
    "totalRevenue": 450000,
    "recentBookings": [...]
  }
}
```

---

## 🚗 4. السيارات (Cars)

### جميع السيارات
```
GET /cars?page=1&limit=10&isAvailable=true&category=economy

Response (200):
{
  "success": true,
  "cars": [
    {
      "id": "car_id",
      "brand": "تويوتا",
      "model": "كامري",
      "year": 2023,
      "licensePlate": "ب ج د 1234",
      "pricePerDay": 150,
      "category": "economy",
      "color": "أسود",
      "transmission": "automatic",
      "seats": 5,
      "isAvailable": true,
      "rating": 4.8,
      "totalBookings": 45,
      "companyId": {
        "name": "شركة النقل الذهبية"
      }
    }
  ]
}
```

### البحث عن السيارات
```
GET /cars/search?brand=تويوتا&category=economy&priceMin=100&priceMax=200&fuelType=petrol

Response (200):
{
  "success": true,
  "cars": [...]
}
```

### سيارة محددة
```
GET /cars/:carId

Response (200):
{
  "success": true,
  "car": {...}
}
```

### التحقق من التوفر
```
GET /cars/:carId/availability?startDate=2024-01-20&endDate=2024-01-25

Response (200):
{
  "success": true,
  "isAvailable": true,
  "car": {
    "id": "car_id",
    "brand": "تويوتا",
    "model": "كامري",
    "pricePerDay": 150
  }
}
```

### إضافة سيارة (Admin فقط)
```
POST /cars
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "brand": "تويوتا",
  "model": "كامري",
  "year": 2023,
  "licensePlate": "ب ج د 1234",
  "companyId": "company_id",
  "pricePerDay": 150,
  "category": "economy",
  "color": "أسود",
  "transmission": "automatic",
  "fuelType": "petrol",
  "seats": 5,
  "description": "سيارة حديثة وموثوقة",
  "images": ["url1", "url2"]
}

Response (201):
{
  "success": true,
  "message": "تم إضافة السيارة بنجاح",
  "car": {...}
}
```

---

## 📅 5. الحجوزات (Bookings)

### إنشاء حجز
```
POST /bookings
Authorization: Bearer <token>
Content-Type: application/json

{
  "carId": "car_id",
  "companyId": "company_id",
  "startDate": "2024-01-20",
  "endDate": "2024-01-25",
  "pickupLocation": "فندق هيلتون الرياض",
  "dropoffLocation": "مطار الملك خالد",
  "pickupTime": "10:00 AM",
  "dropoffTime": "6:00 PM",
  "insurance": true
}

Response (201):
{
  "success": true,
  "message": "تم إنشاء الحجز بنجاح",
  "confirmationCode": "BK1705753200000",
  "booking": {
    "id": "booking_id",
    "userId": "user_id",
    "carId": "car_id",
    "companyId": "company_id",
    "startDate": "2024-01-20",
    "endDate": "2024-01-25",
    "totalDays": 5,
    "pricePerDay": 150,
    "totalPrice": 825,
    "status": "pending",
    "paymentStatus": "pending",
    "insurance": true,
    "insurancePrice": 75,
    "confirmationCode": "BK1705753200000"
  }
}
```

### حجوزاتي
```
GET /bookings/user/my-bookings?page=1&limit=10&status=pending
Authorization: Bearer <token>

Response (200):
{
  "success": true,
  "bookings": [...]
}
```

### حجوزات الشركة
```
GET /bookings/company/:companyId?page=1&status=confirmed
Authorization: Bearer <company_token>

Response (200):
{
  "success": true,
  "bookings": [...]
}
```

### تحديث الحجز
```
PUT /bookings/:bookingId
Authorization: Bearer <token>
Content-Type: application/json

{
  "startDate": "2024-01-21",
  "endDate": "2024-01-26",
  "pickupLocation": "فندق هيلتون جديد"
}

Response (200):
{
  "success": true,
  "message": "تم تحديث الحجز بنجاح",
  "booking": {...}
}
```

### إلغاء الحجز
```
DELETE /bookings/:bookingId
Authorization: Bearer <token>
Content-Type: application/json

{
  "reason": "لقد تغيرت خططي"
}

Response (200):
{
  "success": true,
  "message": "تم إلغاء الحجز بنجاح",
  "booking": {...}
}
```

### تأكيد الحجز (Company/Admin)
```
PUT /bookings/:bookingId/confirm
Authorization: Bearer <company_token>

Response (200):
{
  "success": true,
  "message": "تم تأكيد الحجز بنجاح",
  "booking": {...}
}
```

### إكمال الحجز (Company/Admin)
```
PUT /bookings/:bookingId/complete
Authorization: Bearer <company_token>
Content-Type: application/json

{
  "rating": 5,
  "review": "خدمة ممتازة وسيارة نظيفة جداً"
}

Response (200):
{
  "success": true,
  "message": "تم إكمال الحجز بنجاح",
  "booking": {...}
}
```

---

## 🛡️ 6. لوحة المسؤول (Admin Panel)

### لوحة التحكم الرئيسية
```
GET /admin/dashboard
Authorization: Bearer <admin_token>

Response (200):
{
  "success": true,
  "dashboard": {
    "totalUsers": 500,
    "totalCompanies": 25,
    "totalCars": 300,
    "totalBookings": 2500,
    "totalRevenue": 750000,
    "recentBookings": [...],
    "pendingCompanies": [...]
  }
}
```

### الشركات المعلقة
```
GET /admin/companies/pending
Authorization: Bearer <admin_token>

Response (200):
{
  "success": true,
  "pendingCompanies": [...]
}
```

### الموافقة على شركة
```
PUT /admin/companies/:companyId/approve
Authorization: Bearer <admin_token>

Response (200):
{
  "success": true,
  "message": "تم الموافقة على الشركة بنجاح",
  "company": {...}
}
```

### رفض شركة
```
PUT /admin/companies/:companyId/reject
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "rejectionReason": "المستندات غير كاملة"
}

Response (200):
{
  "success": true,
  "message": "تم رفض الشركة بنجاح",
  "company": {...}
}
```

### تفعيل/تعطيل مستخدم
```
PUT /admin/users/:userId/toggle-status
Authorization: Bearer <admin_token>

Response (200):
{
  "success": true,
  "message": "تم تعطيل المستخدم",
  "user": {...}
}
```

### تعليق سيارة
```
PUT /admin/cars/:carId/suspend
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "reason": "تم العثور على خلل ميكانيكي"
}

Response (200):
{
  "success": true,
  "message": "تم تعليق السيارة بنجاح",
  "car": {...}
}
```

### إلغاء تعليق السيارة
```
PUT /admin/cars/:carId/unsuspend
Authorization: Bearer <admin_token>

Response (200):
{
  "success": true,
  "message": "تم إلغاء تعليق السيارة بنجاح",
  "car": {...}
}
```

### تقارير الحجوزات
```
GET /admin/reports/bookings?startDate=2024-01-01&endDate=2024-01-31&status=completed
Authorization: Bearer <admin_token>

Response (200):
{
  "success": true,
  "report": {
    "totalBookings": 150,
    "totalRevenue": 45000,
    "bookingsByStatus": {
      "pending": 10,
      "confirmed": 30,
      "completed": 100,
      "cancelled": 10
    },
    "bookings": [...]
  }
}
```

---

## ⚠️ رموز الأخطاء (Error Codes)

| Code | Message | الحل |
|------|---------|------|
| 400 | Bad Request | تحقق من صحة البيانات المرسلة |
| 401 | Unauthorized | تأكد من وجود Token صحيح |
| 403 | Forbidden | ليس لديك صلاحية لهذا الإجراء |
| 404 | Not Found | المورد غير موجود |
| 500 | Internal Server Error | خطأ في السيرفر |

---

## 🔑 ملاحظات مهمة

1. **Token Expiration**: الـ Token ينتهي بعد 7 أيام
2. **Pagination**: الصفحة الافتراضية = 1، الحد الافتراضي = 10
3. **Date Format**: استخدم ISO 8601 (YYYY-MM-DD)
4. **Currency**: جميع الأسعار بالريال السعودي (SAR)