import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Activity, LogIn, LogOut, Eye, Plus, Edit, Trash2, UserCheck, Settings, RefreshCw, Users, FileText, TrendingUp, Calendar, Filter } from "lucide-react";
import { DateFilterDropdown } from "@/components/DateFilterDropdown";

const activityTypeLabels: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  login: { label: "تسجيل دخول", icon: <LogIn className="w-4 h-4" />, color: "bg-gradient-to-r from-green-500 to-emerald-600 text-white" },
  logout: { label: "تسجيل خروج", icon: <LogOut className="w-4 h-4" />, color: "bg-gradient-to-r from-gray-400 to-gray-500 text-white" },
  page_view: { label: "عرض صفحة", icon: <Eye className="w-4 h-4" />, color: "bg-gradient-to-r from-blue-500 to-cyan-600 text-white" },
  order_create: { label: "إضافة طلب", icon: <Plus className="w-4 h-4" />, color: "bg-gradient-to-r from-emerald-500 to-teal-600 text-white" },
  order_update: { label: "تعديل طلب", icon: <Edit className="w-4 h-4" />, color: "bg-gradient-to-r from-yellow-500 to-orange-500 text-white" },
  order_delete: { label: "حذف طلب", icon: <Trash2 className="w-4 h-4" />, color: "bg-gradient-to-r from-red-500 to-rose-600 text-white" },
  delivery_assign: { label: "تعيين مندوب", icon: <UserCheck className="w-4 h-4" />, color: "bg-gradient-to-r from-purple-500 to-pink-600 text-white" },
  status_change: { label: "تغيير حالة", icon: <Activity className="w-4 h-4" />, color: "bg-gradient-to-r from-orange-500 to-amber-600 text-white" },
  settings_change: { label: "تغيير إعدادات", icon: <Settings className="w-4 h-4" />, color: "bg-gradient-to-r from-pink-500 to-rose-600 text-white" },
};

