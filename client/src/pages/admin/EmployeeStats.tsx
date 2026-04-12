import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Users, FileText, TrendingUp, DollarSign, RefreshCw, Eye, BarChart3, PieChart, Calendar, Filter } from "lucide-react";
import { BarChart, Bar, PieChart as RePieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { DateFilterDropdown } from "@/components/DateFilterDropdown";

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

export default function EmployeeStats() {
  const [selectedEmployee, setSelectedEmployee] = useState<string>("all");
  const [showOrdersDialog, setShowOrdersDialog] = useState(false);
  const [viewingEmployeeId, setViewingEmployeeId] = useState<number | null>(null);
  
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

  // Get admin users
  const { data: users } = trpc.users.list.useQuery();
  const adminUsers = users?.filter(u => u.role === 'admin') || [];

  // Get employee stats
  const { data: stats, isLoading, refetch } = trpc.employeeStats.list.useQuery({
    employeeId: selectedEmployee !== "all" ? parseInt(selectedEmployee) : undefined,
    startDate: dateFilter.startDate ? new Date(dateFilter.startDate) : undefined,
    endDate: dateFilter.endDate ? new Date(dateFilter.endDate) : undefined,
  });

  // Get employee orders
  const { data: ordersData, isLoading: ordersLoading } = trpc.employeeStats.orders.useQuery(
    { employeeId: viewingEmployeeId! },
    { enabled: viewingEmployeeId !== null }
  );

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US').format(price) + ' د.ع';
  };

  const formatDate = (date: Date | string) => {
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

  // When a specific employee is selected, show their stats directly
  // When "all" is selected, stats are already grouped by employee, so we need to sum them
  // IMPORTANT: Convert to Number to avoid string concatenation
  const totalOrders = selectedEmployee !== "all" && stats && stats.length > 0
    ? Number(stats[0].totalOrders) || 0
    : stats?.reduce((sum, s) => sum + (Number(s.totalOrders) || 0), 0) || 0;
  const totalDelivered = selectedEmployee !== "all" && stats && stats.length > 0
    ? Number(stats[0].deliveredOrders) || 0
    : stats?.reduce((sum, s) => sum + (Number(s.deliveredOrders) || 0), 0) || 0;
  const totalRevenue = selectedEmployee !== "all" && stats && stats.length > 0
    ? Number(stats[0].totalRevenue) || 0
    : stats?.reduce((sum, s) => sum + (Number(s.totalRevenue) || 0), 0) || 0;

  // Prepare chart data
  const barChartData = stats?.map(s => ({
    name: s.employeeName || s.employeeUsername || `موظف #${s.employeeId}`,
    'الطلبات المسلمة': s.deliveredOrders || 0,
    'قيد التوصيل': s.pendingOrders || 0,
    'الملغية': s.cancelledOrders || 0,
  })) || [];

  const pieChartData = stats?.map(s => ({
    name: s.employeeName || s.employeeUsername || `موظف #${s.employeeId}`,
    value: s.totalOrders || 0,
  })) || [];

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
            إحصائيات الموظفين
          </h1>
          <p className="text-muted-foreground mt-2">عرض أداء كل موظف والطلبات التي أضافها</p>
        </div>
        <Button 
          variant="outline" 
          onClick={() => refetch()}
          className="gap-2 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-300 transition-all"
        >
          <RefreshCw className="w-4 h-4" />
          تحديث
        </Button>
      </div>

      {/* Date Filter */}
      <Card className="border-none shadow-lg">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <Filter className="w-5 h-5 text-emerald-600" />
            <DateFilterDropdown
              value={dateFilter}
              onChange={setDateFilter}
            />
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-none shadow-lg hover:shadow-xl transition-all duration-300">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-2xl flex items-center justify-center shadow-lg">
                <Users className="w-7 h-7 text-white" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground font-medium">عدد الموظفين</p>
                <p className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                  {(stats?.length || 0).toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-lg hover:shadow-xl transition-all duration-300">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center shadow-lg">
                <FileText className="w-7 h-7 text-white" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground font-medium">إجمالي الطلبات</p>
                <p className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                  {totalOrders.toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-lg hover:shadow-xl transition-all duration-300">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg">
                <TrendingUp className="w-7 h-7 text-white" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground font-medium">الطلبات المسلمة</p>
                <p className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                  {totalDelivered.toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-lg hover:shadow-xl transition-all duration-300">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gradient-to-br from-yellow-500 to-amber-600 rounded-2xl flex items-center justify-center shadow-lg">
                <DollarSign className="w-7 h-7 text-white" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground font-medium">إجمالي الأرباح</p>
                <p className="text-2xl font-bold bg-gradient-to-r from-yellow-600 to-amber-600 bg-clip-text text-transparent">
                  {formatPrice(totalRevenue)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      {stats && stats.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Bar Chart */}
          <Card className="border-none shadow-lg">
            <CardHeader className="bg-gradient-to-r from-emerald-50 to-teal-50 border-b">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-emerald-600" />
                <CardTitle className="text-xl">مقارنة أداء الموظفين</CardTitle>
              </div>
              <CardDescription>عدد الطلبات حسب الحالة لكل موظف</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={barChartData}>
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
                  <Bar dataKey="الطلبات المسلمة" fill="#10b981" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="قيد التوصيل" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="الملغية" fill="#ef4444" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Pie Chart */}
          <Card className="border-none shadow-lg">
            <CardHeader className="bg-gradient-to-r from-emerald-50 to-teal-50 border-b">
              <div className="flex items-center gap-2">
                <PieChart className="w-5 h-5 text-emerald-600" />
                <CardTitle className="text-xl">توزيع الطلبات بين الموظفين</CardTitle>
              </div>
              <CardDescription>نسبة مساهمة كل موظف في إجمالي الطلبات</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <ResponsiveContainer width="100%" height={300}>
                <RePieChart>
                  <Pie
                    data={pieChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pieChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
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
        </div>
      )}

      {/* Employee Stats Table */}
      <Card className="border-none shadow-lg">
        <CardHeader className="bg-gradient-to-r from-emerald-50 to-teal-50 border-b">
          <CardTitle className="text-2xl">تفاصيل أداء الموظفين</CardTitle>
          <CardDescription>الطلبات والأرباح لكل موظف</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          {/* Filter */}
          <div className="flex gap-4 mb-6">
            <div className="flex-1 max-w-md">
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="جميع الموظفين" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الموظفين</SelectItem>
                  {adminUsers.map((user) => (
                    <SelectItem key={user.id} value={user.id.toString()}>
                      {user.name || user.username}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {isLoading ? (
            <div className="text-center py-16">
              <Loader2 className="w-12 h-12 animate-spin mx-auto text-emerald-600" />
              <p className="text-muted-foreground mt-4">جاري التحميل...</p>
            </div>
          ) : !stats || stats.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-24 h-24 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-12 h-12 text-emerald-600" />
              </div>
              <p className="text-xl font-semibold text-muted-foreground">لا توجد بيانات</p>
              <p className="text-sm text-muted-foreground mt-2">لم يتم تسجيل أي طلبات بعد</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-bold">الموظف</TableHead>
                    <TableHead className="font-bold">إجمالي الطلبات</TableHead>
                    <TableHead className="font-bold">المسلمة</TableHead>
                    <TableHead className="font-bold">قيد التوصيل</TableHead>
                    <TableHead className="font-bold">الملغية</TableHead>
                    <TableHead className="font-bold">الأرباح</TableHead>
                    <TableHead className="font-bold">الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.map((stat) => (
                    <TableRow key={stat.employeeId} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="font-semibold">
                        {stat.employeeName || stat.employeeUsername || `موظف #${stat.employeeId}`}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200 text-purple-700 font-semibold">
                          {(stat.totalOrders || 0).toLocaleString('en-US')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold shadow-sm">
                          {(stat.deliveredOrders || 0).toLocaleString('en-US')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-gradient-to-r from-blue-500 to-cyan-600 text-white font-semibold shadow-sm">
                          {(stat.pendingOrders || 0).toLocaleString('en-US')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-gradient-to-r from-red-500 to-rose-600 text-white font-semibold shadow-sm">
                          {(stat.cancelledOrders || 0).toLocaleString('en-US')}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-bold text-emerald-600">
                        {formatPrice(stat.totalRevenue || 0)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setViewingEmployeeId(stat.employeeId);
                            setShowOrdersDialog(true);
                          }}
                          className="gap-2 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-300"
                        >
                          <Eye className="w-4 h-4" />
                          عرض الطلبات
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Orders Dialog */}
      <Dialog open={showOrdersDialog} onOpenChange={setShowOrdersDialog}>
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
              طلبات الموظف
            </DialogTitle>
          </DialogHeader>
          
          {ordersLoading ? (
            <div className="text-center py-16">
              <Loader2 className="w-12 h-12 animate-spin mx-auto text-emerald-600" />
              <p className="text-muted-foreground mt-4">جاري التحميل...</p>
            </div>
          ) : !ordersData?.orders || ordersData.orders.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-24 h-24 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="w-12 h-12 text-emerald-600" />
              </div>
              <p className="text-xl font-semibold text-muted-foreground">لا توجد طلبات</p>
            </div>
          ) : (
            <div>
              <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-lg p-4 mb-6">
                <p className="text-sm font-semibold text-emerald-700">
                  إجمالي الطلبات: <span className="text-2xl">{ordersData.total.toLocaleString('en-US')}</span>
                </p>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-bold">رقم الطلب</TableHead>
                      <TableHead className="font-bold">الزبون</TableHead>
                      <TableHead className="font-bold">المنطقة</TableHead>
                      <TableHead className="font-bold">المندوب</TableHead>
                      <TableHead className="font-bold">السعر</TableHead>
                      <TableHead className="font-bold">الحالة</TableHead>
                      <TableHead className="font-bold">التاريخ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ordersData.orders.map((order) => (
                      <TableRow key={order.id} className="hover:bg-muted/30 transition-colors">
                        <TableCell className="font-semibold">#{order.id.toLocaleString('en-US')}</TableCell>
                        <TableCell>{order.customerName || '-'}</TableCell>
                        <TableCell>{order.regionName || '-'}</TableCell>
                        <TableCell>{order.deliveryPersonName || '-'}</TableCell>
                        <TableCell className="font-bold text-emerald-600">{formatPrice(order.price)}</TableCell>
                        <TableCell>{getStatusBadge(order.status)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            {formatDate(order.createdAt)}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
