import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Package, Users, TrendingUp, MapPin, Loader2, Award, Clock, DollarSign } from "lucide-react";
import { Link } from "wouter";
import { formatNumber, formatCurrency } from "@/lib/numberUtils";
import { DateFilterDropdown, type DateFilterValue } from "@/components/DateFilterDropdown";

export default function AdminDashboard() {
  const [dateFilter, setDateFilter] = useState<DateFilterValue>(() => {
    // Initialize with "today" - day starts at 5 AM
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
  
  const [viewMode, setViewMode] = useState<'filtered' | 'all'>('filtered');
  
  const { data: filteredStats, isLoading: loadingFiltered } = trpc.stats.byDateRange.useQuery(
    {
      startDate: dateFilter.startDate!,
      endDate: dateFilter.endDate!
    },
    {
      enabled: viewMode === 'filtered' && !!dateFilter.startDate && !!dateFilter.endDate,
    }
  );
  
  const { data: allStats, isLoading: loadingAll } = trpc.stats.allTime.useQuery(undefined, {
    enabled: viewMode === 'all',
  });
  
  const stats = viewMode === 'filtered' ? filteredStats : allStats;
  const isLoading = viewMode === 'filtered' ? loadingFiltered : loadingAll;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-12 h-12 animate-spin text-emerald-600" />
      </div>
    );
  }

  const cards = [
    {
      title: "إجمالي الطلبات",
      value: stats?.totalOrders || 0,
      icon: Package,
      gradient: "from-blue-500 to-cyan-600",
      link: "/admin/orders",
    },
    {
      title: "المندوبين النشطين",
      value: stats?.activeDeliveries || 0,
      icon: Users,
      gradient: "from-emerald-500 to-teal-600",
      link: "/admin/deliveries",
    },
    {
      title: "الطلبات المسلمة",
      value: stats?.deliveredOrders || 0,
      icon: TrendingUp,
      gradient: "from-green-500 to-emerald-600",
      link: "/admin/orders?status=delivered",
    },
    {
      title: "المناطق المخدومة",
      value: stats?.totalRegions || 0,
      icon: MapPin,
      gradient: "from-purple-500 to-pink-600",
      link: "/admin/regions",
    },
  ];

  return (
    <div className="space-y-8 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
            لوحة التحكم
          </h1>
          <p className="text-muted-foreground mt-2">مرحباً بك في نظام إدارة صيدلية جونيا</p>
        </div>
        <div className="flex gap-3">
          <DateFilterDropdown
            value={dateFilter}
            onChange={(newFilter) => {
              setDateFilter(newFilter);
              setViewMode('filtered');
            }}
          />
          <Button
            variant={viewMode === 'all' ? 'default' : 'outline'}
            onClick={() => setViewMode('all')}
            className={viewMode === 'all' ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700' : 'hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-300'}
          >
            الإحصائيات الكلية
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card) => (
          <Link key={card.title} href={card.link}>
            <Card className="border-none shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer group overflow-hidden relative">
              <div className={`absolute inset-0 bg-gradient-to-br ${card.gradient} opacity-0 group-hover:opacity-5 transition-opacity`} />
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {card.title}
                </CardTitle>
                <div className={`p-3 rounded-2xl bg-gradient-to-br ${card.gradient} shadow-lg`}>
                  <card.icon className="w-6 h-6 text-white" />
                </div>
              </CardHeader>
              <CardContent>
                <div className={`text-4xl font-bold bg-gradient-to-r ${card.gradient} bg-clip-text text-transparent`}>
                  {formatNumber(card.value)}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Orders */}
        <Card className="border-none shadow-lg">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-cyan-50 border-b">
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-blue-600" />
              <CardTitle className="text-xl">الطلبات الأخيرة</CardTitle>
            </div>
            <CardDescription>آخر 5 طلبات تم إضافتها</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            {stats?.recentOrders && stats.recentOrders.length > 0 ? (
              <div className="space-y-3">
                {stats.recentOrders.map((order: any) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl hover:shadow-md transition-all"
                  >
                    <div>
                      <p className="font-bold text-gray-900">طلب #{order.id}</p>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {order.region}
                      </p>
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-emerald-600 text-lg">
                        {formatCurrency(order.price)}
                      </p>
                      <p className="text-xs text-muted-foreground">{order.status}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-cyan-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Package className="w-10 h-10 text-blue-600" />
                </div>
                <p className="text-muted-foreground">لا توجد طلبات حالياً</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Deliveries */}
        <Card className="border-none shadow-lg">
          <CardHeader className="bg-gradient-to-r from-emerald-50 to-teal-50 border-b">
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-emerald-600" />
              <CardTitle className="text-xl">أفضل المندوبين</CardTitle>
            </div>
            <CardDescription>حسب عدد الطلبات المسلمة</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            {stats?.topDeliveries && stats.topDeliveries.length > 0 ? (
              <div className="space-y-3">
                {stats.topDeliveries.map((delivery: any, index: number) => (
                  <div
                    key={delivery.id}
                    className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl hover:shadow-md transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white shadow-lg ${
                        index === 0 ? 'bg-gradient-to-br from-yellow-400 to-yellow-600' :
                        index === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-500' :
                        index === 2 ? 'bg-gradient-to-br from-orange-400 to-orange-600' :
                        'bg-gradient-to-br from-blue-400 to-blue-600'
                      }`}>
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-bold text-gray-900">{delivery.name}</p>
                        <p className="text-sm text-muted-foreground">@{delivery.username}</p>
                      </div>
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-emerald-600 text-lg">
                        {formatNumber(delivery.deliveredCount)}
                      </p>
                      <p className="text-xs text-muted-foreground">طلب</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="w-20 h-20 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Users className="w-10 h-10 text-emerald-600" />
                </div>
                <p className="text-muted-foreground">لا توجد بيانات حالياً</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Regions */}
        <Card className="border-none shadow-lg">
          <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 border-b">
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-purple-600" />
              <CardTitle className="text-xl">أكثر المناطق طلباً</CardTitle>
            </div>
            <CardDescription>حسب عدد الطلبات</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            {stats?.topRegions && stats.topRegions.length > 0 ? (
              <div className="space-y-3">
                {stats.topRegions.map((region: any, index: number) => {
                  const total = stats.topRegions.reduce((sum: number, r: any) => sum + (r.orderCount || 0), 0);
                  const percentage = total > 0 ? ((region.orderCount / total) * 100).toFixed(1) : 0;
                  
                  return (
                    <div
                      key={region.id}
                      className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl hover:shadow-md transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white shadow-lg ${
                          index === 0 ? 'bg-gradient-to-br from-yellow-400 to-yellow-600' :
                          index === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-500' :
                          index === 2 ? 'bg-gradient-to-br from-orange-400 to-orange-600' :
                          'bg-gradient-to-br from-purple-400 to-purple-600'
                        }`}>
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-bold text-gray-900">{region.name}</p>
                          <p className="text-sm text-muted-foreground">{percentage}% من الطلبات</p>
                        </div>
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-purple-600 text-lg">
                          {formatNumber(region.orderCount)}
                        </p>
                        <p className="text-xs text-muted-foreground">طلب</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="w-20 h-20 bg-gradient-to-br from-purple-100 to-pink-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <MapPin className="w-10 h-10 text-purple-600" />
                </div>
                <p className="text-muted-foreground">لا توجد بيانات حالياً</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="border-none shadow-lg bg-gradient-to-r from-emerald-50 to-teal-50">
        <CardHeader>
          <CardTitle className="text-2xl">الإجراءات السريعة</CardTitle>
          <CardDescription>الوصول السريع إلى الصفحات الأكثر استخداماً</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link href="/admin/orders/create">
              <Button className="w-full h-auto py-6 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-lg">
                <div className="flex flex-col items-center gap-2">
                  <Package className="w-6 h-6" />
                  <span>إضافة طلب جديد</span>
                </div>
              </Button>
            </Link>
            <Link href="/admin/orders">
              <Button variant="outline" className="w-full h-auto py-6 border-2 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-300">
                <div className="flex flex-col items-center gap-2">
                  <Package className="w-6 h-6" />
                  <span>إدارة الطلبات</span>
                </div>
              </Button>
            </Link>
            <Link href="/admin/statistics">
              <Button variant="outline" className="w-full h-auto py-6 border-2 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-300">
                <div className="flex flex-col items-center gap-2">
                  <TrendingUp className="w-6 h-6" />
                  <span>الإحصائيات المتقدمة</span>
                </div>
              </Button>
            </Link>
            <Link href="/admin/deliveries">
              <Button variant="outline" className="w-full h-auto py-6 border-2 hover:bg-purple-50 hover:text-purple-600 hover:border-purple-300">
                <div className="flex flex-col items-center gap-2">
                  <Users className="w-6 h-6" />
                  <span>إدارة المندوبين</span>
                </div>
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
