/**
 * دوال مساعدة للتعامل مع التواريخ
 * اليوم يبدأ من الساعة 5 فجراً وينتهي الساعة 4:59 فجراً اليوم التالي
 */

// ثوابت بداية ونهاية اليوم
export const DAY_START_HOUR = 5;
export const DAY_END_HOUR = 4;
export const DAY_END_MINUTE = 59;

/**
 * الحصول على بداية ونهاية اليوم (من 5 فجراً إلى 4:59 فجراً)
 * @param date التاريخ المطلوب (اختياري، افتراضياً اليوم)
 * @returns { start: Date, end: Date }
 */
export function getDayBounds(date?: Date): { start: Date; end: Date } {
  const targetDate = date ? new Date(date) : new Date();
  
  // بداية اليوم: 5 فجراً
  const start = new Date(targetDate);
  start.setHours(DAY_START_HOUR, 0, 0, 0);
  
  // إذا كان الوقت الحالي قبل 5 فجراً، نرجع ليوم أمس
  if (targetDate.getHours() < DAY_START_HOUR) {
    start.setDate(start.getDate() - 1);
  }
  
  // نهاية اليوم: 4:59 فجراً اليوم التالي
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  end.setHours(DAY_END_HOUR, DAY_END_MINUTE, 59, 999);
  
  return { start, end };
}

/**
 * الحصول على بداية ونهاية يوم محدد بالشهر واليوم
 * @param month رقم الشهر (1-12)
 * @param day رقم اليوم (1-31)
 * @param year السنة (اختياري، افتراضياً السنة الحالية)
 * @returns { start: Date, end: Date }
 */
export function getSpecificDayBounds(month: number, day: number, year?: number): { start: Date; end: Date } {
  const currentYear = year || new Date().getFullYear();
  
  // بداية اليوم: 5 فجراً
  const start = new Date(currentYear, month - 1, day, DAY_START_HOUR, 0, 0, 0);
  
  // نهاية اليوم: 4:59 فجراً اليوم التالي
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  end.setHours(DAY_END_HOUR, DAY_END_MINUTE, 59, 999);
  
  return { start, end };
}

/**
 * تنسيق التاريخ بصيغة أرقام إنجليزية (YYYY/MM/DD)
 * @param date التاريخ
 * @returns نص منسق بأرقام إنجليزية
 */
export function formatDate(date: Date | string | number): string {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}/${month}/${day}`;
}

/**
 * تنسيق التاريخ والوقت بصيغة أرقام إنجليزية
 * @param date التاريخ
 * @returns نص منسق بأرقام إنجليزية
 */
export function formatDateTime(date: Date | string | number): string {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${year}/${month}/${day} ${hours}:${minutes}`;
}

/**
 * تنسيق الوقت فقط بصيغة أرقام إنجليزية
 * @param date التاريخ
 * @returns نص منسق بأرقام إنجليزية
 */
export function formatTime(date: Date | string | number): string {
  const d = new Date(date);
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * تنسيق المدة بالدقائق أو الساعات بشكل جميل
 * @param minutes عدد الدقائق
 * @returns نص منسق
 */
export function formatDuration(minutes: number): string {
  if (minutes < 0) return '—';
  
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  
  if (hours === 0) {
    return `${mins} د`;
  } else if (mins === 0) {
    return `${hours} س`;
  } else {
    return `${hours} س ${mins} د`;
  }
}

/**
 * تنسيق المدة بشكل مفصل (للعرض في الجداول)
 * @param startTime وقت البداية
 * @param endTime وقت النهاية
 * @returns نص منسق
 */
export function formatDurationBetween(startTime: Date | string | number | null, endTime: Date | string | number | null): string {
  if (!startTime || !endTime) return '—';
  
  const start = new Date(startTime).getTime();
  const end = new Date(endTime).getTime();
  const diffMs = end - start;
  
  if (diffMs < 0) return '—';
  
  const totalMinutes = Math.floor(diffMs / (1000 * 60));
  return formatDuration(totalMinutes);
}

/**
 * تنسيق التاريخ بصيغة عربية (للتوافق مع الكود القديم)
 * @param date التاريخ
 * @returns نص منسق
 */
export function formatArabicDate(date: Date): string {
  return formatDate(date);
}

/**
 * تنسيق التاريخ والوقت بصيغة عربية (للتوافق مع الكود القديم)
 * @param date التاريخ
 * @returns نص منسق
 */
export function formatArabicDateTime(date: Date): string {
  return formatDateTime(date);
}

/**
 * الحصول على قائمة الأيام في الشهر
 * @param month رقم الشهر (1-12)
 * @param year السنة (اختياري)
 * @returns مصفوفة أرقام الأيام
 */
export function getDaysInMonth(month: number, year?: number): { value: number; label: string }[] {
  const currentYear = year || new Date().getFullYear();
  const daysCount = new Date(currentYear, month, 0).getDate();
  return Array.from({ length: daysCount }, (_, i) => ({
    value: i + 1,
    label: String(i + 1)
  }));
}

/**
 * الحصول على قائمة الأشهر
 * @returns مصفوفة أرقام الأشهر مع أسمائها
 */
export function getMonths(): { value: number; label: string }[] {
  return [
    { value: 1, label: '01' },
    { value: 2, label: '02' },
    { value: 3, label: '03' },
    { value: 4, label: '04' },
    { value: 5, label: '05' },
    { value: 6, label: '06' },
    { value: 7, label: '07' },
    { value: 8, label: '08' },
    { value: 9, label: '09' },
    { value: 10, label: '10' },
    { value: 11, label: '11' },
    { value: 12, label: '12' },
  ];
}

/**
 * الحصول على التاريخ الحالي مع مراعاة بداية اليوم الساعة 5 فجراً
 * @returns التاريخ الفعلي لليوم
 */
export function getCurrentBusinessDay(): Date {
  const now = new Date();
  const result = new Date(now);
  
  // إذا كان الوقت قبل 5 فجراً، نعتبره اليوم السابق
  if (now.getHours() < DAY_START_HOUR) {
    result.setDate(result.getDate() - 1);
  }
  
  return result;
}

/**
 * التحقق مما إذا كان التاريخ ضمن حدود اليوم الحالي
 * @param date التاريخ للتحقق
 * @returns true إذا كان ضمن اليوم الحالي
 */
export function isToday(date: Date | string | number): boolean {
  const { start, end } = getDayBounds();
  const d = new Date(date);
  return d >= start && d <= end;
}

/**
 * الحصول على حدود فترة مخصصة
 * @param startDate تاريخ البداية
 * @param endDate تاريخ النهاية
 * @returns { start: Date, end: Date }
 */
export function getCustomPeriodBounds(startDate: string, endDate: string): { start: Date; end: Date } {
  const start = new Date(startDate);
  start.setHours(DAY_START_HOUR, 0, 0, 0);
  
  const end = new Date(endDate);
  end.setDate(end.getDate() + 1);
  end.setHours(DAY_END_HOUR, DAY_END_MINUTE, 59, 999);
  
  return { start, end };
}

/**
 * دوال تنسيق التواريخ بتوقيت العراق/بغداد
 */

/**
 * تنسيق التاريخ والوقت بتوقيت العراق
 * @param date التاريخ المراد تنسيقه
 * @param options خيارات التنسيق (اختياري)
 * @returns نص منسق بتوقيت العراق
 */
export function formatIraqDate(
  date: Date | string | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!date) return "غير محدد";
  
  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
    timeZone: "Asia/Baghdad",
    ...options,
  };
  
  return new Date(date).toLocaleString("ar-IQ", defaultOptions);
}

