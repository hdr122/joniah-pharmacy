import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, TrendingUp, Calendar, DollarSign, Package, BarChart3 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function MonthlyPerformance() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  
  const { data: monthlyData, isLoading } = trpc.reports.monthlyPerformance.useQuery({
    year: selectedYear,
  });
  
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 0,
    }).format(price) + " د.ع";
  };
  
  const totalRevenue = monthlyData?.reduce((sum, month) => sum + month.revenue, 0) || 0;
  const totalOrders = monthlyData?.reduce((sum, month) => sum + month.totalOrders, 0) || 0;
  const avgMonthlyRevenue = monthlyData && monthlyData.length > 0 ? totalRevenue / 12 : 0;
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }
  
  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">مقارنة الأداء الشهري</h1>
          <p className="text-gray-600 mt-2">تحليل الإيرادات والطلبات على مدار السنة</p>
        </div>
        <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[currentYear, currentYear - 1, currentYear - 2].map((year) => (
              <SelectItem key={year} value={year.toString()}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">إجمالي الإيرادات</p>
                <p className="text-xl font-bold">{formatPrice(totalRevenue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Package className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">إجمالي الطلبات المسلمة</p>
                <p className="text-2xl font-bold">{totalOrders.toLocaleString('en-US')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">متوسط الإيرادات الشهرية</p>
                <p className="text-xl font-bold">{formatPrice(avgMonthlyRevenue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Data Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-emerald-600" />
            البيانات الشهرية - {selectedYear}
          </CardTitle>
          <CardDescription>تفاصيل الأداء لكل شهر</CardDescription>
        </CardHeader>
        <CardContent>
          {!monthlyData || monthlyData.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Calendar className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>لا توجد بيانات</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الشهر</TableHead>
                  <TableHead>عدد الطلبات المسلمة</TableHead>
                  <TableHead>الإيرادات</TableHead>
                  <TableHead>متوسط قيمة الطلب</TableHead>
                  <TableHead>معدل التسليم</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {monthlyData.map((month: any) => (
                  <TableRow key={month.month}>
                    <TableCell className="font-medium">{month.monthName}</TableCell>
                    <TableCell>{month.totalOrders.toLocaleString('en-US')}</TableCell>
                    <TableCell>{formatPrice(month.revenue)}</TableCell>
                    <TableCell>{formatPrice(month.avgOrderValue)}</TableCell>
                    <TableCell>{Number(month.deliveryRate.toFixed(1)).toLocaleString('en-US')}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Visual Chart Placeholder */}
      <Card>
        <CardHeader>
          <CardTitle>الرسم البياني الشهري</CardTitle>
          <CardDescription>مقارنة الإيرادات عبر الأشهر</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg">
            <div className="text-center text-gray-500">
              <BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>الرسم البياني سيتم إضافته قريباً</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
