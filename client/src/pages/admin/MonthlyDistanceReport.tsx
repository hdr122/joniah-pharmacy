import { useState } from "react";
import { Calendar, Download, TrendingUp, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import * as XLSX from 'xlsx';

export default function MonthlyDistanceReport() {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  
  // Get monthly distances
  const { data: monthlyData, isLoading } = trpc.gps.getMonthlyDistances.useQuery({
    year: selectedYear,
    month: selectedMonth
  });
  
  const handleExportExcel = () => {
    if (!monthlyData || monthlyData.deliveries.length === 0) {
      toast.error("لا توجد بيانات للتصدير");
      return;
    }
    
    try {
      // Prepare data for Excel
      const excelData = monthlyData.deliveries.map((delivery, index) => ({
        '#': index + 1,
        'المندوب': delivery.username,
        'المسافة (كم)': delivery.totalDistance.toFixed(2),
        'عدد الطلبات المسلمة': delivery.deliveredOrders,
        'متوسط المسافة لكل طلب': delivery.averageDistancePerOrder.toFixed(2),
        'عدد نقاط التتبع': delivery.trackingPoints
      }));
      
      // Add summary row
      excelData.push({
        '#': 0,
        'المندوب': 'الإجمالي',
        'المسافة (كم)': monthlyData.totalDistance.toFixed(2),
        'عدد الطلبات المسلمة': monthlyData.totalDeliveredOrders,
        'متوسط المسافة لكل طلب': (monthlyData.totalDistance / monthlyData.totalDeliveredOrders).toFixed(2),
        'عدد نقاط التتبع': monthlyData.totalTrackingPoints
      });
      
      const ws = XLSX.utils.json_to_sheet(excelData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, `${selectedYear}-${selectedMonth.toString().padStart(2, '0')}`);
      
      const monthName = new Date(selectedYear, selectedMonth - 1).toLocaleDateString('ar-IQ', { month: 'long' });
      XLSX.writeFile(wb, `تقرير_المسافات_${monthName}_${selectedYear}.xlsx`);
      
      toast.success("تم تصدير التقرير بنجاح");
    } catch (error) {
      console.error('Export error:', error);
      toast.error("فشل تصدير التقرير");
    }
  };
  
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
  const months = [
    { value: 1, label: 'يناير' },
    { value: 2, label: 'فبراير' },
    { value: 3, label: 'مارس' },
    { value: 4, label: 'أبريل' },
    { value: 5, label: 'مايو' },
    { value: 6, label: 'يونيو' },
    { value: 7, label: 'يوليو' },
    { value: 8, label: 'أغسطس' },
    { value: 9, label: 'سبتمبر' },
    { value: 10, label: 'أكتوبر' },
    { value: 11, label: 'نوفمبر' },
    { value: 12, label: 'ديسمبر' }
  ];
  
  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">تقرير المسافات الشهري</h1>
          <p className="text-muted-foreground mt-2">
            عرض المسافات التي قطعها كل مندوب خلال الشهر
          </p>
        </div>
        
        <Button onClick={handleExportExcel} disabled={!monthlyData || monthlyData.deliveries.length === 0}>
          <Download className="h-4 w-4 mr-2" />
          تصدير Excel
        </Button>
      </div>
      
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            اختر الشهر والسنة
          </CardTitle>
        </CardHeader>
        <CardContent className="flex gap-4">
          <div className="flex-1">
            <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
              <SelectTrigger>
                <SelectValue placeholder="اختر السنة" />
              </SelectTrigger>
              <SelectContent>
                {years.map(year => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex-1">
            <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
              <SelectTrigger>
                <SelectValue placeholder="اختر الشهر" />
              </SelectTrigger>
              <SelectContent>
                {months.map(month => (
                  <SelectItem key={month.value} value={month.value.toString()}>
                    {month.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
      
      {/* Summary Cards */}
      {monthlyData && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">إجمالي المسافة</CardTitle>
              <MapPin className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{monthlyData.totalDistance.toFixed(2)} كم</div>
              <p className="text-xs text-muted-foreground">
                جميع المندوبين
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">الطلبات المسلمة</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{monthlyData.totalDeliveredOrders}</div>
              <p className="text-xs text-muted-foreground">
                طلب مسلم
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">متوسط المسافة/طلب</CardTitle>
              <MapPin className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {monthlyData.totalDeliveredOrders > 0 
                  ? (monthlyData.totalDistance / monthlyData.totalDeliveredOrders).toFixed(2)
                  : '0.00'
                } كم
              </div>
              <p className="text-xs text-muted-foreground">
                لكل طلب
              </p>
            </CardContent>
          </Card>
        </div>
      )}
      
      {/* Deliveries Table */}
      <Card>
        <CardHeader>
          <CardTitle>تفاصيل المندوبين</CardTitle>
          <CardDescription>
            المسافات المقطوعة لكل مندوب خلال الشهر المحدد
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              جاري التحميل...
            </div>
          ) : !monthlyData || monthlyData.deliveries.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              لا توجد بيانات لهذا الشهر
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-right p-3">#</th>
                    <th className="text-right p-3">المندوب</th>
                    <th className="text-right p-3">المسافة (كم)</th>
                    <th className="text-right p-3">الطلبات المسلمة</th>
                    <th className="text-right p-3">متوسط المسافة/طلب</th>
                    <th className="text-right p-3">نقاط التتبع</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyData.deliveries.map((delivery, index) => (
                    <tr key={delivery.userId} className="border-b hover:bg-muted/50">
                      <td className="p-3">{index + 1}</td>
                      <td className="p-3 font-medium">{delivery.username}</td>
                      <td className="p-3">{delivery.totalDistance.toFixed(2)}</td>
                      <td className="p-3">{delivery.deliveredOrders}</td>
                      <td className="p-3">{delivery.averageDistancePerOrder.toFixed(2)}</td>
                      <td className="p-3">{delivery.trackingPoints}</td>
                    </tr>
                  ))}
                  <tr className="bg-muted/30 font-bold">
                    <td className="p-3" colSpan={2}>الإجمالي</td>
                    <td className="p-3">{monthlyData.totalDistance.toFixed(2)}</td>
                    <td className="p-3">{monthlyData.totalDeliveredOrders}</td>
                    <td className="p-3">
                      {monthlyData.totalDeliveredOrders > 0 
                        ? (monthlyData.totalDistance / monthlyData.totalDeliveredOrders).toFixed(2)
                        : '0.00'
                      }
                    </td>
                    <td className="p-3">{monthlyData.totalTrackingPoints}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
