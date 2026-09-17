/**
 * Date Utilities - توحيد حساب التاريخ في جميع الصفحات
 * 
 * اليوم يبدأ من الساعة 5 فجراً إلى الساعة 5 فجراً اليوم التالي
 * مثال: تاريخ 2025/12/21 يبدأ من 2025/12/21 05:00:00 إلى 2025/12/22 04:59:59
 */

/**
 * Get start of "day" (5:00 AM)
 * @param date - التاريخ المطلوب (اختياري، افتراضياً اليوم)
 * @returns Date object at 5:00 AM of the given date
 */
export function getStartOfDay(date?: Date): Date {
  const d = date ? new Date(date) : new Date();
  d.setHours(5, 0, 0, 0);
  
  // إذا كانت الساعة الحالية قبل 5 فجراً، نرجع ليوم أمس الساعة 5 فجراً
  const now = date ? new Date(date) : new Date();
  if (now.getHours() < 5) {
    d.setDate(d.getDate() - 1);
  }
  
  return d;
}

/**
 * Get end of "day" (4:59:59.999 AM next day)
 * @param date - التاريخ المطلوب (اختياري، افتراضياً اليوم)
 * @returns Date object at 4:59:59.999 AM of the next day
 */
export function getEndOfDay(date?: Date): Date {
  const start = getStartOfDay(date);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  end.setMilliseconds(-1); // 4:59:59.999
  
  return end;
}

/**
 * Get start and end of today
 * @returns { start: Date, end: Date }
 */
export function getTodayRange(): { start: Date; end: Date } {
  return {
    start: getStartOfDay(),
    end: getEndOfDay(),
  };
}

/**
 * Get start and end of yesterday
 * @returns { start: Date, end: Date }
 */
export function getYesterdayRange(): { start: Date; end: Date } {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  
  return {
    start: getStartOfDay(yesterday),
    end: getEndOfDay(yesterday),
  };
}

/**
 * Get start and end of a specific date
 * @param dateStr - التاريخ بصيغة YYYY-MM-DD
 * @returns { start: Date, end: Date }
 */
export function getDateRange(dateStr: string): { start: Date; end: Date } {
  const date = new Date(dateStr);
  
  return {
    start: getStartOfDay(date),
    end: getEndOfDay(date),
  };
}

/**
 * Get date string in YYYY-MM-DD format for the "business day"
 * @param date - التاريخ المطلوب (اختياري، افتراضياً اليوم)
 * @returns Date string in YYYY-MM-DD format
 */
export function getBusinessDateString(date?: Date): string {
  const d = date ? new Date(date) : new Date();
  
  // إذا كانت الساعة قبل 5 فجراً، نعتبر اليوم هو يوم أمس
  if (d.getHours() < 5) {
    d.setDate(d.getDate() - 1);
  }
  
  return d.toISOString().split('T')[0];
}


/**
 * Get current time in Iraq timezone (GMT+3)
 * This function returns the current time adjusted to Iraq timezone
 * @returns Date object with Iraq timezone (GMT+3)
 */
export function getCurrentTimeInIraq(): Date {
  // Get current UTC time
  const now = new Date();
  
  // Convert to Iraq timezone (GMT+3)
  // Iraq is UTC+3, so we add 3 hours to UTC time
  const iraqTime = new Date(now.getTime() + (3 * 60 * 60 * 1000));
  
  return iraqTime;
}

/**
 * Get current ISO string in Iraq timezone (GMT+3)
 * This function returns the current time as ISO string in UTC
 * The frontend will display it in Iraq timezone using toLocaleString with timeZone: 'Asia/Baghdad'
 * @returns ISO string in UTC (which will be displayed as GMT+3 on frontend)
 */
export function getCurrentTimeISOInIraq(): string {
  // Get current UTC time
  const now = new Date();

  // Return the current UTC time as ISO string
  // The frontend will display it in Iraq timezone (GMT+3) using toLocaleString with timeZone: 'Asia/Baghdad'
  return now.toISOString();
}

/**
 * Current time formatted for MySQL/MariaDB DATETIME/TIMESTAMP columns
 * ('YYYY-MM-DD HH:MM:SS' in the server's local timezone).
 * ISO strings with 'T'/'Z' are rejected by MariaDB and strict-mode MySQL,
 * so always use this for values written to the database.
 */
export function toSqlDatetime(value: Date | string | number): string {
  // Date-only strings (used for business-date columns) pass through unchanged
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  // Already SQL-formatted datetime strings pass through unchanged
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) {
    return value;
  }
  const date = value instanceof Date ? value : new Date(value);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
}

export function getCurrentSqlDatetime(): string {
  return toSqlDatetime(new Date());
}

// ── بداية يوم العمل بتوقيت بغداد ────────────────────────────────────────────
// الخادم على Railway يعمل بتوقيت UTC بينما الفرع يعمل بتوقيت بغداد (UTC+3).
// استخدام HOUR(NOW()) في SQL كان يعني "الساعة 5 بتوقيت UTC" أي 8 صباحاً بغداد،
// فتختلف حدود اليوم بين الخادم والمتصفّح وتظهر الطلبات ثم تختفي.
// هذه الدوال تحسب الحدّ بتوقيت بغداد دائماً مهما كان توقيت الخادم.
export const BUSINESS_DAY_START_HOUR = 5;
const BAGHDAD_OFFSET_MS = 3 * 60 * 60 * 1000; // UTC+3 بلا توقيت صيفي في العراق

/** بداية يوم العمل الحالي (5 فجراً بتوقيت بغداد) كـ Date بتوقيت UTC الحقيقي. */
export function getBusinessDayStart(now: Date = new Date()): Date {
  const baghdad = new Date(now.getTime() + BAGHDAD_OFFSET_MS);
  const startBaghdad = new Date(baghdad);
  startBaghdad.setUTCHours(BUSINESS_DAY_START_HOUR, 0, 0, 0);
  if (baghdad.getUTCHours() < BUSINESS_DAY_START_HOUR) {
    startBaghdad.setUTCDate(startBaghdad.getUTCDate() - 1);
  }
  return new Date(startBaghdad.getTime() - BAGHDAD_OFFSET_MS);
}

/** بداية يوم العمل الحالي بصيغة DATETIME صالحة لـ MySQL (بتوقيت الخادم/UTC). */
export function getBusinessDayStartSql(now: Date = new Date()): string {
  const d = getBusinessDayStart(now);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ` +
    `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}
