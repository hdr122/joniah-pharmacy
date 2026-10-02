# بناء تطبيق المندوب (Android) وتثبيته

تطبيق المندوب غلافٌ أصلي (Capacitor) يفتح لوحة المندوب بنفس الشكل والمزايا، مع
إضافات أصلية: إشعارات، تتبّع دقيق للموقع يعمل والجهاز مقفل، إشعار دائم أثناء
العمل، وخرائط تعمل بلا إنترنت مع حفظ المسار.

> التطبيق يحمّل الواجهة من `https://xenondelivery.up.railway.app` مباشرة، لذا أي
> تحديث للواجهة يصل للمندوبين فوراً **بلا إعادة بناء**. لا تحتاج APK جديداً إلّا
> عند تغيير الصلاحيات أو إضافات Capacitor أو إعداداته.

## الطريقة المُوصى بها: بناء سحابي (GitHub Actions) — بلا تثبيت أدوات

> **خطوة لمرّة واحدة:** ملف سير العمل موجود في المستودع باسم
> `ci/android-apk.workflow.yml`. انسخه إلى المسار `.github/workflows/android.yml`
> (أسهل طريقة: من GitHub ← Add file ← Create new file، الصق المسار والمحتوى).
> سبب وجوده خارج `.github/workflows` أنّ صلاحية الدفع الحالية لا تملك نطاق
> `workflow` المطلوب لإنشاء ملفات سير العمل تلقائياً.

1. ضع ملف سير العمل في مكانه كما بالأعلى.
2. من المستودع: تبويب **Actions** ← **بناء تطبيق المندوب (Android APK)** ← **Run workflow**.
3. انتظر ~٥ دقائق، ثم نزّل الملف من **Artifacts → xenon-delivery-apk**.
4. لإصدار عام للتحميل المباشر: ادفع وسماً، مثلاً:
   ```bash
   git tag v1.0.0 && git push origin v1.0.0
   ```
   سيُنشر الـ APK تلقائياً في صفحة **Releases**.

الناتج `app-debug.apk` قابل للتثبيت مباشرة (Sideload): انقله للهاتف وثبّته بعد
السماح بـ«تثبيت من مصادر غير معروفة».

## البناء المحلي (إن توفّر Android Studio / Android SDK)

```bash
pnpm install
pnpm exec vite build          # بناء الواجهة
pnpm exec cap sync android    # نسخ الأصول وتحديث الإضافات
cd android
./gradlew assembleDebug       # الناتج: app/build/outputs/apk/debug/app-debug.apk
```

يتطلب: JDK 21، وAndroid SDK (platform 36). افتح `android/` في Android Studio ليُنزّل
المكوّنات تلقائياً، أو اضبط `ANDROID_HOME`.

## إصدار موقّع للنشر (Play Store أو توزيع رسمي)

أنشئ keystore مرّة واحدة:
```bash
keytool -genkey -v -keystore xenon.keystore -alias xenon -keyalg RSA -keysize 2048 -validity 10000
```
ثم في Actions أضف الأسرار (Secrets) وعدّل خطوة البناء إلى `assembleRelease` مع
التوقيع. (debug APK كافٍ للتثبيت على أجهزة المندوبين مباشرةً.)

## المزايا الأصلية وكيف تعمل

- **بدء العمل / إشعار دائم:** عند ضغط «بدء العمل» يطلب التطبيق صلاحية الموقع
  «طوال الوقت» ويشغّل خدمة مقدّمة (foreground service) تُظهر إشعاراً **لا يُحذف**
  نصّه «Xenon — جارٍ العمل 🟢». يبقى التتبّع يعمل والجهاز مقفل أو التطبيق مُغلق
  من المهام الأخيرة (إضافة `@capacitor-community/background-geolocation`).
- **صلاحيات أندرويد** (معرّفة في `android/app/src/main/AndroidManifest.xml`):
  `ACCESS_FINE_LOCATION`, `ACCESS_BACKGROUND_LOCATION`, `FOREGROUND_SERVICE`,
  `FOREGROUND_SERVICE_LOCATION`, `POST_NOTIFICATIONS`, `WAKE_LOCK`,
  `RECEIVE_BOOT_COMPLETED`.
  > مهم: على أندرويد ١٠+ يجب أن يختار المندوب **«السماح طوال الوقت»** لصلاحية
  > الموقع يدوياً من إعدادات التطبيق ليعمل التتبّع في الخلفية.
- **العمل بلا إنترنت:** كل نقطة GPS تُحفظ في IndexedDB على الجهاز أولاً
  (`client/src/lib/offlineQueue.ts`) ثم تُرسل للخادم دفعةً عند عودة الاتصال —
  فلا يضيع المسار مهما انقطع النت.
- **خريطة المحافظة بلا إنترنت:** من لوحة المندوب ← «الخريطة ومساري» ← «تنزيل
  خريطة المحافظة». تُخزَّن البلاطات في IndexedDB وتُعرض بلا إنترنت مع رسم مسار
  المندوب (`client/src/lib/offlineTiles.ts`, `pages/delivery/OfflineMap.tsx`).

### مصدر بلاطات الخريطة
الافتراضي OpenStreetMap. سياسة OSM لا تسمح بالتنزيل المجمّع الكثيف؛ للاستخدام
الواسع اضبط متغيّر البيئة `VITE_TILE_URL` على مصدرٍ يسمح بذلك (MapTiler/
Thunderforest بمفتاح، أو خادم بلاطات خاص) قبل البناء، مثال:
```
VITE_TILE_URL=https://api.maptiler.com/maps/streets/{z}/{x}/{y}.png?key=YOUR_KEY
```
