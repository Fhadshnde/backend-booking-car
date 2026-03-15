# نظام إدارة العمولات 💰

## نظرة عامة
نظام شامل لإدارة العمولات على منصة تأجير السيارات، يسمح بتعيين عمولة لكل شركة وتعديلها في أي وقت من قبل الادمن.

---

## المميزات الرئيسية

### 1. **عمولة ديناميكية**
- نسبة مئوية قابلة للتعديل (0-100%)
- مبلغ ثابت إضافي (اختياري)
- العمولة الإجمالية = (السعر × النسبة%) + المبلغ الثابت

### 2. **إنشاء تلقائي عند إنشاء شركة**
- عند إنشاء شركة جديدة، يتم إنشاء عمولة تلقائياً
- العمولة الافتراضية 10% بدون مبلغ ثابت
- يمكن تخصيصها أثناء الإنشاء

### 3. **حساب العمولة التلقائي**
- عند كل حجز جديد، يتم حساب العمولة تلقائياً
- تسجيل تفاصيل العمولة مع كل حجز
- عرض صافي المبلغ بعد خصم العمولة

### 4. **تتبع كامل**
- تسجيل من قام بآخر تعديل (الادمن)
- تواريخ الإنشاء والتعديل
- حالة التفعيل (مفعلة/معطلة)

---

## API Endpoints

### 🔹 الحصول على عمولة شركة معينة
```
GET /api/commissions/company/:companyId
```
**الصلاحيات:** مصرح لأي مستخدم مصرح (الادمن أو الشركة)

**مثال الاستجابة:**
```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "company": {
      "_id": "507f1f77bcf86cd799439012",
      "name": "شركة الراقي للنقل",
      "email": "info@alraqi.com"
    },
    "percentage": 15,
    "fixedAmount": 2,
    "isActive": true,
    "notes": "عمولة خاصة للشركات الكبرى",
    "updatedBy": "507f1f77bcf86cd799439013",
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-20T14:25:00Z"
  }
}
```

---

### 🔹 الحصول على جميع العمولات
```
GET /api/commissions
```
**الصلاحيات:** ⚠️ **للادمن فقط**

**مثال الاستجابة:**
```json
{
  "success": true,
  "count": 5,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "company": {
        "_id": "507f1f77bcf86cd799439012",
        "name": "شركة الراقي للنقل"
      },
      "percentage": 15,
      "fixedAmount": 2,
      "isActive": true,
      "updatedBy": {
        "_id": "507f1f77bcf86cd799439013",
        "name": "محمد علي",
        "email": "admin@platform.com"
      },
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-20T14:25:00Z"
    }
    // ... المزيد من العمولات
  ]
}
```

---

### 🔹 إنشاء عمولة جديدة
```
POST /api/commissions
```
**الصلاحيات:** ⚠️ **للادمن فقط**

**body المطلوب:**
```json
{
  "companyId": "507f1f77bcf86cd799439012",
  "percentage": 12,
  "fixedAmount": 1.5,
  "notes": "عمولة خاصة بناءً على الاتفاقية"
}
```

**مثال الاستجابة:**
```json
{
  "success": true,
  "message": "تم إنشاء العمولة بنجاح",
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "company": "507f1f77bcf86cd799439012",
    "percentage": 12,
    "fixedAmount": 1.5,
    "isActive": true,
    "notes": "عمولة خاصة بناءً على الاتفاقية",
    "updatedBy": "507f1f77bcf86cd799439013",
    "createdAt": "2024-01-25T12:00:00Z"
  }
}
```

---

### 🔹 تعديل العمولة
```
PUT /api/commissions/:commissionId
```
**الصلاحيات:** ⚠️ **للادمن فقط**

**body المطلوب (اختياري جزئياً):**
```json
{
  "percentage": 18,
  "fixedAmount": 2.5,
  "isActive": true,
  "notes": "تم زيادة العمولة بناءً على الأداء الجيد"
}
```

**مثال الاستجابة:**
```json
{
  "success": true,
  "message": "تم تعديل العمولة بنجاح",
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "company": "507f1f77bcf86cd799439012",
    "percentage": 18,
    "fixedAmount": 2.5,
    "isActive": true,
    "notes": "تم زيادة العمولة بناءً على الأداء الجيد",
    "updatedBy": "507f1f77bcf86cd799439013",
    "updatedAt": "2024-01-26T15:45:00Z"
  }
}
```

---

### 🔹 حذف العمولة
```
DELETE /api/commissions/:commissionId
```
**الصلاحيات:** ⚠️ **للادمن فقط**

**مثال الاستجابة:**
```json
{
  "success": true,
  "message": "تم حذف العمولة بنجاح"
}
```

