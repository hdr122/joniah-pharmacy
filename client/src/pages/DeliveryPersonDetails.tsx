import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Package,
  CheckCircle,
  DollarSign,
  Clock,
  TrendingUp,
  Activity,
  Phone,
  User,
  TrendingDown,
  Minus,
  MapPin,
  Eye,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useState, useMemo } from "react";
import { formatIraqDateEN } from "@/lib/dateUtils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

export default function DeliveryPersonDetails() {
  const params = useParams();
  const [, navigate] = useLocation();
  const deliveryPersonId = parseInt(params.id || "0");

  // Filters
  const [dateFilter, setDateFilter] = useState<string>("today");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [customStartDate, setCustomStartDate] = useState<Date>();
  const [customEndDate, setCustomEndDate] = useState<Date>();
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [showOrderDetails, setShowOrderDetails] = useState(false);
  const [showRouteMap, setShowRouteMap] = useState(false);

  // Fetch delivery person details with comparisons
  const { data: detailsData, isLoading: detailsLoading } = trpc.deliveryPerformance.detailsWithComparisons.useQuery({
    deliveryPersonId,
    startDate: dateFilter === 'custom' && customStartDate ? customStartDate : undefined,
    endDate: dateFilter === 'custom' && customEndDate ? customEndDate : undefined,
  });

  // Calculate date range based on filter
  const dateRange = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(5, 0, 0, 0);
    if (now.getHours() < 5) {
      todayStart.setDate(todayStart.getDate() - 1);
    }

    switch (dateFilter) {
      case "today":
        return { startDate: todayStart, endDate: new Date() };
      case "yesterday": {
        const yesterdayStart = new Date(todayStart);
        yesterdayStart.setDate(yesterdayStart.getDate() - 1);
        const yesterdayEnd = new Date(todayStart);
        return { startDate: yesterdayStart, endDate: yesterdayEnd };
      }
      case "thisWeek": {
        const weekStart = new Date(todayStart);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        return { startDate: weekStart, endDate: new Date() };
      }
      case "thisMonth": {
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        return { startDate: monthStart, endDate: new Date() };
      }
      case "custom":
        if (customStartDate && customEndDate) {
          return { startDate: customStartDate, endDate: customEndDate };
        }
        return { startDate: todayStart, endDate: new Date() };
      default:
        return { startDate: todayStart, endDate: new Date() };
    }
  }, [dateFilter, customStartDate, customEndDate]);

  // Fetch filtered orders
  const { data: ordersData, isLoading: ordersLoading } = trpc.deliveryPerformance.orders.useQuery({
    deliveryPersonId,
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
  });

  // Filter orders based on status - MUST be before any conditional returns
  const filteredOrders = useMemo(() => {
    if (!ordersData) return [];
    if (statusFilter === "all") return ordersData;
    return ordersData.filter((order: any) => order.status === statusFilter);
  }, [ordersData, statusFilter]);

  if (detailsLoading) {
    return (
      <div className="container py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">جاري التحميل...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!detailsData) {
    return (
      <div className="container py-8">
        <div className="text-center">
          <p className="text-muted-foreground">لم يتم العثور على المندوب</p>
          <Button onClick={() => navigate("/admin/delivery-dashboard")} className="mt-4">
            <ArrowLeft className="ml-2 h-4 w-4" />
            العودة
          </Button>
        </div>
      </div>
    );
  }

  const { delivery, stats } = detailsData;

  // Calculate percentage changes
  const ordersChange = stats.yesterday.totalOrders > 0
    ? ((stats.today.totalOrders - stats.yesterday.totalOrders) / stats.yesterday.totalOrders) * 100
    : 0;

  const profitChange = stats.yesterday.profit > 0
    ? ((stats.today.profit - stats.yesterday.profit) / stats.yesterday.profit) * 100
    : 0;

  const monthOrdersChange = stats.previousMonth.totalOrders > 0
    ? ((stats.currentMonth.totalOrders - stats.previousMonth.totalOrders) / stats.previousMonth.totalOrders) * 100
    : 0;

  const monthProfitChange = stats.previousMonth.profit > 0
    ? ((stats.currentMonth.profit - stats.previousMonth.profit) / stats.previousMonth.profit) * 100
    : 0;

  // Prepare chart data
  const statusChartData = [
    { name: "مسلمة", value: stats.allTime.delivered, color: "#10b981" },
    { name: "مرجوعة", value: stats.allTime.returned, color: "#ef4444" },
    { name: "مؤجلة", value: stats.allTime.postponed, color: "#f59e0b" },
    { name: "ملغية", value: stats.allTime.cancelled, color: "#6b7280" },
  ];

  const comparisonChartData = [
    {
      name: "اليوم",
      الطلبات: stats.today.totalOrders,
      المسلمة: stats.today.delivered,
      الأرباح: stats.today.profit,
    },
    {
      name: "أمس",
      الطلبات: stats.yesterday.totalOrders,
      المسلمة: stats.yesterday.delivered,
      الأرباح: stats.yesterday.profit,
    },
  ];

  const monthComparisonData = [
    {
      name: "الشهر الحالي",
      الطلبات: stats.currentMonth.totalOrders,
      المسلمة: stats.currentMonth.delivered,
      الأرباح: stats.currentMonth.profit,
    },
    {
      name: "الشهر السابق",
      الطلبات: stats.previousMonth.totalOrders,
      المسلمة: stats.previousMonth.delivered,
      الأرباح: stats.previousMonth.profit,
    },
  ];

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      pending: { label: "انتظار", variant: "secondary" },
      in_progress: { label: "قيد التسليم", variant: "default" },
      delivered: { label: "مسلمة", variant: "outline" },
      returned: { label: "مرجوعة", variant: "destructive" },
      postponed: { label: "مؤجلة", variant: "secondary" },
      cancelled: { label: "ملغية", variant: "outline" },
    };

    const config = statusConfig[status] || { label: status, variant: "outline" as const };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const formatDeliveryTime = (minutes: number | null) => {
    if (!minutes) return "-";
    if (minutes < 60) {
      return `${minutes} دقيقة`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours} ساعة ${mins > 0 ? `و ${mins} دقيقة` : ""}`;
  };

  const getTimeColor = (minutes: number | null) => {
    if (!minutes) return "text-muted-foreground";
    if (minutes <= 30) return "text-green-600";
    if (minutes <= 60) return "text-yellow-600";
    return "text-red-600";
  };

  return (
    <div className="container py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/admin/delivery-dashboard")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              تفاصيل المندوب
            </h1>
            <p className="text-muted-foreground">عرض شامل لأداء وطلبات المندوب</p>
          </div>
        </div>
      </div>

      {/* Delivery Person Info Card */}
      <Card className="border-2 shadow-lg">
        <CardContent className="pt-6">
          <div className="flex items-center gap-6">
            <Avatar className="h-24 w-24 border-4 border-primary/20">
              <AvatarImage src={delivery.profileImage || ""} />
              <AvatarFallback className="text-2xl bg-gradient-to-br from-blue-500 to-purple-500 text-white">
                {delivery.name?.charAt(0) || "م"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold">{delivery.name || "غير محدد"}</h2>
                <Badge variant={delivery.isActive ? "default" : "secondary"} className="text-sm">
                  {delivery.isActive ? "نشط" : "غير نشط"}
                </Badge>
              </div>
              <div className="flex items-center gap-6 text-muted-foreground">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  <span>{delivery.username}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  <span dir="ltr">{delivery.phone || "غير محدد"}</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-2 shadow-md hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">إجمالي الطلبات</CardTitle>
            <Package className="h-5 w-5 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-700">{stats.allTime.totalOrders}</div>
            <p className="text-xs text-muted-foreground mt-1">جميع الطلبات</p>
          </CardContent>
        </Card>

        <Card className="border-2 shadow-md hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">الطلبات المسلمة</CardTitle>
            <CheckCircle className="h-5 w-5 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-700">{stats.allTime.delivered}</div>
            <p className="text-xs text-muted-foreground mt-1">
              معدل النجاح: {stats.allTime.successRate}%
            </p>
          </CardContent>
        </Card>

        <Card className="border-2 shadow-md hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">إجمالي الأرباح</CardTitle>
            <DollarSign className="h-5 w-5 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-700">
              {stats.allTime.profit.toLocaleString()} IQD
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              متوسط: {stats.allTime.avgProfitPerOrder.toLocaleString()} IQD/طلب
            </p>
          </CardContent>
        </Card>

        <Card className="border-2 shadow-md hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">متوسط السرعة</CardTitle>
            <Clock className="h-5 w-5 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-700">
              {stats.today.avgDeliveryMinutes}
            </div>
            <p className="text-xs text-muted-foreground mt-1">دقيقة (اليوم)</p>
          </CardContent>
        </Card>

        <Card className="border-2 shadow-md hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-950 dark:to-yellow-900">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">طلبات نشطة</CardTitle>
            <Activity className="h-5 w-5 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-yellow-700">{stats.allTime.active}</div>
            <p className="text-xs text-muted-foreground mt-1">قيد التنفيذ</p>
          </CardContent>
        </Card>

        <Card className="border-2 shadow-md hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950 dark:to-red-900">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">طلبات مرجوعة</CardTitle>
            <TrendingDown className="h-5 w-5 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-700">{stats.allTime.returned}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.allTime.totalOrders > 0
                ? `${Math.round((stats.allTime.returned / stats.allTime.totalOrders) * 100)}%`
                : "0%"}
            </p>
          </CardContent>
        </Card>

        <Card className="border-2 shadow-md hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950 dark:to-amber-900">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">طلبات مؤجلة</CardTitle>
            <Clock className="h-5 w-5 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-700">{stats.allTime.postponed}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.allTime.totalOrders > 0
                ? `${Math.round((stats.allTime.postponed / stats.allTime.totalOrders) * 100)}%`
                : "0%"}
            </p>
          </CardContent>
        </Card>

        <Card className="border-2 shadow-md hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-950 dark:to-gray-900">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">طلبات ملغية</CardTitle>
            <Minus className="h-5 w-5 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-700">{stats.allTime.cancelled}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.allTime.totalOrders > 0
                ? `${Math.round((stats.allTime.cancelled / stats.allTime.totalOrders) * 100)}%`
                : "0%"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Comparisons Section */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Today vs Yesterday */}
        <Card className="border-2 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              مقارنة اليوم مع أمس
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">الطلبات</span>
                <div className="flex items-center gap-2">
                  <span className="font-bold">{stats.today.totalOrders}</span>
                  <span className="text-muted-foreground">vs</span>
                  <span className="font-bold">{stats.yesterday.totalOrders}</span>
                  {ordersChange !== 0 && (
                    <Badge
                      variant={ordersChange > 0 ? "default" : "destructive"}
                      className="text-xs"
                    >
                      {ordersChange > 0 ? "+" : ""}
                      {ordersChange.toFixed(1)}%
                    </Badge>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">المسلمة</span>
                <div className="flex items-center gap-2">
                  <span className="font-bold">{stats.today.delivered}</span>
                  <span className="text-muted-foreground">vs</span>
                  <span className="font-bold">{stats.yesterday.delivered}</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">الأرباح</span>
                <div className="flex items-center gap-2">
                  <span className="font-bold">{stats.today.profit.toLocaleString()} IQD</span>
                  <span className="text-muted-foreground">vs</span>
                  <span className="font-bold">{stats.yesterday.profit.toLocaleString()} IQD</span>
                  {profitChange !== 0 && (
                    <Badge
                      variant={profitChange > 0 ? "default" : "destructive"}
                      className="text-xs"
                    >
                      {profitChange > 0 ? "+" : ""}
                      {profitChange.toFixed(1)}%
                    </Badge>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">متوسط وقت التسليم</span>
                <div className="flex items-center gap-2">
                  <span className="font-bold">{stats.today.avgDeliveryMinutes || 0} د</span>
                  <span className="text-muted-foreground">vs</span>
                  <span className="font-bold">{stats.yesterday.avgDeliveryMinutes || 0} د</span>
                  {stats.today.avgDeliveryMinutes && stats.yesterday.avgDeliveryMinutes && stats.yesterday.avgDeliveryMinutes > 0 && (
                    <Badge
                      variant={stats.today.avgDeliveryMinutes < stats.yesterday.avgDeliveryMinutes ? "default" : "destructive"}
                      className="text-xs"
                    >
                      {stats.today.avgDeliveryMinutes < stats.yesterday.avgDeliveryMinutes ? "أسرع" : "أبطأ"}
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={comparisonChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="الطلبات" fill="#3b82f6" />
                <Bar dataKey="المسلمة" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Current Month vs Previous Month */}
        <Card className="border-2 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-purple-600" />
              مقارنة الشهر الحالي مع السابق
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">الطلبات</span>
                <div className="flex items-center gap-2">
                  <span className="font-bold">{stats.currentMonth.totalOrders}</span>
                  <span className="text-muted-foreground">vs</span>
                  <span className="font-bold">{stats.previousMonth.totalOrders}</span>
                  {monthOrdersChange !== 0 && (
                    <Badge
                      variant={monthOrdersChange > 0 ? "default" : "destructive"}
                      className="text-xs"
                    >
                      {monthOrdersChange > 0 ? "+" : ""}
                      {monthOrdersChange.toFixed(1)}%
                    </Badge>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">المسلمة</span>
                <div className="flex items-center gap-2">
                  <span className="font-bold">{stats.currentMonth.delivered}</span>
                  <span className="text-muted-foreground">vs</span>
                  <span className="font-bold">{stats.previousMonth.delivered}</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">الأرباح</span>
                <div className="flex items-center gap-2">
                  <span className="font-bold">{stats.currentMonth.profit.toLocaleString()} IQD</span>
                  <span className="text-muted-foreground">vs</span>
                  <span className="font-bold">{stats.previousMonth.profit.toLocaleString()} IQD</span>
                  {monthProfitChange !== 0 && (
                    <Badge
                      variant={monthProfitChange > 0 ? "default" : "destructive"}
                      className="text-xs"
                    >
                      {monthProfitChange > 0 ? "+" : ""}
                      {monthProfitChange.toFixed(1)}%
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={monthComparisonData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="الطلبات" fill="#8b5cf6" />
                <Bar dataKey="المسلمة" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Custom Period Stats (if filter is custom) */}
      {dateFilter === 'custom' && customStartDate && customEndDate && stats.customPeriod && (
        <Card className="border-2 shadow-lg bg-gradient-to-br from-teal-50 to-cyan-100 dark:from-teal-950 dark:to-cyan-900">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-teal-600" />
              إحصائيات الفترة المخصصة
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              من {format(customStartDate, 'PPP', { locale: ar })} إلى {format(customEndDate, 'PPP', { locale: ar })}
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-teal-700">{stats.customPeriod.totalOrders}</div>
                <p className="text-xs text-muted-foreground">إجمالي الطلبات</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-700">{stats.customPeriod.delivered}</div>
                <p className="text-xs text-muted-foreground">المسلمة</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-700">{stats.customPeriod.profit.toLocaleString()} IQD</div>
                <p className="text-xs text-muted-foreground">الأرباح</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-700">{stats.customPeriod.avgDeliveryMinutes} د</div>
                <p className="text-xs text-muted-foreground">متوسط وقت التسليم</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-700">
                  {stats.customPeriod.totalOrders > 0 
                    ? `${Math.round((stats.customPeriod.delivered / stats.customPeriod.totalOrders) * 100)}%`
                    : '0%'
                  }
                </div>
                <p className="text-xs text-muted-foreground">معدل النجاح</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Status Distribution Chart */}
      <Card className="border-2 shadow-lg">
        <CardHeader>
          <CardTitle>توزيع حالات الطلبات</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={statusChartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(entry) => `${entry.name}: ${entry.value}`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {statusChartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Orders List with Filters */}
      <Card className="border-2 shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <CardTitle>قائمة الطلبات</CardTitle>
            <div className="flex items-center gap-3 flex-wrap">
              {/* Date Filter */}
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="اختر الفترة" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">اليوم</SelectItem>
                  <SelectItem value="yesterday">أمس</SelectItem>
                  <SelectItem value="thisWeek">هذا الأسبوع</SelectItem>
                  <SelectItem value="thisMonth">هذا الشهر</SelectItem>
                  <SelectItem value="custom">فترة مخصصة</SelectItem>
                </SelectContent>
              </Select>

              {/* Custom Date Range */}
              {dateFilter === "custom" && (
                <div className="flex items-center gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-[140px] justify-start text-left font-normal", !customStartDate && "text-muted-foreground")}>
                        {customStartDate ? format(customStartDate, "PPP", { locale: ar }) : "من تاريخ"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar mode="single" selected={customStartDate} onSelect={setCustomStartDate} initialFocus />
                    </PopoverContent>
                  </Popover>

                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-[140px] justify-start text-left font-normal", !customEndDate && "text-muted-foreground")}>
                        {customEndDate ? format(customEndDate, "PPP", { locale: ar }) : "إلى تاريخ"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar mode="single" selected={customEndDate} onSelect={setCustomEndDate} initialFocus />
                    </PopoverContent>
                  </Popover>
                </div>
              )}

              {/* Status Filter */}
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="الحالة" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الحالات</SelectItem>
                  <SelectItem value="pending">انتظار</SelectItem>
                  <SelectItem value="in_progress">قيد التسليم</SelectItem>
                  <SelectItem value="delivered">مسلمة</SelectItem>
                  <SelectItem value="returned">مرجوعة</SelectItem>
                  <SelectItem value="postponed">مؤجلة</SelectItem>
                  <SelectItem value="cancelled">ملغية</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {ordersLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              لا توجد طلبات في الفترة المحددة
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-right p-3 font-semibold">رقم الطلب</th>
                    <th className="text-right p-3 font-semibold">الزبون</th>
                    <th className="text-right p-3 font-semibold">المنطقة</th>
                    <th className="text-right p-3 font-semibold">الحالة</th>
                    <th className="text-right p-3 font-semibold">المبلغ</th>
                    <th className="text-right p-3 font-semibold">الربح</th>
                    <th className="text-right p-3 font-semibold">م.التسليم</th>
                    <th className="text-right p-3 font-semibold">دقائق كلية</th>
                    <th className="text-right p-3 font-semibold">التاريخ</th>
                    <th className="text-right p-3 font-semibold">الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((order: any) => (
                    <tr key={order.id} className="border-b hover:bg-muted/50 transition-colors">
                      <td className="p-3 font-mono">{order.id}</td>
                      <td className="p-3">{order.customerName}</td>
                      <td className="p-3">{order.regionName || "-"}</td>
                      <td className="p-3">{getStatusBadge(order.status)}</td>
                      <td className="p-3 font-semibold" dir="ltr">
                        {Number(order.price || 0).toLocaleString()} IQD
                      </td>
                      <td className="p-3 font-semibold text-green-600" dir="ltr">
                        {order.status === 'delivered' ? Number(order.price || 0).toLocaleString() : '0'} IQD
                      </td>
                      <td className={cn("p-3 font-semibold", getTimeColor(order.deliveryMinutes))}>
                        {formatDeliveryTime(order.deliveryMinutes)}
                      </td>
                      <td className={cn("p-3 font-semibold", getTimeColor(order.totalMinutes))}>
                        {formatDeliveryTime(order.totalMinutes)}
                      </td>
                      <td className="p-3 text-sm text-muted-foreground" dir="ltr">
                        {formatIraqDateEN(order.createdAt)}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedOrder(order);
                              setShowOrderDetails(true);
                            }}
                            title="عرض التفاصيل"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedOrder(order);
                              setShowRouteMap(true);
                            }}
                            title="عرض المسار"
                          >
                            <MapPin className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Order Details Dialog */}
      <Dialog open={showOrderDetails} onOpenChange={setShowOrderDetails}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>تفاصيل الطلب #{selectedOrder?.id}</span>
              <Button variant="ghost" size="icon" onClick={() => setShowOrderDetails(false)}>
                <X className="h-4 w-4" />
              </Button>
            </DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-6">
              {/* Customer Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">معلومات الزبون</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">الاسم:</span>
                    <span className="font-semibold">{selectedOrder.customerName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">رقم الهاتف:</span>
                    <span className="font-semibold" dir="ltr">{selectedOrder.customerPhone1}</span>
                  </div>
                  {selectedOrder.customerPhone2 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">رقم هاتف بديل:</span>
                      <span className="font-semibold" dir="ltr">{selectedOrder.customerPhone2}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">العنوان:</span>
                    <span className="font-semibold">{selectedOrder.customerAddress1}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">المنطقة:</span>
                    <span className="font-semibold">{selectedOrder.area?.name || "-"}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Order Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">معلومات الطلب</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">رقم الطلب:</span>
                    <span className="font-semibold font-mono">{selectedOrder.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">الحالة:</span>
                    {getStatusBadge(selectedOrder.status)}
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">المبلغ:</span>
                    <span className="font-semibold" dir="ltr">{Number(selectedOrder.totalAmount || 0).toLocaleString()} IQD</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">رسوم التوصيل:</span>
                    <span className="font-semibold text-green-600" dir="ltr">{Number(selectedOrder.deliveryFee || 0).toLocaleString()} IQD</span>
                  </div>
                  {selectedOrder.note && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">ملاحظة:</span>
                      <span className="font-semibold">{selectedOrder.note}</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Timeline */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">الجدول الزمني</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                    <div className="flex-1">
                      <p className="font-semibold">إنشاء الطلب</p>
                      <p className="text-sm text-muted-foreground" dir="ltr">
                        {formatIraqDateEN(selectedOrder.createdAt)}
                      </p>
                    </div>
                  </div>
                  {selectedOrder.acceptedAt && (
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                      <div className="flex-1">
                        <p className="font-semibold">قبول الطلب</p>
                        <p className="text-sm text-muted-foreground" dir="ltr">
                        {formatIraqDateEN(selectedOrder.acceptedAt)}
                        </p>
                      </div>
                    </div>
                  )}
                  {selectedOrder.deliveredAt && (
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-green-500"></div>
                      <div className="flex-1">
                        <p className="font-semibold">تسليم الطلب</p>
                        <p className="text-sm text-muted-foreground" dir="ltr">
                        {formatIraqDateEN(selectedOrder.deliveredAt)}
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Route Map Dialog */}
      <Dialog open={showRouteMap} onOpenChange={setShowRouteMap}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>مسار الطلب #{selectedOrder?.id}</span>
              <Button variant="ghost" size="icon" onClick={() => setShowRouteMap(false)}>
                <X className="h-4 w-4" />
              </Button>
            </DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">رقم الطلب:</span>
                      <span className="font-semibold font-mono">{selectedOrder.id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">الزبون:</span>
                      <span className="font-semibold">{selectedOrder.customerName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">العنوان:</span>
                      <span className="font-semibold">{selectedOrder.customerAddress1}</span>
                    </div>
                    {selectedOrder.locationLink && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">رابط الموقع:</span>
                        <a
                          href={selectedOrder.locationLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          فتح في Google Maps
                        </a>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
              <div className="bg-muted/50 rounded-lg p-8 text-center">
                <MapPin className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">
                  يمكنك عرض الموقع على الخريطة باستخدام رابط الموقع أعلاه
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
