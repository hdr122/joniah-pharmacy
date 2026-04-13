# 📱 دليل بناء ونشر تطبيق جونيا على الهاتف

## ✅ الحالة الحالية

- ✅ Backend على Railway: `https://dynamic-emotion-production.up.railway.app`
- ✅ PostgreSQL متصل ✅
- ✅ جميع متغيرات البيئة معينة ✅
- ✅ app.json و eas.json جاهزان ✅

---

## 🚀 بناء تطبيق Android (APK)

### الخطوة 1: تسجيل الدخول إلى EAS

```bash
# تسجيل الدخول إلى حسابك على Expo
eas login

# أدخل بيانات اعتمادك على Expo
# اسم المستخدم: 
# كلمة السر: 
```

### الخطوة 2: بناء APK لـ Android

```bash
# بناء APK للإنتاج
eas build --platform android --non-interactive

# أو بناء APK للاختبار
eas build --platform android --profile preview
```

### الخطوة 3: تحميل الملف

بعد انتهاء البناء (10-15 دقيقة)، ستحصل على:
- رابط تحميل APK مباشر
- أو يمكنك الدخول إلى لوحة تحكم EAS لتحميله

```bash
# عرض سجل البناء
eas build:list
```

---

## 🍎 بناء تطبيق iOS (IPA)

### الخطوة 1: إعداد Apple

تحتاج إلى:
1. حساب Apple Developer ($99/سنة)
2. شهادة التوقيع (Signing Certificate)
3. ملف التوفير (Provisioning Profile)

### الخطوة 2: بناء IPA لـ iOS

```bash
# بناء IPA للإنتاج
eas build --platform ios --non-interactive

# أو بناء IPA للمحاكاة
eas build --platform ios --profile preview
```

### الخطوة 3: نشر على App Store

```bash
# بعد بناء IPA بنجاح، استخدم App Store Connect
# للتحميل والنشر

eas submit --platform ios
```

---

## 📲 نشر على Google Play Store (Android)

### المتطلبات:
1. حساب Google Play Developer ($25 لمرة واحدة)
2. شهادة التوقيع الخاصة بك
3. تفاصيل التطبيق (الوصف، الصور، إلخ)

### الخطوات:

```bash
# بناء AAB (Android App Bundle) للنشر
eas build --platform android --non-interactive

# أو نشر مباشرة بعد البناء
eas submit --platform android
```

---

## 🔧 تحديث متغيرات البيئة

لتحديث عنوان الخادم في التطبيق:

**ملف: `client/src/services/api.ts`**

```typescript
const API_URL = 'https://dynamic-emotion-production.up.railway.app';

// استخدم هذا العنوان في جميع الطلبات API
const axiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 10000
});
```

---

## ✨ خطوات سريعة

### Android فقط:
```bash
cd "E:\مشروع جونيا\joniah_pharmacy"
eas login
eas build --platform android --non-interactive
```

### iOS فقط:
```bash
cd "E:\مشروع جونيا\joniah_pharmacy"
eas login
eas build --platform ios --non-interactive
```

### كلاهما معاً:
```bash
cd "E:\مشروع جونيا\joniah_pharmacy"
eas login
eas build --platform android --non-interactive
eas build --platform ios --non-interactive
```

---

## 📊 متابعة البناء

```bash
# عرض حالة البناء الحالي
eas build:view

# عرض سجل جميع البناءات
eas build:list

# إلغاء بناء قيد التقدم
eas build:cancel
```

---

## 🎯 اختبار التطبيق

### على جهاز Android:
1. قم بتحميل APK من رابط EAS
2. قم بتثبيته على جهاز Android الخاص بك
3. اختبر جميع الميزات:
   - تسجيل الدخول ✅
   - تتبع الموقع GPS ✅
   - الإخطارات Push ✅
   - عرض الخريطة ✅

### على محاكي iOS:
```bash
# تثبيت المحاكي
eas build --platform ios --profile preview

# افتح الملف الناتج في Simulator
```

---

## 🚨 استكشاف الأخطاء

### خطأ: "Not authenticated"
```bash
eas logout
eas login
# ثم جرّب البناء مرة أخرى
```

### خطأ: "Build took too long"
- تحقق من اتصالك بالإنترنت
- جرّب البناء مرة أخرى
- تواصل مع دعم EAS إن استمر المشكلة

### خطأ: "Android SDK not found"
```bash
# تأكد من تثبيت Android SDK
# أو استخدم EAS (الموصى به) بدلاً من البناء المحلي
```

---

## 📝 ملاحظات مهمة

1. **عنوان الخادم**: تأكد من تحديث عنوان Railway في كود التطبيق
2. **الإذونات**: لقد أضفنا جميع الإذونات المطلوبة في app.json
3. **الإخطارات**: قم بتفعيل Firebase في التطبيق بعد البناء
4. **الاختبار**: اختبر التطبيق على جهاز حقيقي قبل النشر

---

## 🎓 موارد مفيدة

- Expo Documentation: https://docs.expo.dev/
- EAS Build: https://docs.expo.dev/eas-update/getting-started/
- Google Play Console: https://play.google.com/console
- Apple App Store Connect: https://appstoreconnect.apple.com

---

**تم التحضير في 13 أبريل 2026**
**الحالة: جاهز للبناء والنشر ✅**
