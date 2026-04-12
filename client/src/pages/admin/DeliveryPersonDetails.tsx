import { useState } from "react";
import { useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Package, MapPin, TrendingUp, User, Phone, Mail, Calendar, Map as MapIcon, Filter } from "lucide-react";
import { useLocation } from "wouter";
import { formatNumber, formatCurrency } from "@/lib/numberUtils";
import OrderRouteMap from "@/components/OrderRouteMap";
import { DateFilterDropdown, DateFilterValue } from "@/components/DateFilterDropdown";
import { CalendarDays, CalendarX } from "lucide-react";

export default function DeliveryPersonDetails() {
  const [, params] = useRoute("/admin/deliveries/:id");
  const [, setLocation] = useLocation();
  const deliveryPersonId = params?.id ? parseInt(params.id) : 0;
  
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [showRouteDialog, setShowRouteDialog] = useState(false);
  
  // Date filter state
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
  const [dateFilter, setDateFilter] = useState<DateFilterValue>({
    type: 'today',
    startDate: todayBounds.start.toISOString(),
    endDate: todayBounds.end.toISOString(),
    label: 'اليوم'
  });
  
  // Get order route when dialog opens
  const { data: routeData, isLoading: loadingRoute } = trpc.orders.getOrderRoute.useQuery(
    { orderId: selectedOrder?.id || 0 },
    { enabled: showRouteDialog && !!selectedOrder }
  );
  
  // Get delivery person details
  const { data: deliveryPerson, isLoading: loadingPerson } = trpc.users.getDeliveryPerson.useQuery(
    { id: deliveryPersonId },
    { enabled: deliveryPersonId > 0 }
  );
  
  // Get delivery person orders with date filter
  const { data: orders, isLoading: loadingOrders } = trpc.orders.getDeliveryPersonOrders.useQuery(
    { 
      deliveryPersonId,
      startDate: dateFilter.startDate,
      endDate: dateFilter.endDate
    },
    { enabled: deliveryPersonId > 0 }
  );
  
  // Get working days stats
  const { data: workingDaysData } = trpc.deliveryStats.workingDays.useQuery(
    {
      deliveryPersonId,
      startDate: dateFilter.startDate,
      endDate: dateFilter.endDate
    },
    { enabled: deliveryPersonId > 0 }
  );
  
  const getStatusBadge = (status: string) => {
    const variants: Record<string, { label: string; className: string }> = {
      pending_approval: { label: "قيد الانتظار", className: "bg-blue-600" },
      pending: { label: "بطريقه للتسليم", className: "bg-yellow-600" },
      delivered: { label: "تم التسليم", className: "bg-green-600" },
      postponed: { label: "مؤجل", className: "bg-orange-600" },
      cancelled: { label: "ملغي", className: "bg-red-600" },
      returned: { label: "مرتجع", className: "bg-purple-600" },
    };
    const variant = variants[status] || variants.pending_approval;
    return <Badge className={variant.className}>{variant.label}</Badge>;
  };
  
  if (loadingPerson || loadingOrders) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }
  
  if (!deliveryPerson) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">
          <p className="text-lg text-muted-foreground">المندوب غير موجود</p>
          <Button onClick={() => setLocation("/admin/deliveries")} className="mt-4">
            <ArrowLeft className="w-4 h-4 ml-2" />
            العودة للمندوبين
          </Button>
        </div>
      </div>
    );
  }
  
  // Calculate statistics
  const totalOrders = orders?.length || 0;
  const deliveredOrders = orders?.filter((o: any) => o.status === 'delivered').length || 0;
  const pendingOrders = orders?.filter((o: any) => o.status === 'pending' || o.status === 'pending_approval').length || 0;
  const totalRevenue = orders?.filter((o: any) => o.status === 'delivered').reduce((sum: number, o: any) => sum + o.price, 0) || 0;
  
  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => setLocation("/admin/deliveries")}>
            <ArrowLeft className="w-4 h-4 ml-2" />
            رجوع
          </Button>
          <div>
            <h1 className="text-3xl font-bold">تفاصيل المندوب</h1>
            <p className="text-muted-foreground mt-1">{deliveryPerson.username}</p>
          </div>
        </div>
      </div>
      
      {/* Delivery Person Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            معلومات المندوب
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-3">
              <User className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">الاسم</p>
                <p className="font-medium">{deliveryPerson.username}</p>
              </div>
            </div>
            
            {deliveryPerson.phone && (
              <div className="flex items-center gap-3">
                <Phone className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">رقم الهاتف</p>
                  <p className="font-medium" dir="ltr">{deliveryPerson.phone}</p>
                </div>
              </div>
            )}
            
            {deliveryPerson.email && (
              <div className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">البريد الإلكتروني</p>
                  <p className="font-medium">{deliveryPerson.email}</p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      
      {/* Date Filter */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <Filter className="w-5 h-5 text-muted-foreground" />
            <div className="flex-1">
              <DateFilterDropdown
                value={dateFilter}
                onChange={setDateFilter}
              />
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">إجمالي الطلبات</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(totalOrders)}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">الطلبات المسلمة</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatNumber(deliveredOrders)}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">الطلبات الحالية</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{formatNumber(pendingOrders)}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">إجمالي الإيرادات</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalRevenue)}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">أيام العمل</CardTitle>
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{workingDaysData?.workingDays || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">من أصل {workingDaysData?.totalDays || 0} يوم</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">أيام الغياب</CardTitle>
            <CalendarX className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{workingDaysData?.nonWorkingDays || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">لم يتم التسليم في هذه الأيام</p>
          </CardContent>
        </Card>
      </div>
      
      {/* Orders List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            طلبات المندوب
          </CardTitle>
          <CardDescription>
            {formatNumber(totalOrders)} طلب
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!orders || orders.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p className="text-lg">لا توجد طلبات لهذا المندوب</p>
            </div>
          ) : (
            <div className="space-y-3">
              {orders.map((order: any) => (
                <div
                  key={order.id}
                  className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-semibold">طلب #{order.orderNumber}</span>
                        {getStatusBadge(order.status)}
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4" />
                          {order.customerName}
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4" />
                          {order.regionName}
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          {new Date(order.createdAt).toLocaleDateString('ar-IQ')}
                        </div>
                      </div>
                      
                      {order.deliveryLocationName && (
                        <div className="mt-2 text-sm">
                          <span className="text-muted-foreground">مكان التسليم: </span>
                          <span className="font-medium">{order.deliveryLocationName}</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <div className="text-left">
                        <p className="text-2xl font-bold">{formatCurrency(order.price)}</p>
                      </div>
                      
                      {order.status === 'delivered' && order.acceptedAt && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedOrder(order);
                            setShowRouteDialog(true);
                          }}
                        >
                          <MapIcon className="w-4 h-4 ml-2" />
                          عرض المسار
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Route Dialog */}
      {selectedOrder && (
        <Dialog open={showRouteDialog} onOpenChange={setShowRouteDialog}>
          <DialogContent className="max-w-4xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>مسار الطلب #{selectedOrder.orderNumber}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">وقت القبول: </span>
                  <span className="font-medium">
                    {new Date(selectedOrder.acceptedAt).toLocaleString('ar-IQ', { hour12: false, timeZone: 'Asia/Baghdad' })}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">وقت التسليم: </span>
                  <span className="font-medium">
                    {new Date(selectedOrder.deliveredAt).toLocaleString('ar-IQ', { hour12: false, timeZone: 'Asia/Baghdad' })}
                  </span>
                </div>
              </div>
              
              {loadingRoute ? (
                <div className="h-[500px] bg-muted rounded-lg flex items-center justify-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
                </div>
              ) : routeData && routeData.locations ? (
                <OrderRouteMap
                  orderId={selectedOrder.id}
                  locations={routeData.locations}
                  startTime={routeData.startTime}
                  endTime={routeData.endTime}
                />
              ) : (
                <div className="h-[500px] bg-muted rounded-lg flex items-center justify-center">
                  <p className="text-muted-foreground">لا توجد بيانات GPS لهذا الطلب</p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
