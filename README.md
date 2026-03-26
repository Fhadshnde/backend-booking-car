# Car Booking Backend API

نظام حجز السيارات - API Backend

## 🚀 التثبيت والتشغيل

### 1. تثبيت المكتبات
```bash
npm install
```

### 2. إعداد متغيرات البيئة
```bash
cp .env.example .env
```

### 3. تشغيل السيرفر
```bash
# للتطوير
npm run dev

# للإنتاج
npm start
```

## 📚 المسارات الرئيسية

### Authentication
- `POST /api/auth/register` - إنشاء حساب
- `POST /api/auth/login` - تسجيل دخول
- `GET /api/auth/me` - بيانات المستخدم (محمي)
- `PUT /api/auth/change-password` - تغيير كلمة المرور (محمي)

### Users
- `GET /api/users/profile` - ملفي الشخصي (محمي)
- `PUT /api/users/profile` - تحديث الملف (محمي)
- `GET /api/users` - جميع المستخدمين (Admin)
- `GET /api/users/:id` - مستخدم محدد (Admin)
- `PUT /api/users/:id` - تحديث مستخدم (Admin)
- `DELETE /api/users/:id` - حذف مستخدم (Admin)

### Companies
- `GET /api/companies` - جميع الشركات
- `GET /api/companies/:id` - شركة محددة
- `POST /api/companies` - إنشاء شركة (Admin)
- `PUT /api/companies/:id` - تحديث (Admin)
- `DELETE /api/companies/:id` - حذف (Admin)
- `GET /api/companies/profile/view` - ملفي (Company)
- `PUT /api/companies/profile/update` - تحديث ملفي (Company)
- `GET /api/companies/dashboard/main` - لوحة تحكمي (Company)
- `GET /api/companies/:companyId/cars` - سيارات الشركة (محمي)

### Cars
- `GET /api/cars` - جميع السيارات
- `GET /api/cars/search` - البحث والتصفية
- `GET /api/cars/:id` - سيارة محددة
- `GET /api/cars/:id/details` - تفاصيل كاملة
- `GET /api/cars/:id/availability` - التحقق من التوفر
- `POST /api/cars` - إضافة سيارة (Admin)
- `PUT /api/cars/:id` - تحديث (Admin, Company)
- `DELETE /api/cars/:id` - حذف (Admin)
- `GET /api/cars/company/:companyId` - سيارات الشركة (محمي)

### Bookings
- `GET /api/bookings` - جميع الحجوزات
- `GET /api/bookings/:id` - حجز محدد
- `POST /api/bookings` - إنشاء حجز (User)
- `PUT /api/bookings/:id` - تحديث (User)
- `DELETE /api/bookings/:id` - إلغاء (User)
- `GET /api/bookings/user/my-bookings` - حجوزاتي (User)
- `GET /api/bookings/:id/details` - تفاصيل الحجز (محمي)
- `GET /api/bookings/company/:companyId` - حجوزات الشركة (Company, Admin)
- `PUT /api/bookings/:id/confirm` - تأكيد (Company, Admin)
- `PUT /api/bookings/:id/complete` - إكمال (Company, Admin)

### Admin
- `GET /api/admin/dashboard` - لوحة التحكم
- `PUT /api/admin/users/:userId/toggle-status` - تفعيل/تعطيل مستخدم
- `GET /api/admin/companies/pending` - الشركات المعلقة
- `PUT /api/admin/companies/:companyId/approve` - الموافقة على شركة
- `PUT /api/admin/companies/:companyId/reject` - رفض شركة
- `DELETE /api/admin/bookings/:bookingId/cancel` - إلغاء حجز
- `GET /api/admin/reports/bookings` - تقارير الحجوزات
- `PUT /api/admin/cars/:carId/suspend` - تعليق سيارة
- `PUT /api/admin/cars/:carId/unsuspend` - إلغاء تعليق
- `GET /api/admin/complaints` - الشكاوى
- `PUT /api/admin/complaints/:complaintId/respond` - الرد على شكوى

## 🔐 الصلاحيات

| العملية | User | Company | Admin |
|--------|------|---------|-------|
| إنشاء حجز | ✅ | ❌ | ❌ |
| تأكيد حجز | ❌ | ✅ | ✅ |
| إنشاء سيارة | ❌ | ❌ | ✅ |
| تعديل سيارة | ❌ | ✅ | ✅ |
| إدارة الشركات | ❌ | ❌ | ✅ |
| لوحة التحكم | ❌ | ✅ | ✅ |

## 📋 مثال على الاستخدام

### تسجيل حساب جديد
```bash
curl -X POST http://http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Ahmed",
    "email": "ahmed@example.com",
    "password": "Password123",
    "phone": "+966501234567"
  }'
```

### تسجيل الدخول
```bash
curl -X POST http://http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "ahmed@example.com",
    "password": "Password123"
  }'
```

### إنشاء حجز
```bash
curl -X POST http://http://localhost:5000/api/bookings \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "carId": "car_id",
    "companyId": "company_id",
    "startDate": "2024-01-20",
    "endDate": "2024-01-25",
    "pickupLocation": "Hotel",
    "dropoffLocation": "Airport",
    "insurance": true
  }'
```

## 🛠️ التكنولوجيا المستخدمة

- **Express.js** - Web Framework
- **MongoDB** - Database
- **Mongoose** - ODM
- **JWT** - Authentication
- **bcryptjs** - Password Hashing

## 📝 ملاحظات

- جميع الـ Tokens صالحة لـ 7 أيام
- استخدم Bearer Token في Authorization Header
- جميع التواريخ بصيغة ISO 8601 (YYYY-MM-DD)