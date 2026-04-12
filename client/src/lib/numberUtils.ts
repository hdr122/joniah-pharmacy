/**
 * Convert Arabic numerals to English numerals
 */
export function toEnglishNumber(num: number | string): string {
  if (num === null || num === undefined) return '';
  
  const str = num.toString();
  const arabicNumerals = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  const englishNumerals = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
  
  let result = str;
  for (let i = 0; i < arabicNumerals.length; i++) {
    result = result.replace(new RegExp(arabicNumerals[i], 'g'), englishNumerals[i]);
  }
  
  return result;
}

/**
 * Format number with thousand separators (English numerals)
 */
export function formatNumber(num: number | string): string {
  if (num === null || num === undefined) return '0';
  
  const numStr = toEnglishNumber(num);
  const number = typeof numStr === 'string' ? parseFloat(numStr) : numStr;
  
  if (isNaN(number)) return '0';
  
  return number.toLocaleString('en-US');
}

/**
 * Format currency in IQD (English numerals)
 */
export function formatCurrency(amount: number | string): string {
  const formatted = formatNumber(amount);
  return `${formatted} د.ع`;
}
