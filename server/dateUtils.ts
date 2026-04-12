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
