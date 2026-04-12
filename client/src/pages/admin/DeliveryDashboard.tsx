import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, User, Package, TrendingUp, Clock, DollarSign, RefreshCw, CheckCircle, XCircle, AlertCircle, Calendar, Timer, Truck, Eye, Zap, MapPin, Route, Trash2, Edit } from "lucide-react";
import { useLocation } from "wouter";
import { BarChart, Bar, LineChart, Line, PieChart as RePieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { DateFilterDropdown } from "@/components/DateFilterDropdown";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import EditOrderDialog from "@/components/EditOrderDialog";

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function DeliveryDashboard() {
  const [, navigate] = useLocation();
  const [selectedDeliveryPerson, setSelectedDeliveryPerson] = useState<string>("all");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<any>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [orderToEdit, setOrderToEdit] = useState<any>(null);
  
  // Get today's bounds (5 AM to 4:59 AM next day)
  const getTodayBounds = () => {
    const now = new Date();
    const start = new Date(now);
    if (now.getHours() < 5) {
      start.setDate(start.getDate() - 1);
    }
    start.setHours(5, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    end.setHours(4, 59, 59, 999);
    return { start, end };
  };
  
  const todayBounds = getTodayBounds();
  const [dateFilter, setDateFilter] = useState<{ type: 'today' | 'yesterday' | 'thisWeek' | 'thisMonth' | 'custom'; startDate?: string; endDate?: string; label: string }>({
    type: 'today',
    startDate: todayBounds.start.toISOString(),
    endDate: todayBounds.end.toISOString(),
    label: 'اليوم'
  });

  // Get delivery persons (users with role 'delivery')
  const { data: users } = trpc.users.list.useQuery();
  const deliveryPersons = useMemo(() => users?.filter(u => u.role === 'delivery') || [], [users]);

  // Get delivery person stats
  const { data: stats, isLoading, refetch } = trpc.deliveryPerformance.stats.useQuery({
    deliveryPersonId: selectedDeliveryPerson !== "all" ? parseInt(selectedDeliveryPerson) : undefined,
    startDate: dateFilter.startDate ? new Date(dateFilter.startDate) : undefined,
    endDate: dateFilter.endDate ? new Date(dateFilter.endDate) : undefined,
  });

  // Get delivery person orders
  const { data: ordersData, isLoading: ordersLoading } = trpc.deliveryPerformance.orders.useQuery({
    deliveryPersonId: selectedDeliveryPerson !== "all" ? parseInt(selectedDeliveryPerson) : undefined,
    startDate: dateFilter.startDate ? new Date(dateFilter.startDate) : undefined,
    endDate: dateFilter.endDate ? new Date(dateFilter.endDate) : undefined,
  });

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US').format(price) + ' د.ع';
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Baghdad',
    });
  };

  const formatDuration = (minutes: number | null) => {
    if (!minutes || minutes === 0) return '-';
    if (minutes < 60) return `${minutes.toLocaleString('en-US')} دقيقة`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toLocaleString('en-US')} ساعة و ${mins.toLocaleString('en-US')} دقيقة`;
  };

  const getDurationColor = (minutes: number | null) => {
    if (!minutes) return "text-gray-400";
    if (minutes < 30) return "text-green-600";
    if (minutes < 60) return "text-yellow-600";
    return "text-red-600";
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; className: string }> = {
      pending_approval: { label: "بانتظار الموافقة", className: "bg-gradient-to-r from-yellow-500 to-orange-500 text-white" },
      pending: { label: "قيد التوصيل", className: "bg-gradient-to-r from-blue-500 to-cyan-600 text-white" },
      delivered: { label: "تم التسليم", className: "bg-gradient-to-r from-green-500 to-emerald-600 text-white" },
      postponed: { label: "مؤجل", className: "bg-gradient-to-r from-orange-500 to-amber-600 text-white" },
      cancelled: { label: "ملغي", className: "bg-gradient-to-r from-red-500 to-rose-600 text-white" },
      returned: { label: "مرتجع", className: "bg-gradient-to-r from-gray-400 to-gray-500 text-white" },
    };
    const info = statusMap[status] || { label: status, className: "bg-gradient-to-r from-gray-400 to-gray-500 text-white" };
    return <Badge className={info.className}>{info.label}</Badge>;
  };

  const utils = trpc.useUtils();

  const deleteMutation = trpc.orders.deleteOrder.useMutation({
    onSuccess: () => {
      toast.success("تم حذف الطلب بنجاح");
      setDeleteDialogOpen(false);
      setOrderToDelete(null);
      utils.deliveryPerformance.orders.invalidate();
      utils.deliveryPerformance.stats.invalidate();
    },
    onError: (error: any) => {
      toast.error(error.message || "فشل حذف الطلب");
    },
  });

  const handleDeleteClick = (order: any) => {
    setOrderToDelete(order);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (orderToDelete) {
      deleteMutation.mutate({ orderId: orderToDelete.id });
    }
  };

  const handleEditClick = (order: any) => {
    setOrderToEdit(order);
    setEditDialogOpen(true);
  };

  const handleEditSuccess = () => {
    setEditDialogOpen(false);
    setOrderToEdit(null);
    utils.deliveryPerformance.orders.invalidate();
    utils.deliveryPerformance.stats.invalidate();
  };

  // Calculate totals
  // When a specific delivery person is selected, show their stats directly
  // When "all" is selected, stats are already grouped by delivery person, so we need to sum them
  // IMPORTANT: Convert to Number to avoid string concatenation
  const totalOrders = selectedDeliveryPerson !== "all" && stats && stats.length > 0
    ? Number(stats[0].totalOrders) || 0
    : stats?.reduce((sum, s) => sum + (Number(s.totalOrders) || 0), 0) || 0;
  const totalDelivered = selectedDeliveryPerson !== "all" && stats && stats.length > 0
    ? Number(stats[0].deliveredOrders) || 0
    : stats?.reduce((sum, s) => sum + (Number(s.deliveredOrders) || 0), 0) || 0;
  const totalReturned = selectedDeliveryPerson !== "all" && stats && stats.length > 0
    ? Number(stats[0].returnedOrders) || 0
    : stats?.reduce((sum, s) => sum + (Number(s.returnedOrders) || 0), 0) || 0;
  const totalPostponed = selectedDeliveryPerson !== "all" && stats && stats.length > 0
    ? Number(stats[0].postponedOrders) || 0
    : stats?.reduce((sum, s) => sum + (Number(s.postponedOrders) || 0), 0) || 0;
  const totalRevenue = selectedDeliveryPerson !== "all" && stats && stats.length > 0
    ? Number(stats[0].totalRevenue) || 0
    : stats?.reduce((sum, s) => sum + (Number(s.totalRevenue) || 0), 0) || 0;
  const avgDeliveryTime = selectedDeliveryPerson !== "all" && stats && stats.length > 0
    ? Number(stats[0].avgDeliveryTime) || 0
    : stats && stats.length > 0 
      ? stats.reduce((sum, s) => sum + (Number(s.avgDeliveryTime) || 0), 0) / stats.length 
      : 0;

  // Prepare chart data
  const performanceData = stats?.map(s => ({
    name: s.deliveryPersonName || `مندوب #${s.deliveryPersonId}`,
    'المسلمة': s.deliveredOrders || 0,
    'المرجوعة': s.returnedOrders || 0,
    'المؤجلة': s.postponedOrders || 0,
    'الملغية': s.cancelledOrders || 0,
  })) || [];

  const statusDistribution = [
    { name: 'المسلمة', value: totalDelivered, color: '#10b981' },
    { name: 'المرجوعة', value: totalReturned, color: '#ef4444' },
    { name: 'المؤجلة', value: totalPostponed, color: '#f59e0b' },
  ].filter((item: { name: string; value: number; color: string }) => item.value > 0);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
            لوحة تحكم المندوبين
          </h1>
          <p className="text-muted-foreground mt-2">متابعة شاملة لأداء المندوبين وسرعة التسليم</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="default"
            onClick={() => navigate('/admin/delivery-speed-analytics')}
            className="gap-2 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white"
          >
            <Zap className="w-4 h-4" />
            تحليل السرعة
          </Button>
          <Button 
            variant="outline" 
            onClick={() => navigate('/admin/advanced-tracking')}
            className="gap-2 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-300 transition-all"
          >
            <Route className="w-4 h-4" />
            مسارات GPS
          </Button>
          <Button 
            variant="outline" 
            onClick={() => refetch()}
            className="gap-2 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-300 transition-all"
          >
            <RefreshCw className="w-4 h-4" />
            تحديث
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="border-none shadow-lg">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Select value={selectedDeliveryPerson} onValueChange={setSelectedDeliveryPerson}>
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="جميع المندوبين" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع المندوبين</SelectItem>
                  {deliveryPersons.map((person) => (
                    <SelectItem key={person.id} value={person.id.toString()}>
                      {person.name || person.username}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <DateFilterDropdown
                value={dateFilter}
                onChange={setDateFilter}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <Card className="border-none shadow-lg hover:shadow-xl transition-all duration-300">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-2xl flex items-center justify-center shadow-lg">
                <Package className="w-6 h-6 text-white" />
              </div>
              <p className="text-xs text-muted-foreground font-medium text-center">إجمالي الطلبات</p>
              <p className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                {totalOrders.toLocaleString('en-US')}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-lg hover:shadow-xl transition-all duration-300">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg">
                <CheckCircle className="w-6 h-6 text-white" />
              </div>
              <p className="text-xs text-muted-foreground font-medium text-center">المسلمة</p>
              <p className="text-2xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                {totalDelivered.toLocaleString('en-US')}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-lg hover:shadow-xl transition-all duration-300">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-rose-600 rounded-2xl flex items-center justify-center shadow-lg">
                <XCircle className="w-6 h-6 text-white" />
              </div>
              <p className="text-xs text-muted-foreground font-medium text-center">المرجوعة</p>
              <p className="text-2xl font-bold bg-gradient-to-r from-red-600 to-rose-600 bg-clip-text text-transparent">
                {totalReturned.toLocaleString('en-US')}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-lg hover:shadow-xl transition-all duration-300">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-amber-600 rounded-2xl flex items-center justify-center shadow-lg">
                <AlertCircle className="w-6 h-6 text-white" />
              </div>
              <p className="text-xs text-muted-foreground font-medium text-center">المؤجلة</p>
              <p className="text-2xl font-bold bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
                {totalPostponed.toLocaleString('en-US')}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-lg hover:shadow-xl transition-all duration-300">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 bg-gradient-to-br from-yellow-500 to-amber-600 rounded-2xl flex items-center justify-center shadow-lg">
                <DollarSign className="w-6 h-6 text-white" />
              </div>
              <p className="text-xs text-muted-foreground font-medium text-center">الأرباح</p>
              <p className="text-lg font-bold bg-gradient-to-r from-yellow-600 to-amber-600 bg-clip-text text-transparent">
                {formatPrice(totalRevenue)}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-lg hover:shadow-xl transition-all duration-300">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl flex items-center justify-center shadow-lg">
                <Timer className="w-6 h-6 text-white" />
              </div>
              <p className="text-xs text-muted-foreground font-medium text-center">متوسط التسليم</p>
              <p className="text-lg font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                {avgDeliveryTime > 0 ? `${Math.round(avgDeliveryTime).toLocaleString('en-US')} د` : '-'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Explanation */}
      <Card className="border-none shadow-lg bg-gradient-to-r from-emerald-50 to-teal-50">
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-600" />
            معايير الأداء
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="flex items-start gap-2">
              <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
              <div>
                <p className="font-semibold text-green-700">معدل النجاح</p>
                <p className="text-muted-foreground">نسبة الطلبات المسلمة من إجمالي الطلبات</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <XCircle className="w-5 h-5 text-red-600 mt-0.5" />
              <div>
                <p className="font-semibold text-red-700">معدل الإرجاع</p>
                <p className="text-muted-foreground">نسبة الطلبات المرجوعة من إجمالي الطلبات</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-orange-600 mt-0.5" />
              <div>
                <p className="font-semibold text-orange-700">معدل التأجيل</p>
                <p className="text-muted-foreground">نسبة الطلبات المؤجلة من إجمالي الطلبات</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Charts */}
      {stats && stats.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Bar Chart */}
          <Card className="border-none shadow-lg">
            <CardHeader className="bg-gradient-to-r from-emerald-50 to-teal-50 border-b">
              <CardTitle className="text-xl">مقارنة أداء المندوبين</CardTitle>
              <CardDescription>عدد الطلبات حسب الحالة لكل مندوب</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={performanceData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'white', 
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                    }}
                  />
                  <Legend />
                  <Bar dataKey="المسلمة" fill="#10b981" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="المرجوعة" fill="#ef4444" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="المؤجلة" fill="#f59e0b" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="الملغية" fill="#6b7280" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Pie Chart */}
          {statusDistribution.length > 0 && (
            <Card className="border-none shadow-lg">
              <CardHeader className="bg-gradient-to-r from-emerald-50 to-teal-50 border-b">
                <CardTitle className="text-xl">توزيع حالات الطلبات</CardTitle>
                <CardDescription>نسبة كل حالة من إجمالي الطلبات</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <ResponsiveContainer width="100%" height={300}>
                  <RePieChart>
                    <Pie
                      data={statusDistribution}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {statusDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'white', 
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                      }}
                    />
                  </RePieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Delivery Person Stats Table */}
      <Card className="border-none shadow-lg">
        <CardHeader className="bg-gradient-to-r from-emerald-50 to-teal-50 border-b">
          <CardTitle className="text-2xl">تفاصيل أداء المندوبين</CardTitle>
          <CardDescription>الإحصائيات الكاملة لكل مندوب</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="text-center py-16">
              <Loader2 className="w-12 h-12 animate-spin mx-auto text-emerald-600" />
              <p className="text-muted-foreground mt-4">جاري التحميل...</p>
            </div>
          ) : !stats || stats.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-24 h-24 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Truck className="w-12 h-12 text-emerald-600" />
              </div>
              <p className="text-xl font-semibold text-muted-foreground">لا توجد بيانات</p>
              <p className="text-sm text-muted-foreground mt-2">لم يتم تسجيل أي طلبات للمندوبين في هذه الفترة</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-bold">المندوب</TableHead>
                    <TableHead className="font-bold">إجمالي</TableHead>
                    <TableHead className="font-bold">مسلمة</TableHead>
                    <TableHead className="font-bold">مرجوعة</TableHead>
                    <TableHead className="font-bold">مؤجلة</TableHead>
                    <TableHead className="font-bold">ملغية</TableHead>
                    <TableHead className="font-bold">معدل النجاح</TableHead>
                    <TableHead className="font-bold">متوسط التسليم</TableHead>
                    <TableHead className="font-bold">الأرباح</TableHead>
                    <TableHead className="font-bold">الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.map((stat) => {
                    const successRate = stat.totalOrders > 0 
                      ? ((stat.deliveredOrders / stat.totalOrders) * 100).toFixed(0)
                      : '0';
                    return (
                      <TableRow key={stat.deliveryPersonId} className="hover:bg-muted/30 transition-colors">
                        <TableCell className="font-semibold">
                          {stat.deliveryPersonName || `مندوب #${stat.deliveryPersonId}`}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-gradient-to-r from-blue-50 to-cyan-50 border-blue-200 text-blue-700 font-semibold">
                            {(stat.totalOrders || 0).toLocaleString('en-US')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className="bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold shadow-sm">
                            {(stat.deliveredOrders || 0).toLocaleString('en-US')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className="bg-gradient-to-r from-red-500 to-rose-600 text-white font-semibold shadow-sm">
                            {(stat.returnedOrders || 0).toLocaleString('en-US')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className="bg-gradient-to-r from-orange-500 to-amber-600 text-white font-semibold shadow-sm">
                            {(stat.postponedOrders || 0).toLocaleString('en-US')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className="bg-gradient-to-r from-gray-400 to-gray-500 text-white font-semibold shadow-sm">
                            {(stat.cancelledOrders || 0).toLocaleString('en-US')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            className={`font-semibold ${
                              parseInt(successRate) >= 80 ? 'bg-green-100 text-green-700' :
                              parseInt(successRate) >= 60 ? 'bg-yellow-100 text-yellow-700' :
                              'bg-red-100 text-red-700'
                            }`}
                          >
                            {successRate}%
                          </Badge>
                        </TableCell>
                        <TableCell className={`font-bold ${getDurationColor(stat.avgDeliveryTime)}`}>
                          {stat.avgDeliveryTime ? `${Math.round(stat.avgDeliveryTime).toLocaleString('en-US')} د` : '-'}
                        </TableCell>
                        <TableCell className="font-bold text-emerald-600">
                          {formatPrice(stat.totalRevenue || 0)}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/admin/delivery-person/${stat.deliveryPersonId}`)}
                            className="hover:bg-blue-50 hover:text-blue-600"
                          >
                            <Eye className="h-4 w-4 ml-2" />
                            عرض التفاصيل
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Orders Table */}
      <Card className="border-none shadow-lg">
        <CardHeader className="bg-gradient-to-r from-emerald-50 to-teal-50 border-b">
          <CardTitle className="text-2xl">سجل الطلبات التفصيلي</CardTitle>
          <CardDescription>جميع الطلبات مع سرعة الأداء لكل طلب</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          {ordersLoading ? (
            <div className="text-center py-16">
              <Loader2 className="w-12 h-12 animate-spin mx-auto text-emerald-600" />
              <p className="text-muted-foreground mt-4">جاري التحميل...</p>
            </div>
          ) : !ordersData || ordersData.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-24 h-24 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Package className="w-12 h-12 text-emerald-600" />
              </div>
              <p className="text-xl font-semibold text-muted-foreground">لا توجد طلبات</p>
              <p className="text-sm text-muted-foreground mt-2">لم يتم تسجيل أي طلبات في هذه الفترة</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-bold">رقم الطلب</TableHead>
                    <TableHead className="font-bold hidden md:table-cell">المندوب</TableHead>
                    <TableHead className="font-bold">الزبون</TableHead>
                    <TableHead className="font-bold hidden lg:table-cell">المنطقة</TableHead>
                    <TableHead className="font-bold">السعر</TableHead>
                    <TableHead className="font-bold hidden md:table-cell">الحالة</TableHead>
                    <TableHead className="font-bold hidden sm:table-cell">م.التسليم</TableHead>
                    <TableHead className="font-bold hidden sm:table-cell">دقائق كلية</TableHead>
                    <TableHead className="font-bold hidden md:table-cell">التاريخ</TableHead>
                    <TableHead className="font-bold">الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ordersData.map((order: any) => (
                    <TableRow key={order.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="font-semibold">#{order.id.toLocaleString('en-US')}</TableCell>
                      <TableCell className="hidden md:table-cell">{order.deliveryPersonName || '-'}</TableCell>
                      <TableCell>{order.customerName || '-'}</TableCell>
                      <TableCell className="hidden lg:table-cell">{order.regionName || '-'}</TableCell>
                      <TableCell className="font-bold text-emerald-600">{formatPrice(order.price)}</TableCell>
                      <TableCell className="hidden md:table-cell">{getStatusBadge(order.status)}</TableCell>
                      <TableCell className={`font-bold hidden sm:table-cell ${getDurationColor(order.deliveryMinutes)}`}>
                        {formatDuration(order.deliveryMinutes)}
                      </TableCell>
                      <TableCell className={`font-bold hidden sm:table-cell ${getDurationColor(order.totalMinutes)}`}>
                        {formatDuration(order.totalMinutes)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground hidden md:table-cell">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          {formatDate(order.createdAt)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate(`/admin/orders/${order.id}`)}
                            className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditClick(order)}
                            className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteClick(order)}
                            className="h-8 w-8 text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تأكيد الحذف</DialogTitle>
            <DialogDescription>
              هل أنت متأكد من حذف الطلب رقم #{orderToDelete?.id}؟ هذه العملية لا يمكن التراجع عنها.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleteMutation.isPending}
            >
              إلغاء
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                  جاري الحذف...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 ml-2" />
                  حذف
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      {orderToEdit && (
        <EditOrderDialog
          order={orderToEdit}
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          onSuccess={handleEditSuccess}
        />
      )}
    </div>
  );
}
