import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * تنسيق التاريخ والوقت بتوقيت العراق (GMT+3)
 * @param date التاريخ المراد تنسيقه
 * @param options خيارات التنسيق (اختياري)
 * @returns النص المنسق بتوقيت العراق
 */
export function formatIraqDateTime(
  date: Date | string | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!date) return "غير محدد";
  
  try {
    const dateObj = typeof date === "string" ? new Date(date) : date;
    if (isNaN(dateObj.getTime())) return "غير محدد";
    
    // استخدام ar-IQ للعراقي بدلاً من ar-EG
    return dateObj.toLocaleString("ar-IQ", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZone: "Asia/Baghdad", // توقيت العراق GMT+3
      ...options,
    });
  } catch (error) {
    console.warn("Error formatting date:", error);
    return "غير محدد";
  }
}

/**
 * تنسيق التاريخ فقط بتوقيت العراق (GMT+3)
 * @param date التاريخ المراد تنسيقه
 * @param options خيارات التنسيق (اختياري)
 * @returns النص المنسق بتوقيت العراق
 */
export function formatIraqDate(
  date: Date | string | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!date) return "غير محدد";
  
  try {
    const dateObj = typeof date === "string" ? new Date(date) : date;
    if (isNaN(dateObj.getTime())) return "غير محدد";
    
    return dateObj.toLocaleDateString("ar-IQ", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: "Asia/Baghdad", // توقيت العراق GMT+3
      ...options,
    });
  } catch (error) {
    console.warn("Error formatting date:", error);
    return "غير محدد";
  }
}

/**
 * تنسيق الوقت فقط بتوقيت العراق (GMT+3)
 * @param date التاريخ المراد تنسيقه
 * @param options خيارات التنسيق (اختياري)
 * @returns النص المنسق بتوقيت العراق
 */
export function formatIraqTime(
  date: Date | string | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!date) return "غير محدد";
  
  try {
    const dateObj = typeof date === "string" ? new Date(date) : date;
    if (isNaN(dateObj.getTime())) return "غير محدد";
    
    return dateObj.toLocaleTimeString("ar-IQ", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZone: "Asia/Baghdad", // توقيت العراق GMT+3
      ...options,
    });
  } catch (error) {
    console.warn("Error formatting time:", error);
    return "غير محدد";
  }
}

/**
 * تنسيق التاريخ والوقت بصيغة إنجليزية بتوقيت العراق (GMT+3)
 * @param date التاريخ المراد تنسيقه
 * @param options خيارات التنسيق (اختياري)
 * @returns النص المنسق بتوقيت العراق
 */
export function formatIraqDateTimeEN(
  date: Date | string | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!date) return "Not specified";
  
  try {
    const dateObj = typeof date === "string" ? new Date(date) : date;
    if (isNaN(dateObj.getTime())) return "Not specified";
    
    return dateObj.toLocaleString("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZone: "Asia/Baghdad", // توقيت العراق GMT+3
      ...options,
    });
  } catch (error) {
    console.warn("Error formatting date:", error);
    return "Not specified";
  }
}

/**
 * تنسيق التاريخ فقط بصيغة إنجليزية بتوقيت العراق (GMT+3)
 * @param date التاريخ المراد تنسيقه
 * @param options خيارات التنسيق (اختياري)
 * @returns النص المنسق بتوقيت العراق
 */
export function formatIraqDateEN(
  date: Date | string | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!date) return "Not specified";
  
  try {
    const dateObj = typeof date === "string" ? new Date(date) : date;
    if (isNaN(dateObj.getTime())) return "Not specified";
    
    return dateObj.toLocaleDateString("en-GB", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: "Asia/Baghdad", // توقيت العراق GMT+3
      ...options,
    });
  } catch (error) {
    console.warn("Error formatting date:", error);
    return "Not specified";
  }
}

/**
 * تنسيق الوقت فقط بصيغة إنجليزية بتوقيت العراق (GMT+3)
 * @param date التاريخ المراد تنسيقه
 * @param options خيارات التنسيق (اختياري)
 * @returns النص المنسق بتوقيت العراق
 */
export function formatIraqTimeEN(
  date: Date | string | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!date) return "Not specified";
  
  try {
    const dateObj = typeof date === "string" ? new Date(date) : date;
    if (isNaN(dateObj.getTime())) return "Not specified";
    
    return dateObj.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZone: "Asia/Baghdad", // توقيت العراق GMT+3
      ...options,
    });
  } catch (error) {
    console.warn("Error formatting time:", error);
    return "Not specified";
  }
}
