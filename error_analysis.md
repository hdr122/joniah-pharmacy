# تحليل خطأ React #310

## الخطأ
```
Error: Minified React error #310; visit https://react.dev/errors/310 for the full message
```

## معنى الخطأ
React Error #310 يعني: "Cannot update a component while rendering a different component"
أي محاولة تحديث حالة مكون أثناء رندر مكون آخر.

## مكان الخطأ
```
at Qze (https://joniah.xyz/assets/index-DTwJ3fXW.js:1104:302327)
at Object.zF [as useCallback] (https://joniah.xyz/assets/index-DTwJ3fXW.js:48:57732)
```

## السبب المحتمل
في صفحة Dashboard للمندوب (/client/src/pages/delivery/Dashboard.tsx):

1. هناك useEffect يحاول تشغيل تتبع الموقع تلقائياً عند التحميل (السطر 83-108)
2. هذا الـ useEffect يستدعي `setLocationTracking(true)` أثناء الرندر
3. هذا يسبب تحديث الحالة أثناء الرندر، مما يؤدي للخطأ #310

## الحل
يجب لف استدعاء `setLocationTracking` داخل `useEffect` بدلاً من استدعائه مباشرة في callback الـ geolocation.
