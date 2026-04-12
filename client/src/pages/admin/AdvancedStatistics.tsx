import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  FileDown,
  Package,
  TrendingUp,
  DollarSign,
  CheckCircle,
  Clock,
  TrendingDown,
  Users,
  MapPin,
  BarChart3,
  X,
  Filter,
  Activity,
  Target,
  Award,
  Zap,
} from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import * as XLSX from "xlsx";
import { DateFilterDropdown, DateFilterValue } from "@/components/DateFilterDropdown";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function AdvancedStatistics() {
  const [dateFilter, setDateFilter] = useState<DateFilterValue>({
    type: 'thisMonth',
    label: 'هذا الشهر',
  });
  const [selectedRegions, setSelectedRegions] = useState<number[]>([]);
  const [selectedDeliveryPersons, setSelectedDeliveryPersons] = useState<number[]>([]);

  // جلب قائمة المناطق والمندوبين
  const { data: regions } = trpc.regions.getAll.useQuery();
  const { data: deliveryPersons } = trpc.users.getDeliveryPersons.useQuery();

  // بناء query parameters من الفلاتر
  const queryParams = useMemo(() => {
    const params: any = {};

    // فلتر التاريخ
    if (dateFilter && dateFilter.startDate && dateFilter.endDate) {
      params.startDate = dateFilter.startDate;
      params.endDate = dateFilter.endDate;
    }

    // فلتر المناطق
    if (selectedRegions.length > 0) {
      params.regionIds = selectedRegions;
    }

    // فلتر المندوبين
    if (selectedDeliveryPersons.length > 0) {
      params.deliveryPersonIds = selectedDeliveryPersons;
    }

    return params;
  }, [dateFilter, selectedRegions, selectedDeliveryPersons]);

  const { data: stats, isLoading } = trpc.stats.custom.useQuery(queryParams);

  // دوال إضافة/إزالة المناطق
  const toggleRegion = (regionId: number) => {
    setSelectedRegions((prev) =>
      prev.includes(regionId) ? prev.filter((id) => id !== regionId) : [...prev, regionId]
    );
  };

  // دوال إضافة/إزالة المندوبين
  const toggleDeliveryPerson = (personId: number) => {
    setSelectedDeliveryPersons((prev) =>
      prev.includes(personId) ? prev.filter((id) => id !== personId) : [...prev, personId]
    );
  };

  // مسح جميع الفلاتر
  const clearAllFilters = () => {
    setSelectedRegions([]);
    setSelectedDeliveryPersons([]);
    setDateFilter({
      type: 'thisMonth',
      label: 'هذا الشهر',
    });
    toast.success("تم مسح جميع الفلاتر");
  };

  // عدد الفلاتر النشطة
  const activeFiltersCount =
    selectedRegions.length + selectedDeliveryPersons.length + (dateFilter.type !== 'thisMonth' ? 1 : 0);

  const handleExportExcel = () => {
    if (!stats) {
      toast.error("لا توجد بيانات لتصديرها");
      return;
    }

    const today = new Date().toLocaleDateString("ar-IQ", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    // إعداد بيانات التقرير الشامل
    const worksheetData = [
      ["صيدلية جونيا - تقرير الإحصائيات المتقدم"],
      ["التاريخ: " + today],
      [],
      ["ملخص الإحصائيات العامة"],
      ["البيان", "القيمة"],
      ["إجمالي الطلبات", stats.totalOrders],
      ["الإيرادات الكلية", stats.totalRevenue + " دينار"],
      ["متوسط قيمة الطلب", stats.averageOrderValue + " دينار"],
      ["معدل النجاح", ((stats.byStatus.delivered / stats.totalOrders) * 100).toFixed(2) + "%"],
      [],
      ["توزيع الطلبات حسب الحالة"],
      ["الحالة", "العدد", "النسبة"],
      [
        "الطلبات المسلمة",
        stats.byStatus.delivered,
        ((stats.byStatus.delivered / stats.totalOrders) * 100).toFixed(2) + "%",
      ],
      [
        "الطلبات قيد الانتظار",
        stats.byStatus.pending,
        ((stats.byStatus.pending / stats.totalOrders) * 100).toFixed(2) + "%",
      ],
      [
        "الطلبات المؤجلة",
        stats.byStatus.postponed,
        ((stats.byStatus.postponed / stats.totalOrders) * 100).toFixed(2) + "%",
      ],
      [
        "الطلبات المرجوعة",
        stats.byStatus.returned,
        ((stats.byStatus.returned / stats.totalOrders) * 100).toFixed(2) + "%",
      ],
      [
        "الطلبات الملغاة",
        stats.byStatus.cancelled,
        ((stats.byStatus.cancelled / stats.totalOrders) * 100).toFixed(2) + "%",
      ],
      [],
      ["توزيع الطلبات حسب المناطق"],
      ["المنطقة", "عدد الطلبات", "الإيرادات"],
      ...(stats.byRegion || []).map((r: any) => [r.regionName, r.orderCount, r.totalRevenue + " دينار"]),
      [],
      ["توزيع الطلبات حسب المندوبين"],
      ["المندوب", "عدد الطلبات", "الإيرادات"],
      ...(stats.byDeliveryPerson || []).map((d: any) => [
        d.deliveryPersonName,
        d.orderCount,
        d.totalRevenue + " دينار",
      ]),
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "الإحصائيات المتقدمة");

    XLSX.writeFile(workbook, `إحصائيات_متقدمة_${today}.xlsx`);
    toast.success("تم تصدير التقرير بنجاح");
  };

  const handleExportPDF = async () => {
    if (!stats) {
      toast.error("لا توجد بيانات لتصديرها");
      return;
    }

    toast.info("جاري إنشاء ملف PDF...");

    try {
      const element = document.getElementById("stats-content");
      if (!element) {
        toast.error("فشل في العثور على المحتوى");
        return;
      }

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const imgWidth = 210;
      const pageHeight = 297;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      const today = new Date().toLocaleDateString("ar-IQ", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      pdf.save(`إحصائيات_متقدمة_${today}.pdf`);
      toast.success("تم تصدير PDF بنجاح");
    } catch (error) {
      console.error("Error exporting PDF:", error);
      toast.error("فشل في تصدير PDF");
    }
  };

  // إعداد بيانات الرسوم البيانية
  const statusChartData = useMemo(() => {
    if (!stats) return [];
    return [
      { name: "مسلمة", value: stats.byStatus.delivered, color: "#10b981", percentage: ((stats.byStatus.delivered / stats.totalOrders) * 100).toFixed(1) },
      { name: "قيد الانتظار", value: stats.byStatus.pending, color: "#f59e0b", percentage: ((stats.byStatus.pending / stats.totalOrders) * 100).toFixed(1) },
      { name: "مؤجلة", value: stats.byStatus.postponed, color: "#3b82f6", percentage: ((stats.byStatus.postponed / stats.totalOrders) * 100).toFixed(1) },
      { name: "مرجوعة", value: stats.byStatus.returned, color: "#8b5cf6", percentage: ((stats.byStatus.returned / stats.totalOrders) * 100).toFixed(1) },
      { name: "ملغاة", value: stats.byStatus.cancelled, color: "#ef4444", percentage: ((stats.byStatus.cancelled / stats.totalOrders) * 100).toFixed(1) },
    ];
  }, [stats]);

  const regionChartData = useMemo(() => {
    if (!stats || !stats.byRegion) return [];
    return stats.byRegion
      .map((r: any) => ({
        name: r.regionName.length > 15 ? r.regionName.substring(0, 15) + '...' : r.regionName,
        fullName: r.regionName,
        orders: r.orderCount,
        revenue: r.totalRevenue,
      }))
      .sort((a, b) => b.orders - a.orders)
      .slice(0, 10); // أفضل 10 مناطق
  }, [stats]);

  const deliveryChartData = useMemo(() => {
    if (!stats || !stats.byDeliveryPerson) return [];
    return stats.byDeliveryPerson
      .map((d: any) => ({
        name: d.deliveryPersonName,
        orders: d.orderCount,
        revenue: d.totalRevenue,
      }))
      .sort((a, b) => b.orders - a.orders)
      .slice(0, 8); // أفضل 8 مندوبين
  }, [stats]);

  // بيانات الرادار للأداء الشامل
  const performanceRadarData = useMemo(() => {
    if (!stats) return [];
    const total = stats.totalOrders;
    return [
      {
        metric: "معدل التسليم",
        value: ((stats.byStatus.delivered / total) * 100).toFixed(0),
        fullMark: 100,
      },
      {
        metric: "معدل الإلغاء",
        value: (100 - ((stats.byStatus.cancelled / total) * 100)).toFixed(0),
        fullMark: 100,
      },
      {
        metric: "معدل الإرجاع",
        value: (100 - ((stats.byStatus.returned / total) * 100)).toFixed(0),
        fullMark: 100,
      },
      {
        metric: "كفاءة التوصيل",
        value: ((stats.byStatus.delivered / (stats.byStatus.delivered + stats.byStatus.pending)) * 100).toFixed(0),
        fullMark: 100,
      },
      {
        metric: "الأداء العام",
        value: (((stats.byStatus.delivered + stats.byStatus.pending) / total) * 100).toFixed(0),
        fullMark: 100,
      },
    ];
  }, [stats]);

  // Custom Tooltip للرسوم البيانية
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border-2 border-emerald-200 p-4 rounded-xl shadow-2xl">
          <p className="font-bold text-gray-900 mb-2 text-base">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm font-medium" style={{ color: entry.color }}>
              {entry.name}: {entry.value.toLocaleString()}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  // Custom Label للـ Pie Chart
  const renderCustomLabel = (entry: any) => {
    return `${entry.percentage}%`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-blue-50 p-6">
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="relative">
              <div className="animate-spin rounded-full h-20 w-20 border-8 border-emerald-200 border-t-emerald-600 mx-auto"></div>
              <Activity className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 h-8 w-8 text-emerald-600" />
            </div>
            <p className="mt-6 text-lg font-semibold text-gray-700">جاري تحميل الإحصائيات المتقدمة...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-blue-50 p-6">
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <Package className="h-20 w-20 text-gray-400 mx-auto mb-4" />
            <p className="text-xl font-semibold text-gray-600">لا توجد بيانات لعرضها</p>
            <p className="text-gray-500 mt-2">قم بتطبيق فلاتر مختلفة لعرض الإحصائيات</p>
          </div>
        </div>
      </div>
    );
  }

  const successRate = ((stats.byStatus.delivered / stats.totalOrders) * 100).toFixed(1);
  const returnRate = ((stats.byStatus.returned / stats.totalOrders) * 100).toFixed(1);
  const cancelRate = ((stats.byStatus.cancelled / stats.totalOrders) * 100).toFixed(1);

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-blue-50">
      <div className="container mx-auto p-6 space-y-8" id="stats-content">
        {/* Header with Gradient */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 p-8 shadow-2xl">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-10 rounded-full -mr-32 -mt-32"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white opacity-10 rounded-full -ml-24 -mb-24"></div>
          
          <div className="relative z-10">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <BarChart3 className="h-10 w-10 text-white" />
                  <h1 className="text-4xl font-bold text-white">الإحصائيات المتقدمة</h1>
                </div>
                <p className="text-emerald-50 text-lg">تحليل شامل ومتقدم لأداء الطلبات والمندوبين والمناطق</p>
              </div>
              <div className="flex gap-3">
                <Button 
                  onClick={handleExportExcel} 
                  className="bg-white text-emerald-600 hover:bg-emerald-50 font-semibold shadow-lg"
                >
                  <FileDown className="h-5 w-5 ml-2" />
                  تصدير Excel
                </Button>
                <Button 
                  onClick={handleExportPDF} 
                  className="bg-white text-emerald-600 hover:bg-emerald-50 font-semibold shadow-lg"
                >
                  <FileDown className="h-5 w-5 ml-2" />
                  تصدير PDF
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Filters Section with Modern Design */}
        <Card className="border-2 border-emerald-100 shadow-xl rounded-2xl overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-emerald-50 to-teal-50 border-b-2 border-emerald-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 rounded-lg">
                  <Filter className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <CardTitle className="text-2xl text-gray-900">الفلاتر المتقدمة</CardTitle>
                  <CardDescription className="text-base">اختر الفلاتر لتخصيص التقرير</CardDescription>
                </div>
              </div>
              {activeFiltersCount > 0 && (
                <Button
                  onClick={clearAllFilters}
                  variant="outline"
                  className="gap-2 border-2 border-red-200 text-red-600 hover:bg-red-50 font-semibold"
                >
                  <X className="h-4 w-4" />
                  مسح الكل ({activeFiltersCount.toLocaleString()})
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* فلتر التاريخ */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-emerald-600" />
                  الفترة الزمنية
                </label>
                <DateFilterDropdown value={dateFilter} onChange={setDateFilter} />
              </div>

              {/* فلتر المناطق */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-emerald-600" />
                  المناطق ({selectedRegions.length.toLocaleString()})
                </label>
                <Select
                  value=""
                  onValueChange={(value) => toggleRegion(parseInt(value))}
                >
                  <SelectTrigger className="border-2 border-gray-200 focus:border-emerald-400">
                    <SelectValue placeholder="اختر منطقة..." />
                  </SelectTrigger>
                  <SelectContent>
                    {regions?.map((region) => (
                      <SelectItem key={region.id} value={region.id.toString()}>
                        {region.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex flex-wrap gap-2 mt-2">
                  {selectedRegions.map((regionId) => {
                    const region = regions?.find((r) => r.id === regionId);
                    return (
                      <Badge
                        key={regionId}
                        className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 cursor-pointer px-3 py-1"
                        onClick={() => toggleRegion(regionId)}
                      >
                        {region?.name}
                        <X className="h-3 w-3 mr-1" />
                      </Badge>
                    );
                  })}
                </div>
              </div>

              {/* فلتر المندوبين */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Users className="h-4 w-4 text-emerald-600" />
                  المندوبين ({selectedDeliveryPersons.length.toLocaleString()})
                </label>
                <Select
                  value=""
                  onValueChange={(value) => toggleDeliveryPerson(parseInt(value))}
                >
                  <SelectTrigger className="border-2 border-gray-200 focus:border-emerald-400">
                    <SelectValue placeholder="اختر مندوب..." />
                  </SelectTrigger>
                  <SelectContent>
                    {deliveryPersons?.map((person) => (
                      <SelectItem key={person.id} value={person.id.toString()}>
                        {person.name || person.username}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex flex-wrap gap-2 mt-2">
                  {selectedDeliveryPersons.map((personId) => {
                    const person = deliveryPersons?.find((p) => p.id === personId);
                    return (
                      <Badge
                        key={personId}
                        className="bg-blue-100 text-blue-700 hover:bg-blue-200 cursor-pointer px-3 py-1"
                        onClick={() => toggleDeliveryPerson(personId)}
                      >
                        {person?.name || person?.username}
                        <X className="h-3 w-3 mr-1" />
                      </Badge>
                    );
                  })}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KPI Cards with Modern Gradient Design */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="border-0 shadow-xl rounded-2xl overflow-hidden bg-gradient-to-br from-emerald-500 to-emerald-600 text-white transform hover:scale-105 transition-transform duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-emerald-100 text-sm font-medium mb-1">إجمالي الطلبات</p>
                  <p className="text-4xl font-bold">{stats.totalOrders.toLocaleString()}</p>
                </div>
                <div className="p-4 bg-white bg-opacity-20 rounded-2xl">
                  <Package className="h-10 w-10" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-xl rounded-2xl overflow-hidden bg-gradient-to-br from-blue-500 to-blue-600 text-white transform hover:scale-105 transition-transform duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100 text-sm font-medium mb-1">إجمالي الإيرادات</p>
                  <p className="text-4xl font-bold">{stats.totalRevenue.toLocaleString()}</p>
                  <p className="text-blue-100 text-xs mt-1">دينار عراقي</p>
                </div>
                <div className="p-4 bg-white bg-opacity-20 rounded-2xl">
                  <DollarSign className="h-10 w-10" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-xl rounded-2xl overflow-hidden bg-gradient-to-br from-green-500 to-green-600 text-white transform hover:scale-105 transition-transform duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-100 text-sm font-medium mb-1">معدل النجاح</p>
                  <p className="text-4xl font-bold">{successRate}%</p>
                  <p className="text-green-100 text-xs mt-1">{stats.byStatus.delivered.toLocaleString()} طلب مسلم</p>
                </div>
                <div className="p-4 bg-white bg-opacity-20 rounded-2xl">
                  <CheckCircle className="h-10 w-10" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-xl rounded-2xl overflow-hidden bg-gradient-to-br from-amber-500 to-amber-600 text-white transform hover:scale-105 transition-transform duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-amber-100 text-sm font-medium mb-1">متوسط قيمة الطلب</p>
                  <p className="text-4xl font-bold">{stats.averageOrderValue.toLocaleString()}</p>
                  <p className="text-amber-100 text-xs mt-1">دينار عراقي</p>
                </div>
                <div className="p-4 bg-white bg-opacity-20 rounded-2xl">
                  <TrendingUp className="h-10 w-10" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Performance Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-2 border-green-200 shadow-lg rounded-2xl overflow-hidden hover:shadow-2xl transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-4 bg-green-100 rounded-xl">
                  <Target className="h-8 w-8 text-green-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-600 font-medium">الطلبات المسلمة</p>
                  <p className="text-3xl font-bold text-gray-900">{stats.byStatus.delivered.toLocaleString()}</p>
                  <div className="mt-2 bg-green-100 rounded-full h-2 overflow-hidden">
                    <div 
                      className="bg-green-600 h-full rounded-full transition-all duration-500"
                      style={{ width: `${successRate}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-purple-200 shadow-lg rounded-2xl overflow-hidden hover:shadow-2xl transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-4 bg-purple-100 rounded-xl">
                  <TrendingDown className="h-8 w-8 text-purple-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-600 font-medium">الطلبات المرجوعة</p>
                  <p className="text-3xl font-bold text-gray-900">{stats.byStatus.returned.toLocaleString()}</p>
                  <div className="mt-2 bg-purple-100 rounded-full h-2 overflow-hidden">
                    <div 
                      className="bg-purple-600 h-full rounded-full transition-all duration-500"
                      style={{ width: `${returnRate}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-red-200 shadow-lg rounded-2xl overflow-hidden hover:shadow-2xl transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-4 bg-red-100 rounded-xl">
                  <X className="h-8 w-8 text-red-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-600 font-medium">الطلبات الملغاة</p>
                  <p className="text-3xl font-bold text-gray-900">{stats.byStatus.cancelled.toLocaleString()}</p>
                  <div className="mt-2 bg-red-100 rounded-full h-2 overflow-hidden">
                    <div 
                      className="bg-red-600 h-full rounded-full transition-all duration-500"
                      style={{ width: `${cancelRate}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Grid - Row 1: Status Distribution & Performance Radar */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pie Chart - Status Distribution */}
          <Card className="border-2 border-emerald-100 shadow-xl rounded-2xl overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-emerald-50 to-teal-50 border-b-2 border-emerald-100">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 rounded-lg">
                  <Activity className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <CardTitle className="text-xl">توزيع الطلبات حسب الحالة</CardTitle>
                  <CardDescription>النسب المئوية لكل حالة</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <ResponsiveContainer width="100%" height={350}>
                <PieChart>
                  <Pie
                    data={statusChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={renderCustomLabel}
                    outerRadius={120}
                    innerRadius={60}
                    fill="#8884d8"
                    dataKey="value"
                    animationDuration={1000}
                  >
                    {statusChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend 
                    verticalAlign="bottom" 
                    height={36}
                    formatter={(value, entry: any) => `${value} (${entry.payload.percentage}%)`}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-2 gap-3 mt-6">
                {statusChartData.map((item, index) => (
                  <div key={index} className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                    <div 
                      className="w-4 h-4 rounded-full" 
                      style={{ backgroundColor: item.color }}
                    ></div>
                    <div className="flex-1">
                      <p className="text-xs text-gray-600">{item.name}</p>
                      <p className="text-sm font-bold text-gray-900">{item.value.toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Radar Chart - Performance Metrics */}
          <Card className="border-2 border-blue-100 shadow-xl rounded-2xl overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b-2 border-blue-100">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Award className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <CardTitle className="text-xl">مؤشرات الأداء الشاملة</CardTitle>
                  <CardDescription>تحليل متعدد الأبعاد للأداء</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <ResponsiveContainer width="100%" height={350}>
                <RadarChart data={performanceRadarData}>
                  <PolarGrid stroke="#e5e7eb" />
                  <PolarAngleAxis 
                    dataKey="metric" 
                    tick={{ fill: '#6b7280', fontSize: 12, fontWeight: 600 }}
                  />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: '#9ca3af' }} />
                  <Radar
                    name="الأداء"
                    dataKey="value"
                    stroke="#3b82f6"
                    fill="#3b82f6"
                    fillOpacity={0.6}
                    animationDuration={1000}
                  />
                  <Tooltip content={<CustomTooltip />} />
                </RadarChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-2 gap-3 mt-6">
                {performanceRadarData.map((item, index) => (
                  <div key={index} className="p-3 bg-blue-50 rounded-lg">
                    <p className="text-xs text-gray-600 mb-1">{item.metric}</p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-blue-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-full rounded-full transition-all duration-500"
                          style={{ width: `${item.value}%` }}
                        ></div>
                      </div>
                      <span className="text-sm font-bold text-blue-600">{item.value}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Grid - Row 2: Regions & Delivery Persons */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Bar Chart - Top Regions */}
          <Card className="border-2 border-purple-100 shadow-xl rounded-2xl overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 border-b-2 border-purple-100">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <MapPin className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <CardTitle className="text-xl">أفضل 10 مناطق</CardTitle>
                  <CardDescription>المناطق الأكثر طلباً وإيراداً</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={regionChartData} layout="horizontal">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 12 }} />
                  <YAxis 
                    type="category" 
                    dataKey="name" 
                    tick={{ fill: '#6b7280', fontSize: 11, fontWeight: 600 }}
                    width={120}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar 
                    dataKey="orders" 
                    name="عدد الطلبات" 
                    fill="#8b5cf6" 
                    radius={[0, 8, 8, 0]}
                    animationDuration={1000}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Area Chart - Top Delivery Persons */}
          <Card className="border-2 border-teal-100 shadow-xl rounded-2xl overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-teal-50 to-cyan-50 border-b-2 border-teal-100">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-teal-100 rounded-lg">
                  <Users className="h-5 w-5 text-teal-600" />
                </div>
                <div>
                  <CardTitle className="text-xl">أفضل 8 مندوبين</CardTitle>
                  <CardDescription>المندوبون الأكثر إنتاجية</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={deliveryChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fill: '#6b7280', fontSize: 11, fontWeight: 600 }}
                    angle={-45}
                    textAnchor="end"
                    height={100}
                  />
                  <YAxis tick={{ fill: '#6b7280', fontSize: 12 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar 
                    dataKey="orders" 
                    name="عدد الطلبات" 
                    fill="#14b8a6" 
                    radius={[8, 8, 0, 0]}
                    animationDuration={1000}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Revenue Comparison Chart */}
        <Card className="border-2 border-amber-100 shadow-xl rounded-2xl overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-amber-50 to-orange-50 border-b-2 border-amber-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <DollarSign className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <CardTitle className="text-xl">مقارنة الإيرادات - المناطق والمندوبين</CardTitle>
                <CardDescription>توزيع الإيرادات عبر المناطق والمندوبين</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-4">إيرادات المناطق</h4>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={regionChartData}>
                    <defs>
                      <linearGradient id="colorRevenue1" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.1}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis 
                      dataKey="name" 
                      tick={{ fill: '#6b7280', fontSize: 10 }}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis tick={{ fill: '#6b7280', fontSize: 12 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area 
                      type="monotone" 
                      dataKey="revenue" 
                      stroke="#f59e0b" 
                      fillOpacity={1} 
                      fill="url(#colorRevenue1)"
                      name="الإيرادات"
                      animationDuration={1000}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-4">إيرادات المندوبين</h4>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={deliveryChartData}>
                    <defs>
                      <linearGradient id="colorRevenue2" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.1}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis 
                      dataKey="name" 
                      tick={{ fill: '#6b7280', fontSize: 10 }}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis tick={{ fill: '#6b7280', fontSize: 12 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area 
                      type="monotone" 
                      dataKey="revenue" 
                      stroke="#06b6d4" 
                      fillOpacity={1} 
                      fill="url(#colorRevenue2)"
                      name="الإيرادات"
                      animationDuration={1000}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer Note */}
        <Card className="border-2 border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100 shadow-lg rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 text-gray-600">
              <Zap className="h-5 w-5 text-emerald-600" />
              <p className="text-sm">
                <span className="font-semibold text-gray-900">ملاحظة:</span> جميع البيانات محدثة في الوقت الفعلي. 
                استخدم الفلاتر أعلاه لتخصيص التقرير حسب احتياجاتك.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