/**
 * تنسيق التاريخ فقط (بدون الوقت) بتوقيت العراق
 * @param date التاريخ المراد تنسيقه
 * @returns نص منسق بتوقيت العراق
 */
export function formatIraqDateOnly(
  date: Date | string | null | undefined
): string {
  if (!date) return "غير محدد";
  
  return new Date(date).toLocaleString("ar-IQ", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Baghdad",
  });
}

/**
 * تنسيق الوقت فقط (بدون التاريخ) بتوقيت العراق
 * @param date التاريخ المراد تنسيقه
 * @returns نص منسق بتوقيت العراق
 */
export function formatIraqTimeOnly(
  date: Date | string | null | undefined
): string {
  if (!date) return "غير محدد";
  
  return new Date(date).toLocaleString("ar-IQ", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Baghdad",
  });
}

/**
 * تنسيق التاريخ والوقت بتنسيق قصير بتوقيت العراق
 * @param date التاريخ المراد تنسيقه
 * @returns نص منسق بتوقيت العراق
 */
export function formatIraqDateShort(
  date: Date | string | null | undefined
): string {
  if (!date) return "غير محدد";
  
  return new Date(date).toLocaleString("ar-IQ", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Baghdad",
  });
}

/**
 * تنسيق التاريخ والوقت بتنسيق إنجليزي بتوقيت العراق
 * @param date التاريخ المراد تنسيقه
 * @returns نص منسق بتوقيت العراق
 */
export function formatIraqDateEN(
  date: Date | string | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!date) return "N/A";
  
  // حساب يدوي لتوقيت بغداد (GMT+3)
  const d = new Date(date);
  
  // إضافة 3 ساعات يدويًا (10800000 ميلي ثانية)
  const iraqTime = new Date(d.getTime() + 3 * 60 * 60 * 1000);
  
  // استخراج المكونات باستخدام get* (بدون UTC لأننا أضفنا الساعات بالفعل)
  const year = iraqTime.getFullYear();
  const month = String(iraqTime.getMonth() + 1).padStart(2, '0');
  const day = String(iraqTime.getDate()).padStart(2, '0');
  let hours = iraqTime.getHours();
  const minutes = String(iraqTime.getMinutes()).padStart(2, '0');
  const seconds = String(iraqTime.getSeconds()).padStart(2, '0');
  
  // تحويل إلى صيغة 12 ساعة
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // 0 يصبح 12
  const hoursStr = String(hours).padStart(2, '0');
  
  return `${month}/${day}/${year}, ${hoursStr}:${minutes}:${seconds} ${ampm}`;
}


/**
 * دوال تنسيق الأرقام والعملات
 */

/**
 * تنسيق الرقم بفواصل عشرية (آلاف)
 * @param num الرقم المراد تنسيقه
 * @returns الرقم المنسق (مثل: 250,000)
 */
export function formatNumberWithCommas(num: string | number): string {
  if (!num) return "";
  
  // تحويل إلى رقم وإزالة أي فواصل موجودة
  const numStr = String(num).replace(/,/g, "");
  
  // التحقق من أنه رقم صحيح
  if (!/^\d+$/.test(numStr)) return numStr;
  
  // إضافة الفواصل
  return numStr.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * إزالة الفواصل من الرقم
 * @param num الرقم المراد إزالة الفواصل منه
 * @returns الرقم بدون فواصل
 */
export function removeCommas(num: string): string {
  return num.replace(/,/g, "");
}

/**
 * تنسيق السعر بالدينار العراقي مع فواصل عشرية
 * @param price السعر
 * @returns السعر المنسق (مثل: 250,000 د.ع)
 */
export function formatIraqiPrice(price: string | number): string {
  const formatted = formatNumberWithCommas(price);
  return formatted ? `${formatted} د.ع` : "0 د.ع";
}
