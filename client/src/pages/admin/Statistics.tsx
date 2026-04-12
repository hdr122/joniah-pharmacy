import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, TrendingUp, MapPin, Users, DollarSign } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

export default function Statistics() {
  const { data: stats, isLoading } = trpc.stats.advanced.useQuery();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  const regionData = stats?.byRegion?.map((r: any) => ({
    name: r.regionName,
    طلبات: r.orderCount,
    أرباح: r.revenue,
  })) || [];

  const deliveryData = stats?.byDelivery?.map((d: any) => ({
    name: d.deliveryName,
    مسلمة: d.deliveredCount,
    مؤجلة: d.postponedCount,
    نشطة: d.activeCount,
  })) || [];

  const statusData = [
    { name: "قيد الانتظار", value: stats?.byStatus?.pending || 0 },
    { name: "تم التسليم", value: stats?.byStatus?.delivered || 0 },
    { name: "مؤجلة", value: stats?.byStatus?.postponed || 0 },
    { name: "ملغاة", value: stats?.byStatus?.cancelled || 0 },
  ].filter(item => item.value > 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">الإحصائيات المتقدمة</h1>
        <p className="text-gray-600 mt-2">تحليل شامل للطلبات والأداء</p>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-emerald-500">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-gray-600 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              إجمالي الإيرادات
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-emerald-600">
              {(stats?.totalRevenue || 0).toLocaleString('en-US')} د.ع
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-gray-600 flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              أكثر منطقة طلبات
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-600">
              {stats?.topRegion?.regionName || "-"}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {stats?.topRegion?.orderCount || 0} طلب
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-gray-600 flex items-center gap-2">
              <Users className="w-4 h-4" />
              أكثر مندوب نشاطاً
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-purple-600">
              {stats?.topDelivery?.deliveryName || "-"}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {stats?.topDelivery?.deliveredCount || 0} طلب مسلم
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-gray-600 flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              متوسط قيمة الطلب
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-orange-600">
              {(stats?.averageOrderValue || 0).toLocaleString('en-US')} د.ع
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Region Chart */}
        <Card>
          <CardHeader>
            <CardTitle>الطلبات حسب المناطق</CardTitle>
            <CardDescription>عدد الطلبات والإيرادات لكل منطقة</CardDescription>
          </CardHeader>
          <CardContent>
            {regionData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={regionData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip />
                  <Legend />
                  <Bar yAxisId="left" dataKey="طلبات" fill="#10b981" />
                  <Bar yAxisId="right" dataKey="أرباح" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-12 text-gray-500">
                لا توجد بيانات
              </div>
            )}
          </CardContent>
        </Card>

        {/* Status Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle>توزيع حالات الطلبات</CardTitle>
            <CardDescription>نسبة الطلبات حسب الحالة</CardDescription>
          </CardHeader>
          <CardContent>
            {statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry) => `${entry.name}: ${entry.value}`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-12 text-gray-500">
                لا توجد بيانات
              </div>
            )}
          </CardContent>
        </Card>

        {/* Delivery Performance Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>أداء المندوبين</CardTitle>
            <CardDescription>الطلبات المسلمة والمؤجلة والنشطة لكل مندوب</CardDescription>
          </CardHeader>
          <CardContent>
            {deliveryData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={deliveryData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="مسلمة" fill="#10b981" />
                  <Bar dataKey="مؤجلة" fill="#f59e0b" />
                  <Bar dataKey="نشطة" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-12 text-gray-500">
                لا توجد بيانات
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detailed Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Region Details */}
        <Card>
          <CardHeader>
            <CardTitle>تفاصيل المناطق</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats?.byRegion?.map((region: any, index: number) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-gray-900">{region.regionName}</p>
                    <p className="text-sm text-gray-600">{region.orderCount} طلب</p>
                  </div>
                  <div className="text-left">
                    <p className="text-lg font-bold text-emerald-600">
                      {region.revenue.toLocaleString('en-US')} د.ع
                    </p>
                  </div>
                </div>
              ))}
              {(!stats?.byRegion || stats.byRegion.length === 0) && (
                <div className="text-center py-8 text-gray-500">
                  لا توجد بيانات
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Delivery Details */}
        <Card>
          <CardHeader>
            <CardTitle>تفاصيل المندوبين</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats?.byDelivery?.map((delivery: any, index: number) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-gray-900">{delivery.deliveryName}</p>
                    <div className="flex gap-3 mt-1 text-sm">
                      <span className="text-green-600">✓ {delivery.deliveredCount}</span>
                      <span className="text-orange-600">⏸ {delivery.postponedCount}</span>
                      <span className="text-blue-600">● {delivery.activeCount}</span>
                    </div>
                  </div>
                  <div className="text-left">
                    <p className="text-lg font-bold text-gray-900">
                      {delivery.totalOrders} طلب
                    </p>
                  </div>
                </div>
              ))}
              {(!stats?.byDelivery || stats.byDelivery.length === 0) && (
                <div className="text-center py-8 text-gray-500">
                  لا توجد بيانات
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
