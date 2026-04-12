import { useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bell, Package, Calendar, User, Search } from "lucide-react";
import { AdvancedDateFilter, DateFilterValue } from "@/components/AdvancedDateFilter";

export default function DeliveryHistory() {
  const [selectedDelivery, setSelectedDelivery] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState<DateFilterValue | null>(null);

  const { data: deliveries } = trpc.users.getDeliveryPersons.useQuery();
  const { data: notifications } = trpc.notifications.getByUser.useQuery(
    { userId: selectedDelivery! },
    { enabled: !!selectedDelivery }
  );
  const { data: orders } = trpc.orders.getByDelivery.useQuery(
    { deliveryId: selectedDelivery! },
    { enabled: !!selectedDelivery }
  );

  const filteredNotifications = notifications?.filter((n: any) => {
    const matchesSearch = (n.title?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
                         (n.message?.toLowerCase() || "").includes(searchQuery.toLowerCase());
    
    if (dateFilter) {
      const notifDate = new Date(n.createdAt);
      
      if (dateFilter.type === 'simple' && dateFilter.simple) {
        const { year, month, day } = dateFilter.simple;
        const start = new Date(year, month ? month - 1 : 0, day || 1, 5, 0, 0);
        let end: Date;
        
        if (day) {
          end = new Date(year, month! - 1, day + 1, 4, 59, 59);
        } else if (month) {
          end = new Date(year, month, 1, 4, 59, 59);
        } else {
          end = new Date(year + 1, 0, 1, 4, 59, 59);
        }
        
        if (!(notifDate >= start && notifDate <= end)) return false;
      }
      
      if (dateFilter.type === 'range' && dateFilter.range) {
        const start = new Date(dateFilter.range.startDate);
        const end = new Date(dateFilter.range.endDate);
        if (!(notifDate >= start && notifDate <= end)) return false;
      }
    }
    
    return matchesSearch;
  });

  const filteredOrders = orders?.filter((o: any) => {
    const matchesSearch = (o.customerName?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
                         (o.customerPhone || "").includes(searchQuery);
    
    if (dateFilter) {
      const orderDate = new Date(o.createdAt);
      
      if (dateFilter.type === 'simple' && dateFilter.simple) {
        const { year, month, day } = dateFilter.simple;
        const start = new Date(year, month ? month - 1 : 0, day || 1, 5, 0, 0);
        let end: Date;
        
        if (day) {
          end = new Date(year, month! - 1, day + 1, 4, 59, 59);
        } else if (month) {
          end = new Date(year, month, 1, 4, 59, 59);
        } else {
          end = new Date(year + 1, 0, 1, 4, 59, 59);
        }
        
        if (!(orderDate >= start && orderDate <= end)) return false;
      }
      
      if (dateFilter.type === 'range' && dateFilter.range) {
        const start = new Date(dateFilter.range.startDate);
        const end = new Date(dateFilter.range.endDate);
        if (!(orderDate >= start && orderDate <= end)) return false;
      }
    }
    
    return matchesSearch;
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { label: string; className: string }> = {
      pending: { label: "قيد الانتظار", className: "bg-yellow-100 text-yellow-800" },
      delivered: { label: "مسلم", className: "bg-green-100 text-green-800" },
      postponed: { label: "مؤجل", className: "bg-blue-100 text-blue-800" },
      cancelled: { label: "ملغي", className: "bg-gray-100 text-gray-800" },
      returned: { label: "مرجوع", className: "bg-red-100 text-red-800" },
    };
    const variant = variants[status] || variants.pending;
    return (
      <Badge className={variant.className}>
        {variant.label}
      </Badge>
    );
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">سجل المندوبين</h1>
        <p className="text-gray-600 mt-2">عرض سجل الإشعارات والطلبات لكل مندوب</p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>التصفية</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-sm font-medium mb-2 block">اختر المندوب</label>
              <Select
                value={selectedDelivery?.toString() || ""}
                onValueChange={(value) => setSelectedDelivery(parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="اختر مندوب" />
                </SelectTrigger>
                <SelectContent>
                  {deliveries?.map((d: any) => (
                    <SelectItem key={d.id} value={d.id.toString()}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">بحث</label>
              <div className="relative">
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="ابحث..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pr-10"
                />
              </div>
            </div>
          </div>
          
          <div className="border-t pt-4">
            <AdvancedDateFilter
              value={dateFilter}
              onChange={setDateFilter}
              showQuickFilters={true}
              storageKey="delivery-history-filter"
            />
          </div>
        </CardContent>
      </Card>

      {!selectedDelivery ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-gray-500">
              <User className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>اختر مندوب لعرض سجله</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
        {/* Performance Statistics Card */}
        <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5 text-emerald-600" />
              إحصائيات الأداء
            </CardTitle>
            <CardDescription>
              تحليل سرعة وأداء المندوب في توصيل الطلبات
            </CardDescription>
          </CardHeader>
          <CardContent>
            {(() => {
              const deliveredOrders = filteredOrders?.filter((o: any) => o.status === 'delivered' && o.acceptedAt && o.deliveredAt) || [];
              
              if (deliveredOrders.length === 0) {
                return (
                  <div className="text-center py-8 text-gray-500">
                    لا توجد طلبات مسلمة لحساب الإحصائيات
                  </div>
                );
              }

              // حساب المدد الزمنية
              const durations = deliveredOrders.map((order: any) => {
                const accepted = new Date(order.acceptedAt).getTime();
                const delivered = new Date(order.deliveredAt).getTime();
                return Math.floor((delivered - accepted) / (1000 * 60)); // بالدقائق
              }).filter((d: number) => d > 0);

              if (durations.length === 0) {
                return (
                  <div className="text-center py-8 text-gray-500">
                    لا توجد بيانات كافية لحساب الإحصائيات
                  </div>
                );
              }

              const avgMinutes = Math.floor(durations.reduce((a: number, b: number) => a + b, 0) / durations.length);
              const fastestMinutes = Math.min(...durations);
              const slowestMinutes = Math.max(...durations);
              
              // حساب الإيرادات المحققة
              const totalRevenue = deliveredOrders.reduce((sum: number, o: any) => sum + (o.price || 0), 0);
              const totalDeliveryFees = deliveredOrders.reduce((sum: number, o: any) => sum + (o.deliveryFee || 0), 0);

              const formatDuration = (minutes: number) => {
                const hours = Math.floor(minutes / 60);
                const mins = minutes % 60;
                return hours > 0 ? `${hours}س ${mins}د` : `${mins}د`;
              };

              return (
                <div className="space-y-4">
                  {/* إحصائيات الأرباح */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white rounded-lg p-4 border border-blue-200">
                      <div className="text-sm text-gray-600 mb-1">عدد الطلبات المسلمة</div>
                      <div className="text-2xl font-bold text-blue-600">{deliveredOrders.length.toLocaleString('en-US')}</div>
                      <div className="text-xs text-gray-500 mt-1">في الفترة المختارة</div>
                    </div>
                    
                    <div className="bg-white rounded-lg p-4 border border-purple-200">
                      <div className="text-sm text-gray-600 mb-1">إجمالي الإيرادات</div>
                      <div className="text-2xl font-bold text-purple-600">{totalRevenue.toLocaleString('en-US')}</div>
                      <div className="text-xs text-gray-500 mt-1">د.ع</div>
                    </div>
                    
                    <div className="bg-white rounded-lg p-4 border border-teal-200">
                      <div className="text-sm text-gray-600 mb-1">إجمالي رسوم التوصيل</div>
                      <div className="text-2xl font-bold text-teal-600">{totalDeliveryFees.toLocaleString('en-US')}</div>
                      <div className="text-xs text-gray-500 mt-1">د.ع</div>
                    </div>
                  </div>
                  
                  {/* إحصائيات الوقت */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* متوسط وقت التسليم */}
                    <div className="bg-white rounded-lg p-4 border border-emerald-200">
                      <div className="text-sm text-gray-600 mb-1">متوسط وقت التسليم</div>
                      <div className="text-2xl font-bold text-emerald-600">{formatDuration(avgMinutes)}</div>
                      <div className="text-xs text-gray-500 mt-1">من القبول إلى التسليم</div>
                    </div>

                    {/* أسرع تسليم */}
                    <div className="bg-white rounded-lg p-4 border border-green-200">
                      <div className="text-sm text-gray-600 mb-1">أسرع تسليم</div>
                      <div className="text-2xl font-bold text-green-600">{formatDuration(fastestMinutes)}</div>
                      <div className="text-xs text-gray-500 mt-1">أقل وقت تسليم</div>
                    </div>

                    {/* أبطأ تسليم */}
                    <div className="bg-white rounded-lg p-4 border border-orange-200">
                      <div className="text-sm text-gray-600 mb-1">أبطأ تسليم</div>
                      <div className="text-2xl font-bold text-orange-600">{formatDuration(slowestMinutes)}</div>
                      <div className="text-xs text-gray-500 mt-1">أطول وقت تسليم</div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>

        <Tabs defaultValue="notifications" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="notifications">
              <Bell className="w-4 h-4 ml-2" />
              الإشعارات ({filteredNotifications?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="orders">
              <Package className="w-4 h-4 ml-2" />
              الطلبات ({filteredOrders?.length || 0})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="notifications">
            <Card>
              <CardHeader>
                <CardTitle>سجل الإشعارات</CardTitle>
                <CardDescription>
                  جميع الإشعارات المرسلة للمندوب
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!filteredNotifications || filteredNotifications.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Bell className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>لا توجد إشعارات</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredNotifications.map((notif: any) => (
                      <div
                        key={notif.id}
                        className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-semibold text-gray-900">{notif.title}</h4>
                            <p className="text-sm text-gray-600 mt-1">{notif.message}</p>
                            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {new Date(notif.createdAt).toLocaleDateString("ar-IQ")}
                              </span>
                              <span className="flex items-center gap-1">
                                {new Date(notif.createdAt).toLocaleTimeString("ar-IQ", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </div>
                          </div>
                          {!notif.isRead && (
                            <Badge className="bg-blue-100 text-blue-800">جديد</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="orders">
            <Card>
              <CardHeader>
                <CardTitle>سجل الطلبات</CardTitle>
                <CardDescription>
                  جميع الطلبات المسندة للمندوب
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!filteredOrders || filteredOrders.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>لا توجد طلبات</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredOrders.map((order: any) => (
                      <div
                        key={order.id}
                        className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h4 className="font-semibold text-gray-900">
                                طلب #{order.id}
                              </h4>
                              {getStatusBadge(order.status)}
                            </div>
                            <div className="space-y-3">
                              <div className="grid grid-cols-2 gap-2 text-sm">
                                <p className="text-gray-600">
                                  <span className="font-medium">العميل:</span> {order.customerName}
                                </p>
                                <p className="text-gray-600">
                                  <span className="font-medium">الهاتف:</span> {order.customerPhone}
                                </p>
                                <p className="text-gray-600">
                                  <span className="font-medium">المبلغ:</span> {order.price?.toLocaleString('en-US') || 0} دينار
                                </p>
                                <p className="text-gray-600">
                                  <span className="font-medium">المنطقة:</span> {order.regionName}
                                </p>
                              </div>
                              
                              {/* Timeline */}
                              <div className="border-t pt-3 mt-3">
                                <h5 className="text-xs font-semibold text-gray-700 mb-2">التوقيت الزمني:</h5>
                                <div className="space-y-1 text-xs text-gray-600">
                                  <div className="flex items-center gap-2">
                                    <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                                    <span className="font-medium">إنشاء الطلب:</span>
                                    <span>{new Date(order.createdAt).toLocaleString("ar-IQ", { 
                                      year: "numeric", 
                                      month: "2-digit", 
                                      day: "2-digit", 
                                      hour: "2-digit", 
                                      minute: "2-digit",
                                      hour12: false,
                                      timeZone: "Asia/Baghdad"
                                    })}</span>
                                  </div>
                                  
                                  {order.acceptedAt && (
                                    <div className="flex items-center gap-2">
                                      <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                                      <span className="font-medium">قبول الطلب:</span>
                                      <span>{new Date(order.acceptedAt).toLocaleString("ar-IQ", { 
                                        year: "numeric", 
                                        month: "2-digit", 
                                        day: "2-digit", 
                                        hour: "2-digit", 
                                        minute: "2-digit" 
                                      })}</span>
                                    </div>
                                  )}
                                  
                                  {order.status === "delivered" && order.deliveredAt && (
                                    <div className="flex items-center gap-2">
                                      <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                                      <span className="font-medium">تسليم الطلب:</span>
                                      <span>{new Date(order.deliveredAt).toLocaleString("ar-IQ", { 
                                        year: "numeric", 
                                        month: "2-digit", 
                                        day: "2-digit", 
                                        hour: "2-digit", 
                                        minute: "2-digit" 
                                      })}</span>
                                    </div>
                                  )}
                                  
                                  {order.status === "postponed" && (
                                    <div className="flex items-center gap-2">
                                      <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
                                      <span className="font-medium">تأجيل الطلب:</span>
                                      <span>{new Date(order.createdAt).toLocaleString("ar-IQ", { 
                                        year: "numeric", 
                                        month: "2-digit", 
                                        day: "2-digit", 
                                        hour: "2-digit", 
                                        minute: "2-digit" 
                                      })}</span>
                                      {order.postponeReason && (
                                        <span className="text-orange-600">(السبب: {order.postponeReason})</span>
                                      )}
                                    </div>
                                  )}
                                  
                                  {order.status === "returned" && (
                                    <div className="flex items-center gap-2">
                                      <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                                      <span className="font-medium">إرجاع الطلب:</span>
                                      <span>{new Date(order.createdAt).toLocaleString("ar-IQ", { 
                                        year: "numeric", 
                                        month: "2-digit", 
                                        day: "2-digit", 
                                        hour: "2-digit", 
                                        minute: "2-digit" 
                                      })}</span>
                                      {order.returnReason && (
                                        <span className="text-purple-600">(السبب: {order.returnReason})</span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        </>
      )}
      </div>
    </AdminLayout>
  );
}
