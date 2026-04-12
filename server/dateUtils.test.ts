import { describe, it, expect } from 'vitest';
import { getCurrentTimeISOInIraq } from './dateUtils';

describe('getCurrentTimeISOInIraq', () => {
  it('should return a valid ISO string', () => {
    const time = getCurrentTimeISOInIraq();
    expect(time).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it('should return UTC time (not shifted)', () => {
    const now = new Date();
    const isoTime = getCurrentTimeISOInIraq();
    const parsedTime = new Date(isoTime);
    
    // The difference should be less than 1 second (allowing for execution time)
    const diff = Math.abs(now.getTime() - parsedTime.getTime());
    expect(diff).toBeLessThan(1000);
  });

  it('should not add 3 hours to the time', () => {
    // Get current UTC hours
    const currentUTCHours = new Date().getUTCHours();
    const isoTime = getCurrentTimeISOInIraq();
    const parsedTime = new Date(isoTime);
    const parsedUTCHours = parsedTime.getUTCHours();
    
    // They should be the same (within 1 hour due to execution time)
    const hourDiff = Math.abs(currentUTCHours - parsedUTCHours);
    expect(hourDiff).toBeLessThanOrEqual(1);
  });

  it('should format time correctly for Iraq timezone display', () => {
    const isoTime = getCurrentTimeISOInIraq();
    const date = new Date(isoTime);
    
    // Format using Iraq timezone
    const iraqTime = date.toLocaleString('ar-IQ', {
      timeZone: 'Asia/Baghdad',
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    
    // Should be a valid time string
    expect(iraqTime).toMatch(/\d{4}\/\d{2}\/\d{2}/);
  });

  it('should display time 3 hours ahead of UTC when formatted for Iraq', () => {
    const isoTime = getCurrentTimeISOInIraq();
    const date = new Date(isoTime);
    
    // Get UTC hours
    const utcHours = date.getUTCHours();
    
    // Format using Iraq timezone and extract hours
    const iraqTimeString = date.toLocaleString('en-US', {
      timeZone: 'Asia/Baghdad',
      hour12: false,
      hour: '2-digit',
      minute: '2-digit'
    });
    
    const iraqHours = parseInt(iraqTimeString.split(':')[0]);
    
    // Iraq time should be UTC + 3 hours
    const expectedHours = (utcHours + 3) % 24;
    expect(iraqHours).toBe(expectedHours);
  });
});