---

## نموذج البيانات

### Commission Schema
```javascript
{
  company: ObjectId (مرجع للشركة),
  percentage: Number (0-100) - النسبة المئوية,
  fixedAmount: Number - المبلغ الثابت,
  isActive: Boolean - حالة التفعيل,
  notes: String - ملاحظات,
  updatedBy: ObjectId (مرجع للادمن الذي قام بالتعديل),
  createdAt: Date - تاريخ الإنشاء,
  updatedAt: Date - تاريخ آخر تعديل
}
```

---

## حساب العمولة

### الصيغة الرياضية:
```
العمولة = (السعر الإجمالي × النسبة المئوية / 100) + المبلغ الثابت
```

### مثال عملي:
```
السعر الإجمالي: 100$
النسبة المئوية: 15%
المبلغ الثابت: 2$

العمولة = (100 × 15 / 100) + 2 = 15 + 2 = 17$
الصافي = 100 - 17 = 83$
```

---

## تكامل العمولة مع الحجوزات

### عند إنشاء حجز جديد:

```javascript
// يتم حساب العمولة تلقائياً
const commission = await Commission.findOne({ 
  company: companyId, 
  isActive: true 
});

let commissionAmount = 0;
if (commission) {
  commissionAmount = (totalPrice * commission.percentage) / 100 + commission.fixedAmount;
}

// يتم حفظ تفاصيل العمولة مع الحجز
const booking = new Booking({
  // ... بيانات الحجز
  commission: {
    amount: commissionAmount,
    percentage: commission.percentage,
    fixedAmount: commission.fixedAmount,
  }
});
```

### بيانات الحجز تشمل:
```json
{
  "_id": "507f1f77bcf86cd799439099",
  "user": "507f1f77bcf86cd799439001",
  "car": "507f1f77bcf86cd799439002",
  "company": "507f1f77bcf86cd799439012",
  "startDate": "2024-02-01",
  "endDate": "2024-02-05",
  "totalPrice": 500,
  "commission": {
    "amount": 75,
    "percentage": 15,
    "fixedAmount": 0
  },
  "status": "confirmed"
}
```

---

## حالات الاستخدام

### 1️⃣ إنشاء شركة جديدة مع عمولة افتراضية
```bash
POST /api/companies
{
  "name": "شركة الراقي",
  "phone": "07700123456",
  "address": "بغداد، الكاظمية",
  "commissionPercentage": 12
}
```
✅ يتم إنشاء الشركة والعمولة تلقائياً

---

### 2️⃣ تعديل عمولة شركة موجودة
```bash
PUT /api/commissions/507f1f77bcf86cd799439011
{
  "percentage": 18,
  "notes": "تم زيادة العمولة لشهر فبراير"
}
```
✅ يتم تحديث العمولة وجميع الحجوزات الجديدة ستأخذ النسبة الجديدة

---

### 3️⃣ تعطيل عمولة مؤقتاً
```bash
PUT /api/commissions/507f1f77bcf86cd799439011
{
  "isActive": false,
  "notes": "تم تعطيل العمولة لفترة ترويجية"
}
```
✅ الحجوزات الجديدة لن تحتسب عمولة حتى يتم تفعيلها

---

## ملاحظات أمان مهمة

⚠️ **جميع عمليات إدارة العمولات محمية:**
- تتطلب JWT Token صحيح
- تتطلب صلاحيات admin
- يتم تسجيل من قام بكل عملية تعديل

---

## أمثلة cURL

### الحصول على عمولة شركة:
```bash
curl -X GET "http://localhost:5000/api/commissions/company/507f1f77bcf86cd799439012" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### تعديل عمولة:
```bash
curl -X PUT "http://localhost:5000/api/commissions/507f1f77bcf86cd799439011" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "percentage": 20,
    "notes": "عمولة جديدة للربع الأول"
  }'
```

---

## رسائل الخطأ الشائعة

| الخطأ | السبب | الحل |
|-------|-------|------|
| `401 Unauthorized` | لا يوجد JWT Token | أضف token صحيح في headers |
| `403 Forbidden` | ليس لديك صلاحيات admin | تأكد من أنك مسجل كادمن |
| `404 Not Found` | العمولة غير موجودة | تحقق من commission ID |
| `400 Bad Request` | النسبة خارج النطاق (0-100) | استخدم نسبة بين 0 و 100 |

---

## الخلاصة

✅ نظام عمولات كامل وآمن
✅ حساب تلقائي مع كل حجز
✅ تحكم كامل من لوحة الادمن
✅ تسجيل شامل لجميع التعديلات
✅ مرن وقابل للتوسع
