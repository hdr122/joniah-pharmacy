import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Clock, 
  Zap, 
  TrendingUp, 
  TrendingDown, 
  User, 
  Calendar,
  Filter,
  Trophy,
  Target,
  Timer,
  Package,
  MapPin,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  BarChart3,
  Award
} from "lucide-react";
import { Link } from "wouter";

// Format duration in minutes to readable string
function formatDuration(minutes: number | null | undefined): string {
  if (!minutes || minutes <= 0) return "-";
  if (minutes < 60) return `${minutes} دقيقة`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) return `${hours} ساعة`;
  return `${hours} ساعة و ${mins} دقيقة`;
}

// Format date to Arabic
function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("ar-IQ", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function DeliverySpeedAnalytics() {
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [selectedDeliveryPerson, setSelectedDeliveryPerson] = useState<string>("all");
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [expandedPerson, setExpandedPerson] = useState<number | null>(null);

  // Fetch delivery persons
  const { data: deliveryPersons } = trpc.users.getDeliveryPersons.useQuery();

  // Build filters
  const filters = useMemo(() => {
    const f: {
      deliveryPersonId?: number;
      startDate?: Date;
      endDate?: Date;
    } = {};
    
    if (selectedDeliveryPerson && selectedDeliveryPerson !== "all") {
      f.deliveryPersonId = parseInt(selectedDeliveryPerson);
    }
    if (startDate) f.startDate = new Date(startDate);
    if (endDate) f.endDate = new Date(endDate + "T23:59:59");
    
    return Object.keys(f).length > 0 ? f : undefined;
  }, [selectedDeliveryPerson, startDate, endDate]);

  // Fetch analytics data
  const { data: analytics, isLoading: analyticsLoading } = trpc.deliverySpeedAnalytics.getAnalytics.useQuery(filters);
  const { data: fastestSlowest, isLoading: fastestLoading } = trpc.deliverySpeedAnalytics.getFastestSlowest.useQuery(filters);
  const { data: monthlyBest, isLoading: monthlyLoading } = trpc.deliverySpeedAnalytics.getMonthlyBest.useQuery({
    year: selectedYear,
    month: selectedMonth,
  });

  // Calculate overall stats
  const overallStats = useMemo(() => {
    if (!analytics || analytics.length === 0) return null;
    
    const totalOrders = analytics.reduce((sum, dp) => sum + dp.totalOrders, 0);
    const totalRevenue = analytics.reduce((sum, dp) => sum + dp.totalRevenue, 0);
    const avgTimes = analytics.filter(dp => dp.avgDeliveryTime > 0).map(dp => dp.avgDeliveryTime);
    const overallAvg = avgTimes.length > 0 ? Math.round(avgTimes.reduce((a, b) => a + b, 0) / avgTimes.length) : 0;
    const fastestAvg = Math.min(...avgTimes.filter(t => t > 0));
    const slowestAvg = Math.max(...avgTimes);
    
    return {
      totalOrders,
      totalRevenue,
      overallAvg,
      fastestAvg: fastestAvg === Infinity ? 0 : fastestAvg,
      slowestAvg,
      deliveryPersonsCount: analytics.length,
    };
  }, [analytics]);

  const clearFilters = () => {
    setStartDate("");
    setEndDate("");
    setSelectedDeliveryPerson("all");
  };

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin/delivery-dashboard">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Zap className="w-7 h-7 text-yellow-500" />
                تحليل سرعة التوصيل
              </h1>
              <p className="text-muted-foreground">تحليل شامل لأداء وسرعة المندوبين</p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="w-5 h-5" />
              الفلاتر
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>المندوب</Label>
                <Select value={selectedDeliveryPerson} onValueChange={setSelectedDeliveryPerson}>
                  <SelectTrigger>
                    <SelectValue placeholder="جميع المندوبين" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع المندوبين</SelectItem>
                    {deliveryPersons?.map((dp) => (
                      <SelectItem key={dp.id} value={dp.id.toString()}>
                        {dp.name || dp.username}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>من تاريخ</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>إلى تاريخ</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <div className="flex items-end">
                <Button variant="outline" onClick={clearFilters} className="w-full">
                  مسح الفلاتر
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Overall Stats */}
        {overallStats && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-2">
                  <Package className="w-5 h-5" />
                  <span className="text-sm font-medium">إجمالي الطلبات</span>
                </div>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{overallStats.totalOrders}</p>
              </CardContent>
            </Card>
            
            <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-900 border-emerald-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 mb-2">
                  <Timer className="w-5 h-5" />
                  <span className="text-sm font-medium">متوسط الوقت</span>
                </div>
                <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{formatDuration(overallStats.overallAvg)}</p>
              </CardContent>
            </Card>
            
            <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-green-600 dark:text-green-400 mb-2">
                  <Zap className="w-5 h-5" />
                  <span className="text-sm font-medium">أسرع متوسط</span>
                </div>
                <p className="text-2xl font-bold text-green-700 dark:text-green-300">{formatDuration(overallStats.fastestAvg)}</p>
              </CardContent>
            </Card>
            
            <Card className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950 dark:to-red-900 border-red-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400 mb-2">
                  <Clock className="w-5 h-5" />
                  <span className="text-sm font-medium">أبطأ متوسط</span>
                </div>
                <p className="text-2xl font-bold text-red-700 dark:text-red-300">{formatDuration(overallStats.slowestAvg)}</p>
              </CardContent>
            </Card>
            
            <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 mb-2">
                  <User className="w-5 h-5" />
                  <span className="text-sm font-medium">عدد المندوبين</span>
                </div>
                <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">{overallStats.deliveryPersonsCount}</p>
              </CardContent>
            </Card>
            
            <Card className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950 dark:to-amber-900 border-amber-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 mb-2">
                  <Target className="w-5 h-5" />
                  <span className="text-sm font-medium">إجمالي الإيرادات</span>
                </div>
                <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">{overallStats.totalRevenue.toLocaleString()} د.ع</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tabs */}
        <Tabs defaultValue="ranking" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="ranking" className="gap-2">
              <Trophy className="w-4 h-4" />
              ترتيب المندوبين
            </TabsTrigger>
            <TabsTrigger value="fastest" className="gap-2">
              <Zap className="w-4 h-4" />
              أسرع/أبطأ الطلبات
            </TabsTrigger>
            <TabsTrigger value="monthly" className="gap-2">
              <Calendar className="w-4 h-4" />
              أفضل أوقات الشهر
            </TabsTrigger>
          </TabsList>

          {/* Ranking Tab */}
          <TabsContent value="ranking" className="space-y-4">
            {analyticsLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Card key={i}>
                    <CardContent className="p-6">
                      <Skeleton className="h-20 w-full" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : analytics && analytics.length > 0 ? (
              <div className="space-y-4">
                {analytics.map((dp, index) => (
                  <Card 
                    key={dp.deliveryPersonId}
                    className={`transition-all ${
                      index === 0 ? "border-yellow-400 bg-yellow-50/50 dark:bg-yellow-950/20" :
                      index === 1 ? "border-gray-400 bg-gray-50/50 dark:bg-gray-950/20" :
                      index === 2 ? "border-amber-600 bg-amber-50/50 dark:bg-amber-950/20" : ""
                    }`}
                  >
                    <CardContent className="p-4">
                      <div 
                        className="flex items-center justify-between cursor-pointer"
                        onClick={() => setExpandedPerson(expandedPerson === dp.deliveryPersonId ? null : dp.deliveryPersonId)}
                      >
                        <div className="flex items-center gap-4">
                          {/* Rank Badge */}
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${
                            index === 0 ? "bg-yellow-500 text-white" :
                            index === 1 ? "bg-gray-400 text-white" :
                            index === 2 ? "bg-amber-600 text-white" :
                            "bg-gray-200 text-gray-700"
                          }`}>
                            {index === 0 ? <Trophy className="w-5 h-5" /> : index + 1}
                          </div>
                          
                          <div>
                            <h3 className="font-semibold text-lg">{dp.deliveryPersonName}</h3>
                            <p className="text-sm text-muted-foreground">
                              {dp.totalOrders} طلب مسلّم
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-6">
                          <div className="text-center">
                            <p className="text-xs text-muted-foreground">متوسط الوقت</p>
                            <p className="font-bold text-emerald-600">{formatDuration(dp.avgDeliveryTime)}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-xs text-muted-foreground">أسرع توصيل</p>
                            <p className="font-bold text-green-600">{formatDuration(dp.minDeliveryTime)}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-xs text-muted-foreground">أبطأ توصيل</p>
                            <p className="font-bold text-red-600">{formatDuration(dp.maxDeliveryTime)}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-xs text-muted-foreground">الإيرادات</p>
                            <p className="font-bold text-amber-600">{dp.totalRevenue.toLocaleString()}</p>
                          </div>
                          {expandedPerson === dp.deliveryPersonId ? (
                            <ChevronUp className="w-5 h-5 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-muted-foreground" />
                          )}
                        </div>
                      </div>

                      {/* Expanded Details */}
                      {expandedPerson === dp.deliveryPersonId && (
                        <div className="mt-4 pt-4 border-t space-y-4">
                          {/* Fastest Order */}
                          {dp.fastestOrder && (
                            <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg">
                              <div className="flex items-center gap-2 text-green-700 dark:text-green-400 mb-2">
                                <Zap className="w-4 h-4" />
                                <span className="font-medium">أسرع طلب</span>
                              </div>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                <div>
                                  <span className="text-muted-foreground">رقم الطلب:</span>
                                  <span className="font-medium mr-1">#{dp.fastestOrder.id}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">الوقت:</span>
                                  <span className="font-medium mr-1 text-green-600">{formatDuration(dp.fastestOrder.deliveryDuration)}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">المنطقة:</span>
                                  <span className="font-medium mr-1">{dp.fastestOrder.regionName}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">التاريخ:</span>
                                  <span className="font-medium mr-1">{formatDate(dp.fastestOrder.deliveredAt)}</span>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Slowest Order */}
                          {dp.slowestOrder && (
                            <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded-lg">
                              <div className="flex items-center gap-2 text-red-700 dark:text-red-400 mb-2">
                                <Clock className="w-4 h-4" />
                                <span className="font-medium">أبطأ طلب</span>
                              </div>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                <div>
                                  <span className="text-muted-foreground">رقم الطلب:</span>
                                  <span className="font-medium mr-1">#{dp.slowestOrder.id}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">الوقت:</span>
                                  <span className="font-medium mr-1 text-red-600">{formatDuration(dp.slowestOrder.deliveryDuration)}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">المنطقة:</span>
                                  <span className="font-medium mr-1">{dp.slowestOrder.regionName}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">التاريخ:</span>
                                  <span className="font-medium mr-1">{formatDate(dp.slowestOrder.deliveredAt)}</span>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Recent Orders */}
                          <div>
                            <h4 className="font-medium mb-2">آخر الطلبات المسلّمة</h4>
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-b">
                                    <th className="text-right py-2 px-2">رقم</th>
                                    <th className="text-right py-2 px-2">الزبون</th>
                                    <th className="text-right py-2 px-2">المنطقة</th>
                                    <th className="text-right py-2 px-2">وقت التوصيل</th>
                                    <th className="text-right py-2 px-2">السعر</th>
                                    <th className="text-right py-2 px-2">التاريخ</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {dp.orders.slice(0, 10).map((order) => (
                                    <tr key={order.id} className="border-b hover:bg-muted/50">
                                      <td className="py-2 px-2">#{order.id}</td>
                                      <td className="py-2 px-2">{order.customerName || "-"}</td>
                                      <td className="py-2 px-2">{order.regionName}</td>
                                      <td className="py-2 px-2">
                                        <Badge variant={
                                          (order.deliveryDuration || 0) <= 30 ? "default" :
                                          (order.deliveryDuration || 0) <= 60 ? "secondary" : "destructive"
                                        }>
                                          {formatDuration(order.deliveryDuration)}
                                        </Badge>
                                      </td>
                                      <td className="py-2 px-2">{order.price?.toLocaleString()} د.ع</td>
                                      <td className="py-2 px-2">{formatDate(order.deliveredAt)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="p-12 text-center">
                  <BarChart3 className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">لا توجد بيانات متاحة</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Fastest/Slowest Tab */}
          <TabsContent value="fastest" className="space-y-4">
            <div className="grid md:grid-cols-2 gap-6">
              {/* Fastest Orders */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-green-600">
                    <Zap className="w-5 h-5" />
                    أسرع 10 طلبات
                  </CardTitle>
                  <CardDescription>أسرع الطلبات توصيلاً</CardDescription>
                </CardHeader>
                <CardContent>
                  {fastestLoading ? (
                    <Skeleton className="h-40 w-full" />
                  ) : fastestSlowest?.fastest && fastestSlowest.fastest.length > 0 ? (
                    <div className="space-y-3">
                      {fastestSlowest.fastest.map((order, index) => (
                        <div 
                          key={order.id}
                          className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950/30 rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                              index === 0 ? "bg-yellow-500 text-white" :
                              index === 1 ? "bg-gray-400 text-white" :
                              index === 2 ? "bg-amber-600 text-white" :
                              "bg-gray-200 text-gray-700"
                            }`}>
                              {index + 1}
                            </div>
                            <div>
                              <p className="font-medium">#{order.id}</p>
                              <p className="text-xs text-muted-foreground">{order.deliveryPersonName}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-green-600">{formatDuration(order.deliveryDuration)}</p>
                            <p className="text-xs text-muted-foreground">{order.regionName}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">لا توجد بيانات</p>
                  )}
                </CardContent>
              </Card>

              {/* Slowest Orders */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-red-600">
                    <Clock className="w-5 h-5" />
                    أبطأ 10 طلبات
                  </CardTitle>
                  <CardDescription>أبطأ الطلبات توصيلاً</CardDescription>
                </CardHeader>
                <CardContent>
                  {fastestLoading ? (
                    <Skeleton className="h-40 w-full" />
                  ) : fastestSlowest?.slowest && fastestSlowest.slowest.length > 0 ? (
                    <div className="space-y-3">
                      {fastestSlowest.slowest.map((order, index) => (
                        <div 
                          key={order.id}
                          className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-950/30 rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm bg-red-200 text-red-700">
                              {index + 1}
                            </div>
                            <div>
                              <p className="font-medium">#{order.id}</p>
                              <p className="text-xs text-muted-foreground">{order.deliveryPersonName}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-red-600">{formatDuration(order.deliveryDuration)}</p>
                            <p className="text-xs text-muted-foreground">{order.regionName}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">لا توجد بيانات</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Monthly Best Tab */}
          <TabsContent value="monthly" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Award className="w-5 h-5 text-yellow-500" />
                      أفضل أوقات الشهر
                    </CardTitle>
                    <CardDescription>أفضل وقت توصيل لكل مندوب خلال الشهر</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[
                          { value: "1", label: "يناير" },
                          { value: "2", label: "فبراير" },
                          { value: "3", label: "مارس" },
                          { value: "4", label: "أبريل" },
                          { value: "5", label: "مايو" },
                          { value: "6", label: "يونيو" },
                          { value: "7", label: "يوليو" },
                          { value: "8", label: "أغسطس" },
                          { value: "9", label: "سبتمبر" },
                          { value: "10", label: "أكتوبر" },
                          { value: "11", label: "نوفمبر" },
                          { value: "12", label: "ديسمبر" },
                        ].map((m) => (
                          <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[2024, 2025, 2026].map((y) => (
                          <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {monthlyLoading ? (
                  <Skeleton className="h-40 w-full" />
                ) : monthlyBest && monthlyBest.length > 0 ? (
                  <div className="space-y-4">
                    {monthlyBest.map((dp, index) => (
                      <div 
                        key={dp.deliveryPersonId}
                        className={`flex items-center justify-between p-4 rounded-lg ${
                          index === 0 ? "bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-300" :
                          "bg-muted/50"
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                            index === 0 ? "bg-yellow-500 text-white" :
                            index === 1 ? "bg-gray-400 text-white" :
                            index === 2 ? "bg-amber-600 text-white" :
                            "bg-gray-200 text-gray-700"
                          }`}>
                            {index === 0 ? <Trophy className="w-5 h-5" /> : index + 1}
                          </div>
                          <div>
                            <h3 className="font-semibold">{dp.deliveryPersonName}</h3>
                            <p className="text-sm text-muted-foreground">{dp.totalOrders} طلب</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="text-center">
                            <p className="text-xs text-muted-foreground">أفضل وقت</p>
                            <p className="font-bold text-green-600">{formatDuration(dp.bestTime)}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-xs text-muted-foreground">متوسط الوقت</p>
                            <p className="font-bold">{formatDuration(dp.avgTime)}</p>
                          </div>
                          {dp.bestOrder && (
                            <div className="text-center">
                              <p className="text-xs text-muted-foreground">المنطقة</p>
                              <p className="font-medium">{dp.bestOrder.regionName}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">لا توجد بيانات لهذا الشهر</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
