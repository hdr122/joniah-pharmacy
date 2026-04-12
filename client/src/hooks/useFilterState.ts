import { useState, useEffect, useCallback } from 'react';

/**
 * Hook لحفظ واسترجاع حالة الفلاتر من localStorage
 * @param key مفتاح التخزين
 * @param defaultValue القيمة الافتراضية
 */
export function useFilterState<T>(key: string, defaultValue: T): [T, (value: T) => void, () => void] {
  const storageKey = `filter_state_${key}`;
  
  // استرجاع القيمة من localStorage أو استخدام القيمة الافتراضية
  const [state, setState] = useState<T>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (error) {
      console.warn(`Error reading filter state for ${key}:`, error);
    }
    return defaultValue;
  });

  // حفظ القيمة في localStorage عند التغيير
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch (error) {
      console.warn(`Error saving filter state for ${key}:`, error);
    }
  }, [state, storageKey]);

  // دالة لإعادة تعيين الفلتر للقيمة الافتراضية
  const resetState = useCallback(() => {
    setState(defaultValue);
    try {
      localStorage.removeItem(storageKey);
    } catch (error) {
      console.warn(`Error removing filter state for ${key}:`, error);
    }
  }, [defaultValue, storageKey]);

  return [state, setState, resetState];
}

/**
 * Hook لحفظ حالة الفلاتر المتعددة
 */
export function useMultiFilterState<T extends Record<string, any>>(
  pageKey: string,
  defaultFilters: T
): {
  filters: T;
  setFilter: <K extends keyof T>(key: K, value: T[K]) => void;
  setFilters: (filters: Partial<T>) => void;
  resetFilters: () => void;
} {
  const storageKey = `multi_filter_state_${pageKey}`;
  
  const [filters, setFiltersState] = useState<T>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        return { ...defaultFilters, ...JSON.parse(saved) };
      }
    } catch (error) {
      console.warn(`Error reading multi filter state for ${pageKey}:`, error);
    }
    return defaultFilters;
  });

  // حفظ القيمة في localStorage عند التغيير
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(filters));
    } catch (error) {
      console.warn(`Error saving multi filter state for ${pageKey}:`, error);
    }
  }, [filters, storageKey]);

  const setFilter = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setFiltersState(prev => ({ ...prev, [key]: value }));
  }, []);

  const setFilters = useCallback((newFilters: Partial<T>) => {
    setFiltersState(prev => ({ ...prev, ...newFilters }));
  }, []);

  const resetFilters = useCallback(() => {
    setFiltersState(defaultFilters);
    try {
      localStorage.removeItem(storageKey);
    } catch (error) {
      console.warn(`Error removing multi filter state for ${pageKey}:`, error);
    }
  }, [defaultFilters, storageKey]);

  return { filters, setFilter, setFilters, resetFilters };
}