export default function ActivityLogs() {
  const [selectedUser, setSelectedUser] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [page, setPage] = useState(0);
  
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
  const limit = 50;

  // Get admin users for filter
  const { data: users } = trpc.users.list.useQuery();
  const adminUsers = useMemo(() => users?.filter(u => u.role === 'admin') || [], [users]);

  // Get activity logs
  const { data: logsData, isLoading, refetch } = trpc.activityLogs.list.useQuery({
    userId: selectedUser !== "all" ? parseInt(selectedUser) : undefined,
    activityType: selectedType !== "all" ? selectedType : undefined,
    startDate: dateFilter.startDate,
    endDate: dateFilter.endDate,
    limit,
    offset: page * limit,
  });

  // Get user stats
  const { data: userStats } = trpc.activityLogs.userStats.useQuery({
    startDate: dateFilter.startDate ? new Date(dateFilter.startDate) : undefined,
    endDate: dateFilter.endDate ? new Date(dateFilter.endDate) : undefined,
  });

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

  const totalPages = Math.ceil((logsData?.total || 0) / limit);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
            سجل النشاطات
          </h1>
          <p className="text-muted-foreground mt-2">متابعة جميع نشاطات المستخدمين والموظفين في النظام</p>
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

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-none shadow-lg hover:shadow-xl transition-all duration-300">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-2xl flex items-center justify-center shadow-lg">
                <Users className="w-7 h-7 text-white" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground font-medium">إجمالي المستخدمين</p>
                <p className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                  {(userStats?.length || 0).toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-lg hover:shadow-xl transition-all duration-300">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg">
                <LogIn className="w-7 h-7 text-white" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground font-medium">تسجيلات الدخول</p>
                <p className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                  {(userStats?.reduce((sum, u) => sum + (Number(u.loginCount) || 0), 0) || 0).toLocaleString()}
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
                <p className="text-sm text-muted-foreground font-medium">الطلبات المضافة</p>
                <p className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                  {(userStats?.reduce((sum, u) => sum + (Number(u.orderCreateCount) || 0), 0) || 0).toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-lg hover:shadow-xl transition-all duration-300">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl flex items-center justify-center shadow-lg">
                <TrendingUp className="w-7 h-7 text-white" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground font-medium">إجمالي النشاطات</p>
                <p className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                  {(logsData?.total || 0).toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* User Stats Table */}
      {userStats && userStats.length > 0 && (
        <Card className="border-none shadow-lg">
          <CardHeader className="bg-gradient-to-r from-emerald-50 to-teal-50 border-b">
            <CardTitle className="text-2xl">إحصائيات المستخدمين</CardTitle>
            <CardDescription>عدد النشاطات لكل مستخدم في النظام</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-bold">المستخدم</TableHead>
                    <TableHead className="font-bold">تسجيلات الدخول</TableHead>
                    <TableHead className="font-bold">الطلبات المضافة</TableHead>
                    <TableHead className="font-bold">عرض الصفحات</TableHead>
                    <TableHead className="font-bold">إجمالي النشاطات</TableHead>
                    <TableHead className="font-bold">آخر نشاط</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {userStats.map((stat) => (
                    <TableRow key={stat.userId} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="font-semibold">
                        {stat.userName || stat.username || `مستخدم #${stat.userId}`}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200 text-green-700 font-semibold">
                          {(stat.loginCount || 0).toLocaleString('en-US')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-200 text-emerald-700 font-semibold">
                          {(stat.orderCreateCount || 0).toLocaleString('en-US')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-gradient-to-r from-blue-50 to-cyan-50 border-blue-200 text-blue-700 font-semibold">
                          {(stat.pageViewCount || 0).toLocaleString('en-US')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200 text-purple-700 font-semibold">
                          {(stat.totalActivities || 0).toLocaleString('en-US')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          {stat.lastActivity ? formatDate(stat.lastActivity) : '-'}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Activity Logs Table */}
      <Card className="border-none shadow-lg">
        <CardHeader className="bg-gradient-to-r from-emerald-50 to-teal-50 border-b">
          <CardTitle className="text-2xl">سجل النشاطات التفصيلي</CardTitle>
          <CardDescription>جميع الإجراءات والنشاطات في النظام</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1">
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="جميع المستخدمين" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع المستخدمين</SelectItem>
                  {adminUsers.map((user) => (
                    <SelectItem key={user.id} value={user.id.toString()}>
                      {user.name || user.username}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="جميع الأنواع" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الأنواع</SelectItem>
                  {Object.entries(activityTypeLabels).map(([key, { label }]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
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

          {isLoading ? (
            <div className="text-center py-16">
              <Loader2 className="w-12 h-12 animate-spin mx-auto text-emerald-600" />
              <p className="text-muted-foreground mt-4">جاري التحميل...</p>
            </div>
          ) : !logsData?.logs || logsData.logs.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-24 h-24 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Activity className="w-12 h-12 text-emerald-600" />
              </div>
              <p className="text-xl font-semibold text-muted-foreground">لا توجد نشاطات</p>
              <p className="text-sm text-muted-foreground mt-2">لم يتم تسجيل أي نشاطات بعد</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-bold">المستخدم</TableHead>
                      <TableHead className="font-bold">النوع</TableHead>
                      <TableHead className="font-bold">الوصف</TableHead>
                      <TableHead className="font-bold">التاريخ والوقت</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logsData.logs.map((log) => {
                      const typeInfo = activityTypeLabels[log.activityType] || {
                        label: log.activityType,
                        icon: <Activity className="w-4 h-4" />,
                        color: "bg-gradient-to-r from-gray-400 to-gray-500 text-white"
                      };
                      return (
                        <TableRow key={log.id} className="hover:bg-muted/30 transition-colors">
                          <TableCell className="font-semibold">
                            {log.userName || log.username || `مستخدم #${log.userId}`}
                          </TableCell>
                          <TableCell>
                            <Badge className={`${typeInfo.color} shadow-sm`}>
                              <span className="flex items-center gap-2">
                                {typeInfo.icon}
                                {typeInfo.label}
                              </span>
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {log.description || '-'}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            <div className="flex items-center gap-2">
                              <Calendar className="w-4 h-4" />
                              {formatDate(log.createdAt)}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-3 mt-6">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-300"
                  >
                    السابق
                  </Button>
                  <span className="text-sm font-medium text-muted-foreground px-4 py-2 bg-muted rounded-lg">
                    صفحة {page + 1} من {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1}
                    className="hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-300"
                  >
                    التالي
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
