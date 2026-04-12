import { trpc } from "@/lib/trpc";
import { useMemo, useCallback } from "react";

// قائمة الصلاحيات المتاحة
export const PERMISSIONS = {
  // الطلبات
  VIEW_ORDERS: "view_orders",
  ADD_ORDERS: "add_orders",
  EDIT_ORDERS: "edit_orders",
  DELETE_ORDERS: "delete_orders",
  // المندوبين
  VIEW_DELIVERIES: "view_deliveries",
  MANAGE_DELIVERIES: "manage_deliveries",
  // الزبائن
  VIEW_CUSTOMERS: "view_customers",
  MANAGE_CUSTOMERS: "manage_customers",
  // الإعدادات
  VIEW_SETTINGS: "view_settings",
  MANAGE_SETTINGS: "manage_settings",
  // المستخدمين
  VIEW_USERS: "view_users",
  MANAGE_USERS: "manage_users",
  // الإحصائيات
  VIEW_STATISTICS: "view_statistics",
  // الخرائط
  VIEW_MAPS: "view_maps",
} as const;

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];

export function useCustomAuth() {
  const { data: user, isLoading, error } = trpc.auth.me.useQuery();
  
  // User is authenticated if data is not null/undefined (even if empty object)
  const isAuthenticated = !isLoading && user !== null && user !== undefined;
  
  // تحليل الصلاحيات من JSON
  const userPermissions = useMemo(() => {
    if (!user?.permissions) return [];
    try {
      return JSON.parse(user.permissions) as string[];
    } catch {
      return [];
    }
  }, [user?.permissions]);
  
  // التحقق من صلاحية معينة
  const hasPermission = useCallback((permission: string): boolean => {
    // المالك (owner) لديه جميع الصلاحيات
    if (user?.openId) return true;
    
    // إذا كان لديه صلاحية "all" فلديه جميع الصلاحيات
    if (userPermissions.includes("all")) return true;
    
    // التحقق من الصلاحية المحددة
    return userPermissions.includes(permission);
  }, [user?.openId, userPermissions]);
  
  // التحقق من أي صلاحية من قائمة
  const hasAnyPermission = useCallback((permissions: string[]): boolean => {
    return permissions.some(p => hasPermission(p));
  }, [hasPermission]);
  
  // التحقق من جميع الصلاحيات في قائمة
  const hasAllPermissions = useCallback((permissions: string[]): boolean => {
    return permissions.every(p => hasPermission(p));
  }, [hasPermission]);
  
  return {
    user,
    loading: isLoading,
    error,
    isAuthenticated,
    isAdmin: user?.role === "admin" || user?.role === "superadmin" || user?.role === "super_admin",
    isDelivery: user?.role === "delivery",
    isSuperAdmin: user?.username === "HarthHDR1" || user?.role === "superadmin" || user?.role === "super_admin",
    isOwner: !!user?.openId,
    permissions: userPermissions,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
  };
}
