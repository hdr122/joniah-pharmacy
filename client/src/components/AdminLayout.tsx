import { ReactNode, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  LayoutDashboard,
  Package,
  Users,
  MapPin,
  Globe,
  BarChart3,
  LogOut,
  Pill,
  Menu,
  X,
  Settings,
  PackageOpen,
  Send,
  Map,
  History,
  TrendingUp,
  Trash2,
  UserCircle,
  AlertCircle,
  Calendar,
  Activity,
  FileText,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  ClipboardList,
  UserCog,
  SlidersHorizontal,
  Info,
  Bell,
  Megaphone,
  Palette,
} from "lucide-react";
import { useState } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useCustomAuth, PERMISSIONS } from "@/hooks/useCustomAuth";
import AnnouncementModal from "@/components/AnnouncementModal";


interface AdminLayoutProps {
  children: ReactNode;
}

interface MenuItem {
  icon: any;
  label: string;
  path: string;
  permission?: string | string[]; // الصلاحية المطلوبة
}

interface MenuSection {
  icon: any;
  label: string;
  items: MenuItem[];
  permission?: string | string[]; // الصلاحية المطلوبة للقسم بالكامل
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const [location, setLocation] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, hasPermission, hasAnyPermission, isOwner, isSuperAdmin } = useCustomAuth();
  
  // حالة فتح/إغلاق الأقسام
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    orders: true,
    deliveries: false,
    settings: false,
    maps: false,
    statistics: false,
  });

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      toast.success("تم تسجيل الخروج بنجاح");
      // Use window.location.href to force full page reload and clear React Query cache
      window.location.href = "/login";
    },
  });

  const exitBranchMutation = trpc.branches.exitBranch.useMutation({
    onSuccess: () => {
      toast.success("تم الخروج من الفرع");
      window.location.href = "/admin/super-admin";
    },
  });

  const toggleSection = (sectionKey: string) => {
    setOpenSections(prev => ({
      ...prev,
      [sectionKey]: !prev[sectionKey],
    }));
  };

  // دالة للتحقق من صلاحية عنصر
  const checkItemPermission = (permission?: string | string[]): boolean => {
    if (!permission) return true; // لا يوجد قيد
    if (isOwner) return true; // المالك لديه كل الصلاحيات
    if (Array.isArray(permission)) {
      return hasAnyPermission(permission);
    }
    return hasPermission(permission);
  };

  // تنظيم القائمة بأقسام مع الصلاحيات
  const menuSections: MenuSection[] = [
    // Super Admin section - only visible to HarthHDR1
    ...(isSuperAdmin ? [{
      icon: UserCog,
      label: "إدارة الفروع",
      items: [
        { icon: LayoutDashboard, label: "لوحة Super Admin", path: "/admin/super-admin" },
        { icon: ClipboardList, label: "كودات الاشتراك", path: "/admin/subscription-codes" },
        { icon: PackageOpen, label: "المتجر", path: "/admin/store" },
        { icon: Bell, label: "إدارة التحديثات", path: "/admin/updates-management" },
        { icon: Megaphone, label: "إدارة الإعلانات", path: "/admin/announcements-management" },
        { icon: Palette, label: "إعدادات الموقع", path: "/admin/site-settings" },
        { icon: Bell, label: "إعدادات الإشعارات", path: "/admin/notification-settings" },
        { icon: Bell, label: "اختبار الإشعارات", path: "/admin/test-notifications" },
        { icon: Users, label: "المستخدمون المسجلون", path: "/admin/registered-users" },
        { icon: BarChart3, label: "إحصائيات الإشعارات", path: "/admin/notification-stats" },
        { icon: Trash2, label: "الفروع المحذوفة", path: "/admin/deleted-branches" },
      ],
    }] : []),
    {
      icon: Package,
      label: "الطلبات",
      permission: PERMISSIONS.VIEW_ORDERS,
      items: [
        { icon: Package, label: "الطلبات", path: "/admin/orders", permission: PERMISSIONS.VIEW_ORDERS },
        { icon: PackageOpen, label: "الطلبات المتقدمة", path: "/admin/advanced-orders", permission: PERMISSIONS.VIEW_ORDERS },
        { icon: Trash2, label: "سجل الطلبات المحذوفة", path: "/admin/deleted-orders", permission: PERMISSIONS.DELETE_ORDERS },
        { icon: AlertCircle, label: "الطلبات غير المكتملة", path: "/admin/incomplete-orders", permission: PERMISSIONS.VIEW_ORDERS },
      ],
    },
    {
      icon: Users,
      label: "المندوبين",
      permission: PERMISSIONS.VIEW_DELIVERIES,
      items: [
        { icon: Users, label: "المندوبين", path: "/admin/deliveries", permission: PERMISSIONS.VIEW_DELIVERIES },
        { icon: LayoutDashboard, label: "لوحة تحكم المندوبين", path: "/admin/delivery-dashboard", permission: PERMISSIONS.VIEW_DELIVERIES },
      ],
    },
    {
      icon: Settings,
      label: "الإعدادات",
      permission: PERMISSIONS.VIEW_SETTINGS,
      items: [
        { icon: MapPin, label: "المناطق", path: "/admin/regions", permission: PERMISSIONS.VIEW_SETTINGS },
        { icon: Globe, label: "المحافظات", path: "/admin/provinces", permission: PERMISSIONS.VIEW_SETTINGS },
        { icon: Settings, label: "إدارة المستخدمين", path: "/admin/users", permission: PERMISSIONS.MANAGE_USERS },
        { icon: Send, label: "الرسائل", path: "/admin/messages", permission: PERMISSIONS.VIEW_SETTINGS },
        { icon: ClipboardList, label: "سجل النشاطات", path: "/admin/activity-logs", permission: PERMISSIONS.MANAGE_USERS },
        { icon: UserCog, label: "إحصائيات الموظفين", path: "/admin/employee-stats", permission: PERMISSIONS.MANAGE_USERS },
        { icon: SlidersHorizontal, label: "إعدادات النظام", path: "/admin/system-settings", permission: PERMISSIONS.MANAGE_USERS },
        { icon: Info, label: "حول", path: "/admin/about" },
      ],
    },

    {
      icon: Map,
      label: "الخرائط",
      permission: PERMISSIONS.VIEW_MAPS,
      items: [
        { icon: Map, label: "خريطة تتبع المندوبين", path: "/admin/advanced-tracking", permission: PERMISSIONS.VIEW_MAPS },
        { icon: Activity, label: "إحصائيات Traccar", path: "/admin/traccar-stats", permission: PERMISSIONS.VIEW_MAPS },
        { icon: AlertTriangle, label: "سجل حالة المندوب", path: "/admin/delivery-status-log", permission: PERMISSIONS.VIEW_MAPS },
      ],
    },
    {
      icon: BarChart3,
      label: "الإحصائيات",
      permission: PERMISSIONS.VIEW_STATISTICS,
      items: [
        { icon: BarChart3, label: "الإحصائيات", path: "/admin/statistics", permission: PERMISSIONS.VIEW_STATISTICS },
        { icon: Calendar, label: "الأداء الشهري", path: "/admin/monthly-performance", permission: PERMISSIONS.VIEW_STATISTICS },
        { icon: FileText, label: "تقرير المسافات الشهري", path: "/admin/monthly-distance-report", permission: PERMISSIONS.VIEW_STATISTICS },
      ],
    },
  ];

  // فلترة الأقسام والعناصر حسب الصلاحيات
  const filteredMenuSections = useMemo(() => {
    return menuSections
      .filter(section => checkItemPermission(section.permission))
      .map(section => ({
        ...section,
        items: section.items.filter(item => checkItemPermission(item.permission))
      }))
      .filter(section => section.items.length > 0);
  }, [user?.permissions, isOwner]);

  // عناصر القائمة الرئيسية (خارج الأقسام)
  const mainMenuItems: MenuItem[] = [
    { icon: Bell, label: "التحديثات", path: "/admin/updates" },
    { icon: LayoutDashboard, label: "لوحة التحكم", path: "/admin" },
    { icon: UserCircle, label: "الزبائن", path: "/admin/customers", permission: PERMISSIONS.VIEW_CUSTOMERS },
  ];

  // فلترة العناصر الرئيسية
  const filteredMainMenuItems = useMemo(() => {
    return mainMenuItems.filter(item => checkItemPermission(item.permission));
  }, [user?.permissions, isOwner]);

  return (
    <div className="min-h-screen bg-background" dir="rtl">

      {/* Mobile Header */}
      <div className="lg:hidden bg-card border-b border-border px-4 py-3 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
            <Pill className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-foreground">صيدلية جونيا</h1>
            <p className="text-xs text-muted-foreground">لوحة المدير</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <X /> : <Menu />}
          </Button>
        </div>
      </div>

      {/* Sidebar Overlay (Mobile) */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 right-0 h-full w-64 bg-card border-l border-border transform transition-transform duration-200 ease-in-out z-50 lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg">
                <Pill className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-xl text-foreground">صيدلية جونيا</h1>
                <p className="text-sm text-muted-foreground">لوحة المدير</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
            {/* العناصر الرئيسية */}
            {filteredMainMenuItems.map((item) => {
              const isActive = location === item.path;
              return (
                <Link key={item.path} href={item.path}>
                  <Button
                    variant={isActive ? "default" : "ghost"}
                    className={`w-full justify-start gap-3 ${
                      isActive
                        ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white"
                        : "text-gray-700 hover:bg-gray-100"
                    }`}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <item.icon className="w-5 h-5" />
                    {item.label}
                  </Button>
                </Link>
              );
            })}

            {/* الأقسام المنسدلة */}
            {filteredMenuSections.map((section, idx) => {
              const sectionKey = Object.keys(openSections)[idx] || `section-${idx}`;
              const isOpen = openSections[sectionKey];
              const hasActiveItem = section.items.some(item => location === item.path);

              return (
                <Collapsible
                  key={sectionKey}
                  open={isOpen}
                  onOpenChange={() => toggleSection(sectionKey)}
                >
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      className={`w-full justify-between gap-3 ${
                        hasActiveItem
                          ? "bg-emerald-50 text-emerald-700 font-semibold"
                          : "text-gray-700 hover:bg-gray-100"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <section.icon className="w-5 h-5" />
                        {section.label}
                      </div>
                      {isOpen ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-1 mt-1 mr-4">
                    {section.items.map((item) => {
                      const isActive = location === item.path;
                      return (
                        <Link key={item.path} href={item.path}>
                          <Button
                            variant={isActive ? "default" : "ghost"}
                            size="sm"
                            className={`w-full justify-start gap-3 ${
                              isActive
                                ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white"
                                : "text-gray-600 hover:bg-gray-50"
                            }`}
                            onClick={() => setSidebarOpen(false)}
                          >
                            <item.icon className="w-4 h-4" />
                            {item.label}
                          </Button>
                        </Link>
                      );
                    })}
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </nav>

          {/* User Info & Logout */}
          <div className="p-4 border-t border-border">
            <div className="mb-3 p-3 bg-muted rounded-lg">
              <p className="text-sm font-medium text-foreground">{user?.name || "المدير"}</p>
              <p className="text-xs text-muted-foreground">@{user?.username}</p>
              {isOwner && (
                <p className="text-xs text-emerald-600 font-medium mt-1">المالك</p>
              )}
            </div>
            <div className="mb-3 flex justify-center">
              <ThemeToggle />
            </div>
            {/* زر العودة للوحة السوبر أدمن إذا كان داخل فرع */}
            {isSuperAdmin && user?.branchId && (
              <Button
                variant="outline"
                className="w-full justify-start gap-3 text-amber-600 border-amber-200 hover:bg-amber-50 mb-2"
                onClick={() => exitBranchMutation.mutate()}
                disabled={exitBranchMutation.isPending}
              >
                <UserCog className="w-5 h-5" />
                العودة للوحة الرئيسية
              </Button>
            )}
            <Button
              variant="outline"
              className="w-full justify-start gap-3 text-red-600 border-red-200 hover:bg-red-50"
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
            >
              <LogOut className="w-5 h-5" />
              تسجيل الخروج
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:mr-64 p-4 lg:p-8 min-h-screen">{children}</main>
      
      {/* Announcement Modal */}
      <AnnouncementModal />
      
      {/* Footer */}
      <footer className="lg:mr-64 bg-white border-t border-gray-200 py-4 px-8 text-center">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <p className="text-sm text-gray-600">
            جميع الحقوق محفوظة لـ <span className="font-bold text-emerald-600">HarthHDR</span> © {new Date().getFullYear()}
          </p>
          <div className="hidden sm:block w-px h-4 bg-gray-300"></div>
          <p className="text-sm text-emerald-600 font-medium flex items-center gap-2">
            <span>🕐</span>
            <span>Baghdad Time (GMT+3)</span>
          </p>
        </div>
      </footer>
    </div>
  );
}
