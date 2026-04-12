import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Loader2, Package, Eye, Edit, Calendar, Filter, X, User, FileDown, MapPin, Clock, Trash2, RotateCcw, CheckCircle, XCircle, Image as ImageIcon, Zap, Search, Download, RefreshCw, Phone, Home, Route } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { formatNumber, formatCurrency } from "@/lib/numberUtils";
import { getDayBounds, getSpecificDayBounds, getMonths, getDaysInMonth, formatIraqDateEN } from "@/lib/dateUtils";
import { DateFilterDropdown, DateFilterValue } from "@/components/DateFilterDropdown";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import SimpleOrderForm from "@/components/SimpleOrderForm";
import EditOrderDialog from "@/components/EditOrderDialog";
import OrderRouteMap from "@/components/OrderRouteMap";

export default function Orders() {
  const [, setLocation] = useLocation();
  const [viewOrder, setViewOrder] = useState<any>(null);
  const [editOrder, setEditOrder] = useState<any>(null);
  
  // Initialize date filter with today's date (5 AM to 4:59 AM next day)
  const [dateFilter, setDateFilter] = useState<DateFilterValue>(() => {
    // Try to load from localStorage first
    const savedFilter = localStorage.getItem('orders-date-filter');
    if (savedFilter) {
      try {
        return JSON.parse(savedFilter);
      } catch (e) {
        console.error('Failed to parse saved filter:', e);
      }
    }
    
    // Default to today - day starts at 5 AM
    const now = new Date();
    const start = new Date(now);
    
    // إذا كان الوقت الحالي قبل 5 فجراً، فاليوم يبدأ من أمس الساعة 5 فجراً
    if (now.getHours() < 5) {
      start.setDate(start.getDate() - 1);
    }
    start.setHours(5, 0, 0, 0);
    
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    end.setHours(4, 59, 59, 999);
    
    return {
      type: 'today',
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      label: 'اليوم'
    };
  });
  
  // Save filter to localStorage whenever it changes
  useEffect(() => {
    if (dateFilter) {
      localStorage.setItem('orders-date-filter', JSON.stringify(dateFilter));
    }
  }, [dateFilter]);
  
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportStartDate, setExportStartDate] = useState<string>('');
  const [exportEndDate, setExportEndDate] = useState<string>('');
  const [exportDeliveryPersons, setExportDeliveryPersons] = useState<number[]>([]);
  const [exportStatuses, setExportStatuses] = useState<string[]>([]);
  const [exportRegions, setExportRegions] = useState<number[]>([]);
  
  // حالات من الطلبات المتقدمة
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [selectedImageOrder, setSelectedImageOrder] = useState<any>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<any>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [orderDetails, setOrderDetails] = useState<any>(null);
  const [routeMapOpen, setRouteMapOpen] = useState(false);
  const [routeMapOrder, setRouteMapOrder] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("all");
  const [simpleOrderFormOpen, setSimpleOrderFormOpen] = useState(false);
  
  // Pagination state - عرض 500 طلب كحد أقصى
  const [displayedOrdersCount, setDisplayedOrdersCount] = useState(500);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  
  // Export function
  const handleExportToExcel = async () => {
    try {
      toast.info('جاري تصدير البيانات...');
      
      const params = new URLSearchParams();
      if (exportStartDate) params.append('startDate', exportStartDate);
      if (exportEndDate) params.append('endDate', exportEndDate);
      if (exportDeliveryPersons.length > 0) {
        params.append('deliveryPersonIds', JSON.stringify(exportDeliveryPersons));
      }
      if (exportStatuses.length > 0) {
        params.append('statuses', JSON.stringify(exportStatuses));
      }
      if (exportRegions.length > 0) {
        params.append('regionIds', JSON.stringify(exportRegions));
      }
      
      const url = `/api/orders/export?${params.toString()}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error('Failed to export');
      }
      
      const blob = await response.blob();
      
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `orders_${Date.now()}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
      
      toast.success('تم تصدير البيانات بنجاح');
      setExportDialogOpen(false);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('فشل تصدير البيانات');
    }
  };
  
  // Advanced filters
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedDeliveryPerson, setSelectedDeliveryPerson] = useState<string>('all');
  const [selectedRegion, setSelectedRegion] = useState<string>('all');
  const [phoneSearch, setPhoneSearch] = useState<string>('');
  
  const { data: deliveryPersons } = trpc.users.getDeliveryPersons.useQuery();
  const { data: regions } = trpc.regions.list.useQuery();
  const { data: users } = trpc.users.list.useQuery();
  
  // Build API query with filters
  const apiFilters = {
    limit: displayedOrdersCount,
    offset: 0,
    startDate: dateFilter?.startDate,
    endDate: dateFilter?.endDate,
    statuses: selectedStatuses.length > 0 ? selectedStatuses : undefined,
    deliveryPersonId: selectedDeliveryPerson !== 'all' ? parseInt(selectedDeliveryPerson) : undefined,
    regionId: selectedRegion !== 'all' ? parseInt(selectedRegion) : undefined,
  };
  
  const { data: orders, isLoading } = trpc.orders.list.useQuery(apiFilters);
  const { data: totalOrdersCount } = trpc.orders.count.useQuery();
  const utils = trpc.useUtils();
  
  // Load more orders handler - تحميل 500 طلب إضافي
  const handleLoadMore = () => {
    setIsLoadingMore(true);
    setDisplayedOrdersCount(prev => prev + 500);
    setTimeout(() => setIsLoadingMore(false), 500);
  };
  
  // Mutations
  const deleteOrderMutation = trpc.orders.deleteOrder.useMutation({
    onSuccess: () => {
      toast.success("تم حذف الطلب بنجاح");
      setDeleteDialogOpen(false);
      setOrderToDelete(null);
      utils.orders.list.invalidate();
    },
    onError: (error: any) => {
      toast.error(error.message || "فشل حذف الطلب");
    },
  });
  
  const reactivateOrderMutation = trpc.orders.reactivatePostponedOrder.useMutation({
    onSuccess: () => {
      toast.success("تم استعادة الطلب بنجاح - الطلب في انتظار قبول المندوب");
      utils.orders.list.invalidate();
    },
    onError: (error: any) => {
      toast.error(error.message || "فشل استعادة الطلب");
    },
  });

  // Filter orders based on phone search only (other filters are handled by API)
  const filteredOrders = orders?.filter((order: any) => {
    // Phone search filter
    if (phoneSearch.trim()) {
      const searchTerm = phoneSearch.trim();
      if (!order.customerPhone?.includes(searchTerm)) {
        return false;
      }
    }
    
    return true;
  }) || [];
  
  // Filter by tab
  const getOrdersByTab = (tab: string) => {
    if (tab === 'all') return filteredOrders;
    if (tab === 'pending_approval') return filteredOrders.filter((o: any) => o.status === 'pending_approval');
    if (tab === 'pending') return filteredOrders.filter((o: any) => o.status === 'pending');
    if (tab === 'delivered') return filteredOrders.filter((o: any) => o.status === 'delivered');
    if (tab === 'postponed') return filteredOrders.filter((o: any) => o.status === 'postponed');
    if (tab === 'returned') return filteredOrders.filter((o: any) => o.status === 'returned');
    if (tab === 'cancelled') return filteredOrders.filter((o: any) => o.status === 'cancelled');
    return filteredOrders;
  };
  
  const displayedOrders = getOrdersByTab(activeTab);
  const hasMoreOrders = totalOrdersCount && displayedOrdersCount < totalOrdersCount;
  
  // Count active filters
  const activeFiltersCount = 
    selectedStatuses.length + 
    (selectedDeliveryPerson !== 'all' ? 1 : 0) + 
    (selectedRegion !== 'all' ? 1 : 0) +
    (phoneSearch.trim() ? 1 : 0);
  
  // Clear all filters
  const clearAllFilters = () => {
    setSelectedStatuses([]);
    setSelectedDeliveryPerson('all');
    setSelectedRegion('all');
    setPhoneSearch('');
  };

  const getUserName = (userId: number) => {
    const user = users?.find((u: any) => u.id === userId);
    return user?.name || "غير معروف";
  };



  // دالة لعرض المدة بشكل جميل (تستخدم القيم من قاعدة البيانات)
  const getDurationBadge = (durationMinutes: number | null | undefined, type: 'delivery' | 'total' = 'delivery') => {
    if (durationMinutes === null || durationMinutes === undefined) return <span className="text-muted-foreground text-sm">—</span>;
    
    // معالجة الأرقام السالبة
    if (durationMinutes < 0) return <span className="text-muted-foreground text-sm">—</span>;
    
    if (durationMinutes === 0) return <span className="text-green-600 dark:text-green-400 text-sm">✓أقل من دقيقة</span>;
    
    const hours = Math.floor(Math.abs(durationMinutes) / 60);
    const minutes = Math.abs(durationMinutes) % 60;
    
    let colorClass = "bg-gradient-to-r from-green-500 to-emerald-500 text-white";
    let icon = "✓";
    
    if (durationMinutes > 240) {
      colorClass = "bg-gradient-to-r from-red-500 to-rose-500 text-white";
      icon = "⚠";
    } else if (durationMinutes > 120) {
      colorClass = "bg-gradient-to-r from-yellow-500 to-amber-500 text-white";
      icon = "⏱";
    }
    
    // تنسيق الوقت بشكل جميل
    let timeText = '';
    if (hours > 0) {
      timeText = `${formatNumber(hours)} ساعة`;
      if (minutes > 0) {
        timeText += ` ${formatNumber(minutes)} دقيقة`;
      }
    } else {
      timeText = `${formatNumber(minutes)} دقيقة`;
    }
    
    return (
      <Badge className={`${colorClass} px-3 py-1 font-medium shadow-sm`}>
        <span className="mr-1">{icon}</span>
        {timeText}
      </Badge>
    );
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; className: string; icon: any }> = {
      pending_approval: { 
        label: "انتظار الموافقة", 
        className: "bg-gradient-to-r from-blue-500 to-cyan-500 text-white",
        icon: <Clock className="w-3 h-3" />
      },
      pending: { 
        label: "قيد التسليم", 
        className: "bg-gradient-to-r from-amber-500 to-orange-500 text-white",
        icon: <Package className="w-3 h-3" />
      },
      delivered: { 
        label: "تم التسليم", 
        className: "bg-gradient-to-r from-green-500 to-emerald-500 text-white",
        icon: <CheckCircle className="w-3 h-3" />
      },
      postponed: { 
        label: "مؤجل", 
        className: "bg-gradient-to-r from-yellow-500 to-amber-500 text-white",
        icon: <Clock className="w-3 h-3" />
      },
      returned: { 
        label: "مرتجع", 
        className: "bg-gradient-to-r from-purple-500 to-violet-500 text-white",
        icon: <RotateCcw className="w-3 h-3" />
      },
      cancelled: { 
        label: "ملغي", 
        className: "bg-gradient-to-r from-gray-500 to-slate-500 text-white",
        icon: <XCircle className="w-3 h-3" />
      },
    };

    const config = statusConfig[status] || { label: status, className: "bg-gray-500 text-white", icon: null };
    
    return (
      <Badge className={`${config.className} px-3 py-1.5 font-medium shadow-md flex items-center gap-1.5`}>
        {config.icon}
        <span>{config.label}</span>
      </Badge>
    );
  };

  const getDeliveryStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; className: string; emoji: string }> = {
      pending_approval: { label: "قيد الانتظار", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400", emoji: "⏳" },
      pending: { label: "بطريقه للتسليم", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400", emoji: "🚚" },
      delivered: { label: "تم التسليم", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400", emoji: "✅" },
      postponed: { label: "مؤجل", className: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400", emoji: "⏸️" },
      returned: { label: "مرتجع", className: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400", emoji: "↩️" },
      cancelled: { label: "ملغي", className: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400", emoji: "❌" },
    };

    const config = statusConfig[status] || { label: status, className: "bg-gray-100 text-gray-800", emoji: "❓" };
    
    return (
      <Badge className={`${config.className} px-2 py-1 text-xs font-medium`}>
        <span className="mr-1">{config.emoji}</span>
        {config.label}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      {/* Header with gradient */}
      <div className="bg-gradient-to-r from-emerald-500 via-green-500 to-teal-500 rounded-2xl shadow-2xl p-8 text-white">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold mb-2 flex items-center gap-3">
              <Package className="w-10 h-10" />
              إدارة الطلبات
            </h1>
            <p className="text-emerald-50 text-lg">
              إدارة شاملة لجميع الطلبات مع فلاتر متقدمة وتصدير البيانات
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={() => setSimpleOrderFormOpen(true)}
              className="bg-white text-emerald-600 hover:bg-emerald-50 shadow-lg font-bold px-6 py-6 text-lg"
              size="lg"
            >
              <Zap className="w-5 h-5 ml-2" />
              إضافة طلب مبسط
            </Button>
            <Button
              onClick={() => setLocation("/admin/orders/create")}
              className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white shadow-lg font-bold px-6 py-6 text-lg"
              size="lg"
            >
              <Plus className="w-5 h-5 ml-2" />
              إضافة طلب جديد
            </Button>
          </div>
        </div>
      </div>

      {/* Filters Card with gradient border */}
      <Card className="shadow-xl border-2 border-transparent bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950 dark:to-teal-950">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl font-bold flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
              <Filter className="w-6 h-6 text-emerald-600" />
              الفلاتر والبحث
            </CardTitle>
            {activeFiltersCount > 0 && (
              <Button
                onClick={clearAllFilters}
                variant="outline"
                size="sm"
                className="text-red-600 border-red-300 hover:bg-red-50"
              >
                <X className="w-4 h-4 ml-1" />
                مسح الكل ({activeFiltersCount})
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* First row: Date, Export, Refresh */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-semibold flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-600" />
                فلتر التاريخ
              </Label>
              <DateFilterDropdown
                value={dateFilter}
                onChange={setDateFilter}
              />
            </div>
            
            <div className="space-y-2">
              <Label className="text-sm font-semibold flex items-center gap-2">
                <Download className="w-4 h-4 text-emerald-600" />
                تصدير البيانات
              </Label>
              <Button
                onClick={() => setExportDialogOpen(true)}
                variant="outline"
                className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:from-blue-600 hover:to-cyan-600 border-0 shadow-md"
              >
                <FileDown className="w-4 h-4 ml-2" />
                تصدير Excel
              </Button>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-emerald-600" />
                تحديث البيانات
              </Label>
              <Button
                onClick={() => utils.orders.list.invalidate()}
                variant="outline"
                className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:from-emerald-600 hover:to-teal-600 border-0 shadow-md"
              >
                <RefreshCw className="w-4 h-4 ml-2" />
                تحديث
              </Button>
            </div>
          </div>

          {/* Second row: Phone search */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold flex items-center gap-2">
              <Phone className="w-4 h-4 text-emerald-600" />
              البحث برقم الهاتف
            </Label>
            <div className="relative">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                type="text"
                placeholder="ابحث برقم هاتف الزبون..."
                value={phoneSearch}
                onChange={(e) => setPhoneSearch(e.target.value)}
                className="pr-10 py-6 text-lg border-2 border-emerald-200 focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Third row: Advanced filters toggle */}
          <div className="flex items-center justify-between pt-2 border-t">
            <Button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              variant="ghost"
              className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 font-semibold"
            >
              <Filter className="w-4 h-4 ml-2" />
              {showAdvancedFilters ? "إخفاء الفلاتر المتقدمة" : "عرض الفلاتر المتقدمة"}
            </Button>
            {activeFiltersCount > 0 && (
              <Badge className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-3 py-1">
                {activeFiltersCount} فلتر نشط
              </Badge>
            )}
          </div>

          {/* Advanced filters */}
          {showAdvancedFilters && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t bg-white dark:bg-gray-900 rounded-lg p-4">
              <div className="space-y-2">
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <User className="w-4 h-4 text-emerald-600" />
                  المندوب
                </Label>
                <Select value={selectedDeliveryPerson} onValueChange={setSelectedDeliveryPerson}>
                  <SelectTrigger className="border-2 border-emerald-200 focus:border-emerald-500">
                    <SelectValue placeholder="اختر المندوب" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع المندوبين</SelectItem>
                    {deliveryPersons?.map((person: any) => (
                      <SelectItem key={person.id} value={person.id.toString()}>
                        {person.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-emerald-600" />
                  المنطقة
                </Label>
                <Select value={selectedRegion} onValueChange={setSelectedRegion}>
                  <SelectTrigger className="border-2 border-emerald-200 focus:border-emerald-500">
                    <SelectValue placeholder="اختر المنطقة" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع المناطق</SelectItem>
                    {regions?.map((region: any) => (
                      <SelectItem key={region.id} value={region.id.toString()}>
                        {region.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <Package className="w-4 h-4 text-emerald-600" />
                  الحالة
                </Label>
                <Select 
                  value={selectedStatuses.length === 1 ? selectedStatuses[0] : "all"}
                  onValueChange={(value) => {
                    if (value === "all") {
                      setSelectedStatuses([]);
                    } else {
                      setSelectedStatuses([value]);
                    }
                  }}
                >
                  <SelectTrigger className="border-2 border-emerald-200 focus:border-emerald-500">
                    <SelectValue placeholder="اختر الحالة" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع الحالات</SelectItem>
                    <SelectItem value="pending_approval">انتظار الموافقة</SelectItem>
                    <SelectItem value="pending">قيد التسليم</SelectItem>
                    <SelectItem value="delivered">تم التسليم</SelectItem>
                    <SelectItem value="postponed">مؤجل</SelectItem>
                    <SelectItem value="returned">مرتجع</SelectItem>
                    <SelectItem value="cancelled">ملغي</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabs with gradient */}
      <Card className="shadow-xl">
        <CardContent className="p-0">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="bg-gradient-to-r from-gray-50 to-slate-50 dark:from-gray-900 dark:to-slate-900 p-4 border-b">
              <TabsList className="grid w-full grid-cols-2 md:grid-cols-7 gap-2 bg-transparent">
                <TabsTrigger 
                  value="all" 
                  className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500 data-[state=active]:to-teal-500 data-[state=active]:text-white data-[state=active]:shadow-lg font-semibold"
                >
                  الكل ({filteredOrders.length})
                </TabsTrigger>
                <TabsTrigger 
                  value="pending_approval"
                  className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-cyan-500 data-[state=active]:text-white data-[state=active]:shadow-lg font-semibold"
                >
                  انتظار ({filteredOrders.filter((o: any) => o.status === 'pending_approval').length})
                </TabsTrigger>
                <TabsTrigger 
                  value="pending"
                  className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-orange-500 data-[state=active]:text-white data-[state=active]:shadow-lg font-semibold"
                >
                  قيد التسليم ({filteredOrders.filter((o: any) => o.status === 'pending').length})
                </TabsTrigger>
                <TabsTrigger 
                  value="delivered"
                  className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-500 data-[state=active]:to-emerald-500 data-[state=active]:text-white data-[state=active]:shadow-lg font-semibold"
                >
                  مسلمة ({filteredOrders.filter((o: any) => o.status === 'delivered').length})
                </TabsTrigger>
                <TabsTrigger 
                  value="postponed"
                  className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-yellow-500 data-[state=active]:to-amber-500 data-[state=active]:text-white data-[state=active]:shadow-lg font-semibold"
                >
                  مؤجلة ({filteredOrders.filter((o: any) => o.status === 'postponed').length})
                </TabsTrigger>
                <TabsTrigger 
                  value="returned"
                  className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-violet-500 data-[state=active]:text-white data-[state=active]:shadow-lg font-semibold"
                >
                  مرجوعة ({filteredOrders.filter((o: any) => o.status === 'returned').length})
                </TabsTrigger>
                <TabsTrigger 
                  value="cancelled"
                  className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-gray-500 data-[state=active]:to-slate-500 data-[state=active]:text-white data-[state=active]:shadow-lg font-semibold"
                >
                  ملغية ({filteredOrders.filter((o: any) => o.status === 'cancelled').length})
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value={activeTab} className="p-6">
              {displayedOrders.length === 0 ? (
                <div className="text-center py-16 bg-gradient-to-br from-gray-50 to-slate-50 dark:from-gray-900 dark:to-slate-900 rounded-xl">
                  <Package className="w-20 h-20 mx-auto text-gray-300 mb-4" />
                  <p className="text-xl text-muted-foreground font-semibold">لا توجد طلبات</p>
                  <p className="text-sm text-muted-foreground mt-2">جرب تغيير الفلاتر أو إضافة طلب جديد</p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto rounded-xl border-2 border-gray-200 dark:border-gray-800 shadow-lg">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950 dark:to-teal-950">
                          <TableHead className="font-bold text-center">المندوب</TableHead>
                          <TableHead className="font-bold text-center hidden md:table-cell">رقم الهاتف</TableHead>
                          <TableHead className="font-bold text-center hidden md:table-cell">المنطقة</TableHead>
                          <TableHead className="font-bold text-center hidden md:table-cell">العنوان</TableHead>
                          <TableHead className="font-bold text-center">السعر</TableHead>
                          <TableHead className="font-bold text-center hidden md:table-cell">الحالة</TableHead>
                          <TableHead className="font-bold text-center">حالة التسليم</TableHead>

                          <TableHead className="font-bold text-center">دقائق كلية</TableHead>
                          <TableHead className="font-bold text-center">الإجراءات</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {displayedOrders.map((order: any) => {
                          return (
                            <TableRow key={order.id} className="hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 transition-colors">
                              <TableCell className="text-center">
                                <div className="flex items-center gap-2 justify-center">
                                  {order.deliveryPersonImage ? (
                                    <img
                                      src={order.deliveryPersonImage}
                                      alt={order.deliveryPersonName || ""}
                                      className="w-10 h-10 rounded-full border-2 border-emerald-500 shadow-md object-cover"
                                    />
                                  ) : (
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-teal-400 flex items-center justify-center text-white font-bold shadow-md">
                                      <User className="w-5 h-5" />
                                    </div>
                                  )}
                                  <span className="font-semibold text-sm">{order.deliveryPersonName || "غير محدد"}</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-center font-mono hidden md:table-cell">
                                {order.customerPhone || "—"}
                              </TableCell>
                              <TableCell className="text-center hidden md:table-cell">
                                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300">
                                  {order.regionName || "—"}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-center text-sm text-muted-foreground hidden md:table-cell">
                                {order.customerAddress1 || "—"}
                              </TableCell>
                              <TableCell className="text-center">
                                <span className="font-bold text-lg bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                                  {formatCurrency(order.price)}
                                </span>
                              </TableCell>
                              <TableCell className="text-center hidden md:table-cell">
                                {getStatusBadge(order.status)}
                              </TableCell>
                              <TableCell className="text-center">
                                {getDeliveryStatusBadge(order.status)}
                              </TableCell>
                              <TableCell className="text-center">
                                {getDurationBadge(order.deliveryDuration, 'delivery')}
                              </TableCell>

                              <TableCell className="text-center">
                                {getDurationBadge(order.totalDuration, 'total')}
                              </TableCell>
                              <TableCell className="text-center">
                                <div className="flex items-center justify-center gap-2">
                                  <Button
                                    onClick={() => {
                                      setOrderDetails(order);
                                      setDetailsDialogOpen(true);
                                    }}
                                    size="sm"
                                    variant="ghost"
                                    className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    onClick={() => {
                                      if (order.status === 'delivered') {
                                        toast.warning('تحذير: هذا طلب مسلم وسيتم تعديله');
                                      }
                                      setEditOrder(order);
                                    }}
                                    size="sm"
                                    variant="ghost"
                                    className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                  >
                                    <Edit className="w-4 h-4" />
                                  </Button>
                                  {(order.status === 'postponed' || order.status === 'returned') && (
                                    <Button
                                      onClick={() => reactivateOrderMutation.mutate({ orderId: order.id })}
                                      size="sm"
                                      variant="ghost"
                                      className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                    >
                                      <RotateCcw className="w-4 h-4" />
                                    </Button>
                                  )}
                                  <Button
                                    onClick={() => {
                                      setOrderToDelete(order);
                                      setDeleteDialogOpen(true);
                                    }}
                                    size="sm"
                                    variant="ghost"
                                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                  {order.status === 'delivered' && order.deliveryImage && (
                                    <Button
                                      onClick={() => {
                                        setSelectedImageOrder(order);
                                        setImageDialogOpen(true);
                                      }}
                                      size="sm"
                                      variant="ghost"
                                      className="text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                                    >
                                      <ImageIcon className="w-4 h-4" />
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Load more button */}
                  {hasMoreOrders && (
                    <div className="mt-6 text-center">
                      <Button
                        onClick={handleLoadMore}
                        disabled={isLoadingMore}
                        className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-lg px-8 py-6 text-lg font-bold"
                        size="lg"
                      >
                        {isLoadingMore ? (
                          <>
                            <Loader2 className="w-5 h-5 ml-2 animate-spin" />
                            جاري التحميل...
                          </>
                        ) : (
                          <>
                            <RefreshCw className="w-5 h-5 ml-2" />
                            عرض المزيد (عرض {displayedOrdersCount} من {totalOrdersCount})
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Simple Order Form Dialog */}
      <Dialog open={simpleOrderFormOpen} onOpenChange={setSimpleOrderFormOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
              إضافة طلب مبسط
            </DialogTitle>
            <DialogDescription>
              نموذج سريع لإضافة طلب جديد بأقل البيانات المطلوبة
            </DialogDescription>
          </DialogHeader>
          <SimpleOrderForm 
            open={simpleOrderFormOpen} 
            onClose={() => setSimpleOrderFormOpen(false)}
            onSuccess={() => {
              setSimpleOrderFormOpen(false);
              utils.orders.list.invalidate();
            }} 
          />
        </DialogContent>
      </Dialog>

      {/* Export Dialog */}
      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
              تصدير الطلبات إلى Excel
            </DialogTitle>
            <DialogDescription>
              اختر الفلاتر المطلوبة لتصدير البيانات
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>من تاريخ</Label>
                <Input
                  type="date"
                  value={exportStartDate}
                  onChange={(e) => setExportStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>إلى تاريخ</Label>
                <Input
                  type="date"
                  value={exportEndDate}
                  onChange={(e) => setExportEndDate(e.target.value)}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>المندوبين</Label>
              <Select
                value={exportDeliveryPersons.length === 1 ? exportDeliveryPersons[0].toString() : "all"}
                onValueChange={(value) => {
                  if (value === "all") {
                    setExportDeliveryPersons([]);
                  } else {
                    setExportDeliveryPersons([parseInt(value)]);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="اختر المندوب" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع المندوبين</SelectItem>
                  {deliveryPersons?.map((person: any) => (
                    <SelectItem key={person.id} value={person.id.toString()}>
                      {person.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>الحالة</Label>
              <Select
                value={exportStatuses.length === 1 ? exportStatuses[0] : "all"}
                onValueChange={(value) => {
                  if (value === "all") {
                    setExportStatuses([]);
                  } else {
                    setExportStatuses([value]);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="اختر الحالة" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الحالات</SelectItem>
                  <SelectItem value="pending_approval">انتظار الموافقة</SelectItem>
                  <SelectItem value="pending">قيد التسليم</SelectItem>
                  <SelectItem value="delivered">تم التسليم</SelectItem>
                  <SelectItem value="postponed">مؤجل</SelectItem>
                  <SelectItem value="returned">مرتجع</SelectItem>
                  <SelectItem value="cancelled">ملغي</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>المنطقة</Label>
              <Select
                value={exportRegions.length === 1 ? exportRegions[0].toString() : "all"}
                onValueChange={(value) => {
                  if (value === "all") {
                    setExportRegions([]);
                  } else {
                    setExportRegions([parseInt(value)]);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="اختر المنطقة" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع المناطق</SelectItem>
                  {regions?.map((region: any) => (
                    <SelectItem key={region.id} value={region.id.toString()}>
                      {region.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={handleExportToExcel}
              className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white"
            >
              <Download className="w-4 h-4 ml-2" />
              تصدير الآن
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600">تأكيد الحذف</DialogTitle>
            <DialogDescription>
              هل أنت متأكد من حذف هذا الطلب؟ سيتم نقله إلى سجل الطلبات المحذوفة.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              إلغاء
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (orderToDelete) {
                  deleteOrderMutation.mutate({ orderId: orderToDelete.id });
                }
              }}
            >
              <Trash2 className="w-4 h-4 ml-2" />
              حذف
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image Dialog */}
      <Dialog open={imageDialogOpen} onOpenChange={setImageDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>صورة التسليم</DialogTitle>
          </DialogHeader>
          {selectedImageOrder?.deliveryImage && (
            <div className="space-y-4">
              <img
                src={selectedImageOrder.deliveryImage}
                alt="صورة التسليم"
                className="w-full rounded-lg shadow-lg"
              />
              {selectedImageOrder.deliveryNote && (
                <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg border-2 border-green-200 dark:border-green-800">
                  <p className="font-semibold text-green-800 dark:text-green-200 mb-2">ملاحظة المندوب:</p>
                  <p className="text-green-700 dark:text-green-300">{selectedImageOrder.deliveryNote}</p>
                </div>
              )}
              {selectedImageOrder.deliveryLocationName && (
                <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg border-2 border-blue-200 dark:border-blue-800">
                  <p className="font-semibold text-blue-800 dark:text-blue-200 mb-2">موقع التسليم:</p>
                  <p className="text-blue-700 dark:text-blue-300">{selectedImageOrder.deliveryLocationName}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Details Dialog */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
              تفاصيل الطلب
            </DialogTitle>
            <DialogDescription>
              معلومات كاملة عن الطلب وحالته
            </DialogDescription>
          </DialogHeader>
          {orderDetails && (
            <div className="space-y-6">
              {/* Customer Info */}
              <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950 dark:to-cyan-950 p-6 rounded-xl border-2 border-blue-200 dark:border-blue-800">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-blue-800 dark:text-blue-200">
                  <User className="w-5 h-5" />
                  معلومات الزبون
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm text-blue-600 dark:text-blue-400">رقم الهاتف</Label>
                    <p className="font-mono text-lg font-semibold">{orderDetails.customerPhone || "—"}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-blue-600 dark:text-blue-400">العنوان</Label>
                    <p className="text-lg">{orderDetails.customerAddress1 || "—"}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-blue-600 dark:text-blue-400">المنطقة</Label>
                    <p className="text-lg">{orderDetails.regionName || "—"}</p>
                  </div>
                  {orderDetails.locationLink && (
                    <div>
                      <Label className="text-sm text-blue-600 dark:text-blue-400">رابط الموقع</Label>
                      <a href={orderDetails.locationLink} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        فتح الموقع
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Order Info */}
              <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950 dark:to-teal-950 p-6 rounded-xl border-2 border-emerald-200 dark:border-emerald-800">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-emerald-800 dark:text-emerald-200">
                  <Package className="w-5 h-5" />
                  معلومات الطلب
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm text-emerald-600 dark:text-emerald-400">السعر</Label>
                    <p className="text-2xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                      {formatCurrency(orderDetails.price)}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm text-emerald-600 dark:text-emerald-400">الحالة</Label>
                    <div className="mt-1">{getStatusBadge(orderDetails.status)}</div>
                  </div>
                  <div>
                    <Label className="text-sm text-emerald-600 dark:text-emerald-400">المندوب</Label>
                    <p className="text-lg font-semibold">{orderDetails.deliveryPersonName || "—"}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-emerald-600 dark:text-emerald-400">تاريخ الإنشاء</Label>
                    <p className="text-lg" dir="ltr">{formatIraqDateEN(orderDetails.createdAt)}</p>
                  </div>
                  {orderDetails.acceptedAt && (
                    <div>
                      <Label className="text-sm text-emerald-600 dark:text-emerald-400">تاريخ القبول</Label>
                      <p className="text-lg" dir="ltr">{formatIraqDateEN(orderDetails.acceptedAt)}</p>
                    </div>
                  )}
                  {orderDetails.deliveredAt && (
                    <div>
                      <Label className="text-sm text-emerald-600 dark:text-emerald-400">تاريخ التسليم</Label>
                      <p className="text-lg" dir="ltr">{formatIraqDateEN(orderDetails.deliveredAt)}</p>
                    </div>
                  )}
                </div>
                {orderDetails.notes && (
                  <div className="mt-4 pt-4 border-t border-emerald-200 dark:border-emerald-800">
                    <Label className="text-sm text-emerald-600 dark:text-emerald-400">ملاحظات</Label>
                    <p className="text-lg mt-2 bg-white dark:bg-gray-900 p-3 rounded-lg">{orderDetails.notes}</p>
                  </div>
                )}
              </div>

              {/* Delivery Info */}
              {orderDetails.status === 'delivered' && (
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 p-6 rounded-xl border-2 border-green-200 dark:border-green-800">
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-green-800 dark:text-green-200">
                    <CheckCircle className="w-5 h-5" />
                    معلومات التسليم
                  </h3>
                  <div className="space-y-4">
                    {orderDetails.deliveryImage && (
                      <div>
                        <Label className="text-sm text-green-600 dark:text-green-400">صورة التسليم</Label>
                        <img src={orderDetails.deliveryImage} alt="صورة التسليم" className="w-full rounded-lg shadow-lg mt-2" />
                      </div>
                    )}
                    {orderDetails.deliveryNote && (
                      <div>
                        <Label className="text-sm text-green-600 dark:text-green-400">ملاحظة المندوب</Label>
                        <p className="text-lg mt-2 bg-white dark:bg-gray-900 p-3 rounded-lg">{orderDetails.deliveryNote}</p>
                      </div>
                    )}
                    {orderDetails.deliveryLocationName && (
                      <div>
                        <Label className="text-sm text-green-600 dark:text-green-400">موقع التسليم</Label>
                        <p className="text-lg mt-2 bg-white dark:bg-gray-900 p-3 rounded-lg">{orderDetails.deliveryLocationName}</p>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm text-green-600 dark:text-green-400">دقائق التسليم</Label>
                        <div className="mt-2">{getDurationBadge(orderDetails.deliveryDuration, 'delivery')}</div>
                      </div>
                      <div>
                        <Label className="text-sm text-green-600 dark:text-green-400">الدقائق الكلية</Label>
                        <div className="mt-2">{getDurationBadge(orderDetails.totalDuration, 'total')}</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Postponed/Returned Info */}
              {(orderDetails.status === 'postponed' || orderDetails.status === 'returned') && orderDetails.postponeReason && (
                <div className="bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-950 dark:to-amber-950 p-6 rounded-xl border-2 border-yellow-200 dark:border-yellow-800">
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-yellow-800 dark:text-yellow-200">
                    <Clock className="w-5 h-5" />
                    سبب {orderDetails.status === 'postponed' ? 'التأجيل' : 'الإرجاع'}
                  </h3>
                  <p className="text-lg bg-white dark:bg-gray-900 p-3 rounded-lg">{orderDetails.postponeReason}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            {orderDetails?.status === 'delivered' && orderDetails?.acceptedAt && (
              <Button
                onClick={() => {
                  setRouteMapOrder(orderDetails);
                  setRouteMapOpen(true);
                  setDetailsDialogOpen(false);
                }}
                className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white"
              >
                <Route className="w-4 h-4 ml-2" />
                عرض مسار التوصيل
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <EditOrderDialog
        order={editOrder}
        open={!!editOrder}
        onClose={() => setEditOrder(null)}
        onSuccess={() => {
          setEditOrder(null);
          utils.orders.list.invalidate();
        }}
      />

      {/* Route Map Dialog */}
      <Dialog open={routeMapOpen} onOpenChange={(open) => {
        setRouteMapOpen(open);
        if (!open) setRouteMapOrder(null);
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
              مسار التوصيل - الطلب #{routeMapOrder?.id}
            </DialogTitle>
            <DialogDescription>
              عرض المسار الكامل من قبول الطلب إلى التسليم
            </DialogDescription>
          </DialogHeader>
          {routeMapOrder && (
            <div className="space-y-4">
              {/* معلومات المسار */}
              <div className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950 dark:to-cyan-950 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-sm text-blue-600 dark:text-blue-400">وقت القبول</p>
                    <p className="font-bold text-lg" dir="ltr">{formatIraqDateEN(routeMapOrder.acceptedAt)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-blue-600 dark:text-blue-400">وقت التسليم</p>
                    <p className="font-bold text-lg" dir="ltr">{formatIraqDateEN(routeMapOrder.deliveredAt)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-blue-600 dark:text-blue-400">مدة التوصيل</p>
                    <p className="font-bold text-lg">{getDurationBadge(routeMapOrder.deliveryDuration, 'delivery')}</p>
                  </div>
                </div>
              </div>
              {/* TODO: إضافة جلب بيانات GPS من API */}
              <OrderRouteMap
                orderId={routeMapOrder.id}
                locations={[]}
                startTime={new Date(routeMapOrder.acceptedAt)}
                endTime={new Date(routeMapOrder.deliveredAt)}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
