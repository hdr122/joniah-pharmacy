import { useState, useEffect } from "react";
import { MapView } from "@/components/Map";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RefreshCw, MapPin, Battery, Gauge, Clock, User, Eye, EyeOff, History, Package, FileText } from "lucide-react";
import { toast } from "sonner";

export default function TraccarDashboard() {
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [markers, setMarkers] = useState<google.maps.Marker[]>([]);
  const [polylines, setPolylines] = useState<google.maps.Polyline[]>([]);
  const [selectedPerson, setSelectedPerson] = useState<number | null>(null);
  const [showOffline, setShowOffline] = useState(true);
  const [timeRange, setTimeRange] = useState<string>("current");
  const [selectedOrder, setSelectedOrder] = useState<number | null>(null);
  const [showOrdersDialog, setShowOrdersDialog] = useState(false);
  const [selectedOrderForRoute, setSelectedOrderForRoute] = useState<number | null>(null);
  
  // Get all Traccar status
  const { data: traccarStatus, isLoading, refetch } = trpc.gps.getAllTraccarStatus.useQuery(undefined, {
    refetchInterval: 15000,
  });
  
  // Get historical route for selected person
  const { data: historicalRoute } = trpc.gps.getDeliveryRoute.useQuery(
    {
      userId: selectedPerson!,
      date: new Date().toISOString().split('T')[0],
      hours: timeRange === "current" ? 0 : parseInt(timeRange.replace('h', ''))
    },
    {
      enabled: selectedPerson !== null && timeRange !== "current",
    }
  );
  
  // Get active orders with locations
  const { data: activeOrders } = trpc.gps.getActiveOrdersWithLocations.useQuery();
  
  // Get delivery person orders
  const { data: deliveryPersonOrders } = trpc.gps.getDeliveryPersonOrders.useQuery(
    { deliveryPersonId: selectedPerson! },
    { enabled: selectedPerson !== null && showOrdersDialog }
  );
  
  // Get order complete route
  const { data: orderRouteData } = trpc.gps.getOrderCompleteRoute.useQuery(
    { orderId: selectedOrderForRoute! },
    { enabled: selectedOrderForRoute !== null }
  );
  
  // Initialize map
  const handleMapReady = (mapInstance: google.maps.Map) => {
    setMap(mapInstance);
    mapInstance.setCenter({ lat: 33.3152, lng: 44.3661 });
    mapInstance.setZoom(6);
  };
  
  // Draw historical route
  useEffect(() => {
    // Clear existing polylines first
    polylines.forEach(p => p.setMap(null));
    setPolylines([]);
    
    if (!map || !historicalRoute || historicalRoute.length === 0) {
      return;
    }
    
    // Filter out invalid coordinates
    const path = historicalRoute
      .filter((point: any) => {
        const lat = point.latitude;
        const lng = point.longitude;
        return lat != null && lng != null && 
               !isNaN(lat) && !isNaN(lng) &&
               lat >= -90 && lat <= 90 &&
               lng >= -180 && lng <= 180;
      })
      .map((point: any) => ({
        lat: point.latitude,
        lng: point.longitude
      }));
    
    // If no valid points after filtering, show message and return
    if (path.length === 0) {
      toast.info('لا توجد بيانات GPS صالحة للمسار المحدد');
      return;
    }
    
    try {
      const polyline = new google.maps.Polyline({
        path: path,
        geodesic: true,
        strokeColor: '#3b82f6',
        strokeOpacity: 0.8,
        strokeWeight: 3,
        map: map
      });
      
      setPolylines([polyline]);
      
      const bounds = new google.maps.LatLngBounds();
      path.forEach((point: google.maps.LatLng) => bounds.extend(point));
      map.fitBounds(bounds);
    } catch (error) {
      console.error('Error drawing route:', error);
      toast.error('حدث خطأ في رسم المسار');
    }
    
  }, [map, historicalRoute]);
  
  // Update markers when data changes
  useEffect(() => {
    if (!map || !traccarStatus) return;
    
    markers.forEach(marker => marker.setMap(null));
    
    const newMarkers: google.maps.Marker[] = [];
    const bounds = new google.maps.LatLngBounds();
    
    const filteredStatus = traccarStatus.filter((person: any) => {
      if (!showOffline && !person.online) return false;
      return person.configured && person.positions.length > 0;
    });
    
    filteredStatus.forEach((person: any) => {
      const position = person.positions[0];
      const lat = position.latitude;
      const lng = position.longitude;
      
      // Validate coordinates before creating LatLng
      if (!lat || !lng || 
          isNaN(lat) || isNaN(lng) ||
          lat < -90 || lat > 90 ||
          lng < -180 || lng > 180) {
        console.warn(`Invalid coordinates for ${person.name}: lat=${lat}, lng=${lng}`);
        return;
      }
      
      const latLng = new google.maps.LatLng(lat, lng);
      bounds.extend(latLng);
      
      const lastUpdate = new Date(position.deviceTime);
      const baghdadTime = new Intl.DateTimeFormat('ar-IQ', {
        timeZone: 'Asia/Baghdad',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }).format(lastUpdate);
      
      // Create custom marker with profile image
      const markerIcon = person.profileImage ? {
        url: person.profileImage,
        scaledSize: new google.maps.Size(40, 40),
        anchor: new google.maps.Point(20, 20),
      } : {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 10,
        fillColor: person.online ? '#10b981' : '#ef4444',
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 2,
      };
      
      const marker = new google.maps.Marker({
        position: latLng,
        map: map,
        title: person.name || person.username,
        icon: markerIcon,
        label: person.profileImage ? undefined : {
          text: (person.name || person.username).charAt(0).toUpperCase(),
          color: '#ffffff',
          fontSize: '12px',
          fontWeight: 'bold',
        },
      });
      
      const profileImageHtml = person.profileImage 
        ? `<img src="${person.profileImage}" style="width: 60px; height: 60px; border-radius: 50%; object-fit: cover; margin-bottom: 8px; border: 3px solid ${person.online ? '#10b981' : '#ef4444'};" />`
        : '';
      
      const infoWindow = new google.maps.InfoWindow({
        content: `
          <div style="padding: 12px; min-width: 220px; direction: rtl; text-align: right;">
            <div style="display: flex; flex-direction: column; align-items: center; margin-bottom: 12px;">
              ${profileImageHtml}
              <h3 style="margin: 4px 0; font-weight: bold; font-size: 16px;">${person.name || person.username}</h3>
            </div>
            <p style="margin: 6px 0; font-size: 14px;"><strong>السرعة:</strong> ${position.speed || 0} كم/س</p>
            <p style="margin: 6px 0; font-size: 14px;"><strong>البطارية:</strong> ${position.attributes?.battery || 'غير متوفر'}%</p>
            <p style="margin: 6px 0; font-size: 14px;"><strong>آخر تحديث:</strong> ${baghdadTime}</p>
            <p style="margin: 6px 0; font-size: 14px;"><strong>الحالة:</strong> ${person.online ? '<span style="color: #10b981; font-weight: bold;">متصل</span>' : '<span style="color: #ef4444; font-weight: bold;">غير متصل</span>'}</p>
          </div>
        `,
      });
      
      marker.addListener('click', () => {
        infoWindow.open(map, marker);
        setSelectedPerson(person.userId);
      });
      
      newMarkers.push(marker);
    });
    
    // Add order markers
    if (activeOrders && activeOrders.length > 0) {
      activeOrders.forEach(order => {
        const lat = order.deliveryPersonLatitude;
        const lng = order.deliveryPersonLongitude;
        
        // Validate coordinates before creating LatLng
        if (!lat || !lng ||
            isNaN(lat) || isNaN(lng) ||
            lat < -90 || lat > 90 ||
            lng < -180 || lng > 180) {
          console.warn(`Invalid order coordinates for order #${order.id}: lat=${lat}, lng=${lng}`);
          return;
        }
        
        const orderLatLng = new google.maps.LatLng(lat, lng);
        
        const orderMarker = new google.maps.Marker({
          position: orderLatLng,
          map: map,
          title: `طلب #${order.id}`,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: order.status === 'pending' ? '#f59e0b' : '#3b82f6',
            fillOpacity: 0.9,
            strokeColor: '#ffffff',
            strokeWeight: 2,
          },
        });
        
        const orderInfoWindow = new google.maps.InfoWindow({
          content: `
            <div style="padding: 8px; min-width: 180px; direction: rtl; text-align: right;">
              <h4 style="margin: 0 0 6px 0; font-weight: bold;">طلب #${order.id}</h4>
              <p style="margin: 4px 0;"><strong>المندوب:</strong> ${order.deliveryPersonName}</p>
              <p style="margin: 4px 0;"><strong>المنطقة:</strong> ${order.regionName}</p>
              <p style="margin: 4px 0;"><strong>السعر:</strong> ${order.price} دينار</p>
              <p style="margin: 4px 0;"><strong>الحالة:</strong> ${order.status === 'pending' ? 'قيد التوصيل' : 'في الانتظار'}</p>
            </div>
          `,
        });
        
        orderMarker.addListener('click', () => {
          orderInfoWindow.open(map, orderMarker);
          setSelectedOrder(order.id);
        });
        
        newMarkers.push(orderMarker);
      });
    }
    
    setMarkers(newMarkers);
    
    if (newMarkers.length > 0 && !historicalRoute) {
      map.fitBounds(bounds);
    }
  }, [map, traccarStatus, showOffline, activeOrders]);
  
  // Draw order route when selected
  useEffect(() => {
    // Clear previous polylines first
    polylines.forEach(p => p.setMap(null));
    setPolylines([]);
    
    if (!map || !orderRouteData || !orderRouteData.route || orderRouteData.route.length === 0) {
      return;
    }
    
    // Filter out invalid coordinates
    const path = orderRouteData.route
      .filter((point: any) => {
        const lat = point.latitude;
        const lng = point.longitude;
        return lat != null && lng != null && 
               !isNaN(lat) && !isNaN(lng) &&
               lat >= -90 && lat <= 90 &&
               lng >= -180 && lng <= 180;
      })
      .map((point: any) => ({
        lat: point.latitude,
        lng: point.longitude
      }));
    
    // Need at least 2 points to draw a route
    if (path.length < 2) {
      toast.info('لا توجد بيانات GPS كافية لرسم مسار هذا الطلب');
      return;
    }
    
    try {
      const polyline = new google.maps.Polyline({
        path: path,
        geodesic: true,
        strokeColor: '#10b981',
        strokeOpacity: 0.8,
        strokeWeight: 4,
        map: map
      });
      
      setPolylines([polyline]);
      
      // Add start and end markers
      const startPoint = path[0];
      const endPoint = path[path.length - 1];
    
    const startMarker = new google.maps.Marker({
      position: startPoint,
      map: map,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 8,
        fillColor: '#10b981',
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 2,
      },
      label: {
        text: 'بداية',
        color: '#10b981',
        fontSize: '12px',
        fontWeight: 'bold',
      },
    });
    
    const endMarker = new google.maps.Marker({
      position: endPoint,
      map: map,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 8,
        fillColor: '#ef4444',
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 2,
      },
      label: {
        text: 'نهاية',
        color: '#ef4444',
        fontSize: '12px',
        fontWeight: 'bold',
      },
    });
    
      const bounds = new google.maps.LatLngBounds();
      path.forEach((point: any) => bounds.extend(point));
      map.fitBounds(bounds);
      
      return () => {
        startMarker.setMap(null);
        endMarker.setMap(null);
      };
    } catch (error) {
      console.error('Error drawing order route:', error);
      toast.error('حدث خطأ في رسم مسار الطلب');
    }
  }, [map, orderRouteData]);
  
  const handleRefresh = () => {
    refetch();
    toast.success('تم تحديث البيانات');
  };
  
  const onlineCount = traccarStatus?.filter((p: any) => p.online).length || 0;
  const totalCount = traccarStatus?.length || 0;
  const offlineCount = totalCount - onlineCount;
  
  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">خريطة تتبع المندوبين</h1>
          <p className="text-muted-foreground mt-2">
            تتبع مباشر لجميع المندوبين والطلبات النشطة في الوقت الفعلي
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={showOffline ? "default" : "outline"}
            onClick={() => setShowOffline(!showOffline)}
          >
            {showOffline ? <Eye className="h-4 w-4 mr-2" /> : <EyeOff className="h-4 w-4 mr-2" />}
            {showOffline ? 'إخفاء غير المتصلين' : 'إظهار الكل'}
          </Button>
          <Button onClick={handleRefresh} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            تحديث
          </Button>
        </div>
      </div>
      
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">إجمالي المندوبين</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCount}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">متصل الآن</CardTitle>
            <MapPin className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{onlineCount}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">غير متصل</CardTitle>
            <MapPin className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{offlineCount}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">نسبة الاتصال</CardTitle>
            <Gauge className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalCount > 0 ? Math.round((onlineCount / totalCount) * 100) : 0}%
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">الطلبات النشطة</CardTitle>
            <Package className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {activeOrders?.length || 0}
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Map and List */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Map */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>الخريطة المباشرة</CardTitle>
                <CardDescription>
                  مواقع المندوبين والطلبات النشطة في الوقت الفعلي
                </CardDescription>
              </div>
              {selectedPerson && (
                <div className="flex items-center gap-2">
                  <History className="h-4 w-4 text-muted-foreground" />
                  <Select value={timeRange} onValueChange={setTimeRange}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="اختر الفترة الزمنية" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="current">الموقع الحالي</SelectItem>
                      <SelectItem value="1h">آخر ساعة</SelectItem>
                      <SelectItem value="3h">آخر 3 ساعات</SelectItem>
                      <SelectItem value="6h">آخر 6 ساعات</SelectItem>
                      <SelectItem value="12h">آخر 12 ساعة</SelectItem>
                      <SelectItem value="24h">آخر 24 ساعة</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[600px] rounded-lg overflow-hidden border">
              <MapView onMapReady={handleMapReady} />
            </div>
            <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span>متصل</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span>غير متصل</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-amber-500" />
                <span>طلب قيد التوصيل</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <span>طلب في الانتظار</span>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Delivery Persons List */}
        <Card>
          <CardHeader>
            <CardTitle>قائمة المندوبين</CardTitle>
            <CardDescription>
              حالة الاتصال والبيانات الحية
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {traccarStatus
                ?.filter((person: any) => showOffline || person.online)
                .map((person: any) => {
                  const position = person.positions[0];
                  const isSelected = selectedPerson === person.userId;
                  
                  // Calculate relative time from deviceTime
                  let relativeTime = 'غير متوفر';
                  let lastUpdateDate: Date | null = null;
                  
                  if (position && position.deviceTime) {
                    // Parse deviceTime - handle both string and Date formats
                    try {
                      lastUpdateDate = new Date(position.deviceTime);
                      
                      // Validate the date
                      if (!isNaN(lastUpdateDate.getTime())) {
                        const now = new Date();
                        const diffMs = now.getTime() - lastUpdateDate.getTime();
                        const diffSeconds = Math.floor(diffMs / 1000);
                        const diffMinutes = Math.floor(diffSeconds / 60);
                        const diffHours = Math.floor(diffMinutes / 60);
                        const diffDays = Math.floor(diffHours / 24);
                        
                        if (diffSeconds < 0) {
                          relativeTime = 'الآن';
                        } else if (diffSeconds < 60) {
                          relativeTime = `منذ ${diffSeconds} ثانية`;
                        } else if (diffMinutes < 60) {
                          relativeTime = `منذ ${diffMinutes} دقيقة`;
                        } else if (diffHours < 24) {
                          relativeTime = `منذ ${diffHours} ساعة`;
                        } else {
                          relativeTime = `منذ ${diffDays} يوم`;
                        }
                        
                        // Also show absolute time for clarity
                        const baghdadTime = new Intl.DateTimeFormat('ar-IQ', {
                          timeZone: 'Asia/Baghdad',
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: true
                        }).format(lastUpdateDate);
                        relativeTime += ` (الساعة ${baghdadTime})`;
                      }
                    } catch (e) {
                      console.error('Error parsing deviceTime:', e);
                      relativeTime = 'خطأ في التاريخ';
                    }
                  }
                  
                  return (
                    <div
                      key={person.userId}
                      className={`border rounded-lg p-3 space-y-2 cursor-pointer transition-colors ${
                        isSelected ? 'bg-primary/5 border-primary' : 'hover:bg-muted/50'
                      }`}
                      onClick={() => {
                        setSelectedPerson(person.userId);
                        setTimeRange("current");
                        if (position && map) {
                          map.panTo({ lat: position.latitude, lng: position.longitude });
                          map.setZoom(15);
                        }
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full ${person.online ? 'bg-green-500' : 'bg-red-500'}`} />
                          <span className="font-medium">{person.name || person.username}</span>
                        </div>
                        <Badge variant={person.online ? "default" : "secondary"}>
                          {person.online ? 'متصل' : 'غير متصل'}
                        </Badge>
                      </div>
                      
                      {!person.configured && (
                        <p className="text-sm text-orange-600">
                          لم يتم تكوين بيانات Traccar
                        </p>
                      )}
                      
                      {person.error && (
                        <p className="text-sm text-red-600">{person.error}</p>
                      )}
                      
                      {position && (
                        <div className="text-sm space-y-1 text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <Gauge className="h-3 w-3" />
                            <span>السرعة: {position.speed || 0} كم/س</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Battery className="h-3 w-3" />
                            <span>البطارية: {position.attributes?.battery || 'غير متوفر'}%</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="h-3 w-3" />
                            <span>آخر تحديث: {relativeTime}</span>
                          </div>
                        </div>
                      )}
                      
                      {isSelected && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full mt-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowOrdersDialog(true);
                          }}
                        >
                          <FileText className="h-4 w-4 mr-2" />
                          سجل الطلبات
                        </Button>
                      )}
                    </div>
                  );
                })}
              
              {(!traccarStatus || traccarStatus.length === 0) && (
                <div className="text-center py-8 text-muted-foreground">
                  <MapPin className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>لا يوجد مندوبون</p>
                </div>
              )}
              
              {traccarStatus && traccarStatus.length > 0 && !showOffline && onlineCount === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <EyeOff className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>لا يوجد مندوبون متصلون حالياً</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => setShowOffline(true)}
                  >
                    إظهار جميع المندوبين
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Orders Dialog */}
      <Dialog open={showOrdersDialog} onOpenChange={setShowOrdersDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>سجل طلبات المندوب</DialogTitle>
            <DialogDescription>
              عرض جميع الطلبات الخاصة بالمندوب المختار
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-3">
            {deliveryPersonOrders && deliveryPersonOrders.length > 0 ? (
              deliveryPersonOrders.map((order: any) => {
                const isOrderSelected = selectedOrderForRoute === order.id;
                
                // Format dates
                const createdDate = new Date(order.createdAt).toLocaleDateString('ar-IQ');
                const acceptedDate = order.acceptedAt ? new Date(order.acceptedAt).toLocaleDateString('ar-IQ') : null;
                const deliveredDate = order.deliveredAt ? new Date(order.deliveredAt).toLocaleDateString('ar-IQ') : null;
                
                // Status badge color
                const statusColors: Record<string, string> = {
                  pending: 'bg-yellow-500',
                  delivered: 'bg-green-500',
                  postponed: 'bg-orange-500',
                  cancelled: 'bg-red-500',
                  returned: 'bg-purple-500',
                };
                
                const statusLabels: Record<string, string> = {
                  pending: 'قيد التوصيل',
                  delivered: 'تم التسليم',
                  postponed: 'مؤجل',
                  cancelled: 'ملغي',
                  returned: 'مرتجع',
                };
                
                return (
                  <div
                    key={order.id}
                    className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                      isOrderSelected ? 'bg-primary/5 border-primary' : 'hover:bg-muted/50'
                    }`}
                    onClick={() => {
                      setSelectedOrderForRoute(order.id);
                      setShowOrdersDialog(false);
                      toast.success(`تم عرض مسار الطلب #${order.id}`);
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Package className="h-5 w-5 text-primary" />
                        <span className="font-bold text-lg">طلب #{order.id}</span>
                      </div>
                      <Badge className={statusColors[order.status] || 'bg-gray-500'}>
                        {statusLabels[order.status] || order.status}
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-muted-foreground">العميل:</span>
                        <span className="font-medium mr-2">{order.customerName || 'غير متوفر'}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">الهاتف:</span>
                        <span className="font-medium mr-2">{order.customerPhone || 'غير متوفر'}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">المنطقة:</span>
                        <span className="font-medium mr-2">{order.regionName}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">المحافظة:</span>
                        <span className="font-medium mr-2">{order.provinceName}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">السعر:</span>
                        <span className="font-medium mr-2">{order.price} دينار</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">تاريخ الإنشاء:</span>
                        <span className="font-medium mr-2">{createdDate}</span>
                      </div>
                      {acceptedDate && (
                        <div>
                          <span className="text-muted-foreground">تاريخ القبول:</span>
                          <span className="font-medium mr-2">{acceptedDate}</span>
                        </div>
                      )}
                      {deliveredDate && (
                        <div>
                          <span className="text-muted-foreground">تاريخ التسليم:</span>
                          <span className="font-medium mr-2">{deliveredDate}</span>
                        </div>
                      )}
                    </div>
                    
                    {order.note && (
                      <div className="mt-2 text-sm">
                        <span className="text-muted-foreground">ملاحظة:</span>
                        <p className="text-muted-foreground mt-1">{order.note}</p>
                      </div>
                    )}
                    
                    {order.deliveryNote && (
                      <div className="mt-2 text-sm">
                        <span className="text-muted-foreground">ملاحظة المندوب:</span>
                        <p className="text-muted-foreground mt-1">{order.deliveryNote}</p>
                      </div>
                    )}
                    
                    {order.deliveryLocationName && (
                      <div className="mt-2 text-sm">
                        <span className="text-muted-foreground">مكان التسليم:</span>
                        <p className="text-muted-foreground mt-1">{order.deliveryLocationName}</p>
                      </div>
                    )}
                    
                    {order.deliveryImage && (
                      <div className="mt-3">
                        <span className="text-sm text-muted-foreground block mb-2">صورة التسليم:</span>
                        <img
                          src={order.deliveryImage}
                          alt="صورة التسليم"
                          className="w-full h-48 object-cover rounded-lg border"
                          onError={(e) => {
                            console.error('Image load error:', order.deliveryImage);
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>لا توجد طلبات لهذا المندوب</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
