import { useState, useEffect } from "react";
import { MapView } from "@/components/Map";
import WazeMap from "@/components/WazeMap";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RefreshCw, MapPin, Battery, Gauge, Clock, User, Eye, EyeOff, History, Package, TrendingUp, Navigation, Activity, Target, Route, AlertTriangle, CheckCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

// Create custom marker with profile image and direction arrow using Canvas
function createDeliveryPersonMarker(
  map: google.maps.Map,
  position: google.maps.LatLngLiteral,
  heading: number | null,
  profileImage: string | null,
  online: boolean,
  name: string
): google.maps.Marker {
  // Create canvas for marker
  const canvas = document.createElement('canvas');
  canvas.width = 60;
  canvas.height = 80; // Extra space for arrow
  const ctx = canvas.getContext('2d')!;
  
  // Create image
  const img = new Image();
  img.crossOrigin = 'anonymous';
  const imageUrl = profileImage || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=10b981&color=fff&size=50`;
  
  // Draw immediately with placeholder, then update when image loads
  const borderColor = online ? '#22c55e' : '#ef4444';
  
  // Draw border circle
  ctx.beginPath();
  ctx.arc(30, 35, 26, 0, 2 * Math.PI);
  ctx.fillStyle = borderColor;
  ctx.fill();
  
  // Draw white inner circle
  ctx.beginPath();
  ctx.arc(30, 35, 23, 0, 2 * Math.PI);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  
  // Draw direction arrow if heading available
  if (heading !== null && heading !== undefined) {
    ctx.save();
    ctx.translate(30, 15);
    ctx.rotate((heading * Math.PI) / 180);
    ctx.font = 'bold 20px Arial';
    ctx.fillStyle = borderColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('▲', 0, 0);
    ctx.restore();
  }
  
  const marker = new google.maps.Marker({
    position,
    map,
    icon: {
      url: canvas.toDataURL(),
      scaledSize: new google.maps.Size(60, 80),
      anchor: new google.maps.Point(30, 40),
    },
  });
  
  // Load and draw profile image
  img.onload = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw direction arrow
    if (heading !== null && heading !== undefined) {
      ctx.save();
      ctx.translate(30, 15);
      ctx.rotate((heading * Math.PI) / 180);
      ctx.font = 'bold 20px Arial';
      ctx.fillStyle = borderColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('▲', 0, 0);
      ctx.restore();
    }
    
    // Draw border circle
    ctx.beginPath();
    ctx.arc(30, 35, 26, 0, 2 * Math.PI);
    ctx.fillStyle = borderColor;
    ctx.fill();
    
    // Clip to circle for image
    ctx.save();
    ctx.beginPath();
    ctx.arc(30, 35, 23, 0, 2 * Math.PI);
    ctx.clip();
    
    // Draw profile image
    ctx.drawImage(img, 7, 12, 46, 46);
    ctx.restore();
    
    // Update marker icon
    marker.setIcon({
      url: canvas.toDataURL(),
      scaledSize: new google.maps.Size(60, 80),
      anchor: new google.maps.Point(30, 40),
    });
  };
  
  img.onerror = () => {
    // If image fails to load, keep the placeholder
    console.warn('Failed to load profile image:', imageUrl);
  };
  
  img.src = imageUrl;
  
  return marker;
}

export default function AdvancedTracking() {
  // Get orderId from URL if present
  const urlParams = new URLSearchParams(window.location.search);
  const orderIdFromUrl = urlParams.get('orderId');
  
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [markers, setMarkers] = useState<google.maps.Marker[]>([]);
  const [polylines, setPolylines] = useState<google.maps.Polyline[]>([]);
  const [heatmap, setHeatmap] = useState<google.maps.visualization.HeatmapLayer | null>(null);
  const [selectedPerson, setSelectedPerson] = useState<number | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(orderIdFromUrl ? parseInt(orderIdFromUrl) : null);
  const [showOffline, setShowOffline] = useState(true);
  const [viewMode, setViewMode] = useState<"current" | "history" | "heatmap" | "orders">(orderIdFromUrl ? "orders" : "current");
  const [timeRange, setTimeRange] = useState<number>(24);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [useWaze, setUseWaze] = useState(() => {
    const saved = localStorage.getItem('advancedTracking_useWaze');
    return saved === 'true';
  });

  // Save Waze preference
  useEffect(() => {
    localStorage.setItem('advancedTracking_useWaze', useWaze.toString());
  }, [useWaze]);

  // Get all delivery persons live status
  const { data: liveStatus, isLoading, refetch } = trpc.gps.getAllLiveStatus.useQuery(undefined, {
    refetchInterval: 10000, // Update every 10 seconds
  });

  // Get historical routes
  const { data: historicalRoutes } = trpc.gps.getAllRoutes.useQuery(
    { deliveryPersonId: selectedPerson!, days: 7 },
    { enabled: selectedPerson !== null && viewMode === "history" }
  );

  // Get heatmap data
  const { data: heatmapData } = trpc.gps.getHeatmapData.useQuery(
    { deliveryPersonId: selectedPerson!, days: 30 },
    { enabled: selectedPerson !== null && viewMode === "heatmap" }
  );

  // Get advanced stats
  const { data: advancedStats } = trpc.gps.getAdvancedStats.useQuery(
    { deliveryPersonId: selectedPerson! },
    { enabled: selectedPerson !== null }
  );

  // Get route with timeline
  const { data: routeTimeline } = trpc.gps.getRouteWithTimeline.useQuery(
    { deliveryPersonId: selectedPerson!, hours: timeRange },
    { enabled: selectedPerson !== null && viewMode === "history" }
  );

  // Get delivery person orders
  const { data: deliveryOrders } = trpc.gps.getDeliveryPersonOrders.useQuery(
    { deliveryPersonId: selectedPerson! },
    { enabled: selectedPerson !== null && viewMode === "orders" }
  );

  // Get order complete route
  const { data: orderRoute } = trpc.gps.getOrderCompleteRoute.useQuery(
    { orderId: selectedOrderId! },
    { enabled: selectedOrderId !== null }
  );

  // Get active orders with live tracking
  const { data: activeOrdersLive, refetch: refetchActiveOrders } = trpc.orderRouteTracking.getActiveOrdersLive.useQuery(undefined, {
    refetchInterval: 5000, // Update every 5 seconds
  });

  // Get live tracking for selected order
  const { data: selectedOrderLiveTracking } = trpc.orderRouteTracking.getLiveTracking.useQuery(
    { orderId: selectedOrderId! },
    { enabled: selectedOrderId !== null, refetchInterval: 3000 }
  );

  // State for showing active orders panel
  const [showActiveOrdersPanel, setShowActiveOrdersPanel] = useState(false);

  // Initialize map
  const handleMapReady = (mapInstance: google.maps.Map) => {
    setMap(mapInstance);
    mapInstance.setCenter({ lat: 33.3152, lng: 44.3661 }); // Baghdad
    mapInstance.setZoom(11);
  };

  // Filter delivery persons based on showOffline
  const filteredPersons = liveStatus?.filter((person: any) => {
    if (showOffline) return true;
    return person.online;
  }) || [];

  // Count online/offline
  const onlineCount = liveStatus?.filter((p: any) => p.online).length || 0;
  const offlineCount = (liveStatus?.length || 0) - onlineCount;

  // Draw current positions with rotation
  useEffect(() => {
    if (!map || !filteredPersons.length) {
      // Clear markers if no persons
      setMarkers(prev => {
        prev.forEach(m => m.setMap(null));
        return [];
      });
      return;
    }

    // Clear existing markers
    setMarkers(prev => {
      prev.forEach(m => m.setMap(null));
      return [];
    });
    
    const newMarkers: google.maps.Marker[] = [];

    filteredPersons.forEach((person: any) => {
      if (!person.positions || person.positions.length === 0) return;

      const position = person.positions[0];
      const lat = parseFloat(position.latitude);
      const lng = parseFloat(position.longitude);

      // Validate coordinates
      if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return;
      }

      const heading = position.heading ? parseFloat(position.heading) : null;
      const profileImage = person.profileImage || null;

      const marker = createDeliveryPersonMarker(
        map,
        { lat, lng },
        heading,
        profileImage,
        person.online,
        person.name || person.username || 'مندوب'
      );

      // Add click listener
      marker.addListener("click", () => {
        setSelectedPerson(person.userId);
        setShowDetailsDialog(true);
        setViewMode("current");
        
        // Center map on selected person
        map.panTo({ lat, lng });
        map.setZoom(14);
      });

      // Add info window on hover
      const infoWindow = new google.maps.InfoWindow({
        content: `
          <div style="padding: 8px; min-width: 200px;">
            <h3 style="margin: 0 0 8px 0; font-weight: bold;">${person.name || person.username}</h3>
            <div style="display: flex; flex-direction: column; gap: 4px; font-size: 13px;">
              <div>📍 السرعة: ${position.speed || 0} كم/س</div>
              <div>🔋 البطارية: ${position.attributes?.battery || 'N/A'}%</div>
              <div>🕐 آخر تحديث: ${new Date(position.deviceTime).toLocaleTimeString('ar-IQ')}</div>
              <div>📶 الحالة: <span style="color: ${person.online ? '#22c55e' : '#ef4444'}">${person.online ? 'متصل' : 'غير متصل'}</span></div>
            </div>
          </div>
        `,
      });

      marker.addListener("mouseover", () => {
        infoWindow.open(map, marker);
      });

      marker.addListener("mouseout", () => {
        infoWindow.close();
      });

      newMarkers.push(marker);
    });

    setMarkers(newMarkers);

    // Auto-fit map to show all delivery persons with valid positions
    if (newMarkers.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      let hasValidBounds = false;
      filteredPersons.forEach((person: any) => {
        if (!person.positions || person.positions.length === 0) return;
        const pos = person.positions[0];
        const lat = parseFloat(pos.latitude);
        const lng = parseFloat(pos.longitude);
        if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
          bounds.extend({ lat, lng });
          hasValidBounds = true;
        }
      });
      if (hasValidBounds) {
        if (newMarkers.length === 1) {
          // If only one person, center and zoom
          map.setCenter(bounds.getCenter());
          map.setZoom(15);
        } else {
          map.fitBounds(bounds, 80); // 80px padding
        }
      }
    }

    // Cleanup function
    return () => {
      newMarkers.forEach(m => m.setMap(null));
    };
  }, [map, liveStatus, showOffline]); // Use liveStatus instead of filteredPersons to avoid infinite loop

  // Draw historical routes
  useEffect(() => {
    if (!map || viewMode !== "history" || !historicalRoutes || historicalRoutes.length === 0) {
      // Clear polylines
      polylines.forEach(p => p.setMap(null));
      setPolylines([]);
      return;
    }

    // Clear existing polylines
    polylines.forEach(p => p.setMap(null));

    // Filter valid coordinates
    const path = historicalRoutes
      .filter((point: any) => {
        const lat = parseFloat(point.latitude);
        const lng = parseFloat(point.longitude);
        return !isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
      })
      .map((point: any) => ({
        lat: parseFloat(point.latitude),
        lng: parseFloat(point.longitude),
      }));

    if (path.length < 2) {
      toast.info('لا توجد بيانات كافية لرسم المسار');
      return;
    }

    const polyline = new google.maps.Polyline({
      path,
      geodesic: true,
      strokeColor: '#3b82f6',
      strokeOpacity: 0.7,
      strokeWeight: 4,
      map,
    });

    setPolylines([polyline]);

    // Fit bounds to show entire route
    const bounds = new google.maps.LatLngBounds();
    path.forEach((p: google.maps.LatLng) => bounds.extend(p));
    map.fitBounds(bounds);

    return () => {
      polyline.setMap(null);
    };
  }, [map, viewMode, historicalRoutes]);

  // Draw heatmap
  useEffect(() => {
    if (!map || viewMode !== "heatmap" || !heatmapData || heatmapData.length === 0) {
      // Clear heatmap
      if (heatmap) {
        heatmap.setMap(null);
        setHeatmap(null);
      }
      return;
    }

    // Check if visualization library is loaded
    if (!google.maps.visualization || !google.maps.visualization.HeatmapLayer) {
      toast.error('مكتبة الخرائط الحرارية غير محملة');
      return;
    }

    // Clear existing heatmap
    if (heatmap) {
      heatmap.setMap(null);
    }

    // Create heatmap data
    const heatmapPoints = heatmapData
      .filter((point: any) => {
        const lat = parseFloat(point.lat as any);
        const lng = parseFloat(point.lng as any);
        return !isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
      })
      .map((point: any) => ({
        location: new google.maps.LatLng(parseFloat(point.lat as any), parseFloat(point.lng as any)),
        weight: point.weight,
      }));

    if (heatmapPoints.length === 0) {
      toast.info('لا توجد بيانات كافية لعرض الخريطة الحرارية');
      return;
    }

    try {
      const heatmapLayer = new google.maps.visualization.HeatmapLayer({
        data: heatmapPoints,
        map,
        radius: 30,
        opacity: 0.6,
      });

      setHeatmap(heatmapLayer);

      // Fit bounds
      const bounds = new google.maps.LatLngBounds();
      heatmapPoints.forEach((p: any) => bounds.extend(p.location));
      map.fitBounds(bounds);

      return () => {
        heatmapLayer.setMap(null);
      };
    } catch (error) {
      console.error('Heatmap error:', error);
      toast.error('حدث خطأ في عرض الخريطة الحرارية');
    }
  }, [map, viewMode, heatmapData]);

  // Draw order route
  useEffect(() => {
    if (!map || !orderRoute || !orderRoute.route || orderRoute.route.length === 0) {
      return;
    }

    // Clear existing polylines
    polylines.forEach(p => p.setMap(null));

    const path = orderRoute.route
      .filter((point: any) => {
        const lat = parseFloat(point.latitude);
        const lng = parseFloat(point.longitude);
        return !isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
      })
      .map((point: any) => ({
        lat: parseFloat(point.latitude),
        lng: parseFloat(point.longitude),
      }));

    if (path.length < 2) {
      toast.error('لا توجد بيانات GPS كافية لهذا الطلب');
      return;
    }

    const polyline = new google.maps.Polyline({
      path,
      geodesic: true,
      strokeColor: '#8b5cf6',
      strokeOpacity: 0.8,
      strokeWeight: 4,
      map,
    });

    setPolylines([polyline]);

    // Add markers for start and end
    const startMarker = new google.maps.Marker({
      position: path[0],
      map,
      label: 'بداية',
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 8,
        fillColor: '#22c55e',
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 2,
      },
    });

    const endMarker = new google.maps.Marker({
      position: path[path.length - 1],
      map,
      label: 'نهاية',
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 8,
        fillColor: '#ef4444',
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 2,
      },
    });

    // Fit bounds
    const bounds = new google.maps.LatLngBounds();
    path.forEach((p: google.maps.LatLng) => bounds.extend(p));
    map.fitBounds(bounds);

    return () => {
      polyline.setMap(null);
      startMarker.setMap(null);
      endMarker.setMap(null);
    };
  }, [map, orderRoute]);

  const selectedPersonData = liveStatus?.find((p: any) => p.userId === selectedPerson);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">خريطة تتبع المندوبين المتقدمة</h1>
          <p className="text-muted-foreground mt-1">
            تتبع شامل مع المسارات التاريخية والأماكن الأكثر زيارة
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg">
            <Label htmlFor="waze-mode" className="text-sm font-medium cursor-pointer">
              {useWaze ? 'Waze' : 'Google Maps'}
            </Label>
            <Switch
              id="waze-mode"
              checked={useWaze}
              onCheckedChange={setUseWaze}
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowOffline(!showOffline)}
          >
            {showOffline ? <Eye className="h-4 w-4 ml-2" /> : <EyeOff className="h-4 w-4 ml-2" />}
            {showOffline ? 'إخفاء غير المتصلين' : 'إظهار الكل'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ml-2 ${isLoading ? 'animate-spin' : ''}`} />
            تحديث
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">المندوبين المتصلين</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{onlineCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">غير المتصلين</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{offlineCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">إجمالي المندوبين</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{liveStatus?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">نسبة الاتصال</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {liveStatus && liveStatus.length > 0
                ? Math.round((onlineCount / liveStatus.length) * 100)
                : 0}%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Map */}
      <Card>
        <CardContent className="p-0">
          <div style={{ height: '600px', width: '100%' }}>
            {useWaze ? (
              <WazeMap
                showLivePreview={true}
                locations={filteredPersons
                  .filter((p: any) => p.positions && p.positions.length > 0)
                  .map((p: any) => ({
                    latitude: p.positions[0].latitude,
                    longitude: p.positions[0].longitude,
                    deliveryPersonName: p.name || p.username,
                    status: p.online ? 'online' : 'offline',
                    activeOrders: p.activeOrders || 0,
                    timestamp: new Date(p.positions[0].deviceTime),
                  }))}
                routes={viewMode === 'history' && historicalRoutes && selectedPerson ? [
                  {
                    deliveryPersonId: selectedPerson,
                    deliveryPersonName: selectedPersonData?.name || 'مندوب',
                    path: historicalRoutes
                      .filter((point: any) => {
                        const lat = parseFloat(point.latitude);
                        const lng = parseFloat(point.longitude);
                        return !isNaN(lat) && !isNaN(lng);
                      })
                      .map((point: any) => ({
                        lat: parseFloat(point.latitude),
                        lng: parseFloat(point.longitude),
                      })),
                  },
                ] : []}
              />
            ) : (
              <MapView onMapReady={handleMapReady} />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              {selectedPersonData?.name || 'مندوب'}
            </DialogTitle>
            <DialogDescription>
              تفاصيل شاملة عن المندوب ومساراته
            </DialogDescription>
          </DialogHeader>

          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="current">الموقع الحالي</TabsTrigger>
              <TabsTrigger value="history">المسارات التاريخية</TabsTrigger>
              <TabsTrigger value="heatmap">الأماكن الأكثر زيارة</TabsTrigger>
              <TabsTrigger value="orders">سجل الطلبات</TabsTrigger>
            </TabsList>

            <TabsContent value="current" className="space-y-4">
              {selectedPersonData && selectedPersonData.positions && selectedPersonData.positions.length > 0 ? (
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Gauge className="h-4 w-4" />
                        السرعة الحالية
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {selectedPersonData.positions[0].speed || 0} كم/س
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Battery className="h-4 w-4" />
                        البطارية
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {selectedPersonData.positions[0].attributes?.battery || 'N/A'}%
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Navigation className="h-4 w-4" />
                        الاتجاه
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {selectedPersonData.positions[0].heading ? `${selectedPersonData.positions[0].heading}°` : 'N/A'}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        آخر تحديث
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-sm">
                        {new Date(selectedPersonData.positions[0].deviceTime).toLocaleString('ar-IQ', { hour12: false, timeZone: 'Asia/Baghdad' })}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  لا توجد بيانات موقع حالية
                </div>
              )}

              {/* Advanced Stats */}
              {advancedStats && (
                <div className="mt-4">
                  <h3 className="text-lg font-semibold mb-3">إحصائيات اليوم</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <TrendingUp className="h-4 w-4" />
                          المسافة المقطوعة
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">
                          {advancedStats.totalDistance.toFixed(2)} كم
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Gauge className="h-4 w-4" />
                          متوسط السرعة
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">
                          {advancedStats.averageSpeed} كم/س
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Activity className="h-4 w-4" />
                          عدد التوقفات
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">
                          {advancedStats.stopsCount}
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          الوقت في الطريق
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">
                          {Math.floor(advancedStats.workingTimeMinutes / 60)}س {advancedStats.workingTimeMinutes % 60}د
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="history" className="space-y-4">
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium">الفترة الزمنية:</label>
                <Select value={timeRange.toString()} onValueChange={(v) => setTimeRange(parseInt(v))}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">آخر ساعة</SelectItem>
                    <SelectItem value="6">آخر 6 ساعات</SelectItem>
                    <SelectItem value="12">آخر 12 ساعة</SelectItem>
                    <SelectItem value="24">آخر 24 ساعة</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {historicalRoutes && historicalRoutes.length > 0 ? (
                <div className="space-y-3">
                  <div className="text-sm text-muted-foreground">
                    عدد النقاط: {historicalRoutes.length}
                  </div>
                  
                  {/* Timeline */}
                  {routeTimeline && routeTimeline.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-sm font-semibold mb-2">نقاط التوقف:</h4>
                      <div className="space-y-2 max-h-[300px] overflow-y-auto">
                        {routeTimeline
                          .filter((point: any) => point.isStop)
                          .map((point: any, idx: number) => (
                            <div key={idx} className="flex items-center gap-2 text-sm p-2 bg-muted rounded">
                              <MapPin className="h-4 w-4 text-red-500" />
                              <div className="flex-1">
                                <div className="font-medium">
                                  {new Date(point.timestamp).toLocaleTimeString('ar-IQ')}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  السرعة: {point.speed || 0} كم/س
                                </div>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  لا توجد بيانات مسار للفترة المحددة
                </div>
              )}
            </TabsContent>

            <TabsContent value="heatmap" className="space-y-4">
              {heatmapData && heatmapData.length > 0 ? (
                <div className="space-y-3">
                  <div className="text-sm text-muted-foreground">
                    عدد الأماكن الأكثر زيارة: {heatmapData.length}
                  </div>
                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {heatmapData.slice(0, 10).map((location: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-muted rounded">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          <div>
                            <div className="font-medium">الموقع #{idx + 1}</div>
                            <div className="text-xs text-muted-foreground">
                              {location.lat}, {location.lng}
                            </div>
                          </div>
                        </div>
                        <Badge variant="secondary">{location.weight} زيارة</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  لا توجد بيانات كافية لعرض الأماكن الأكثر زيارة
                </div>
              )}
            </TabsContent>

            <TabsContent value="orders" className="space-y-4">
              {deliveryOrders && deliveryOrders.length > 0 ? (
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {deliveryOrders.map((order: any) => (
                    <div key={order.id} className="flex items-center justify-between p-3 bg-muted rounded">
                      <div className="flex items-center gap-3">
                        <Package className="h-5 w-5" />
                        <div>
                          <div className="font-medium">طلب #{order.id}</div>
                          <div className="text-xs text-muted-foreground">
                            {order.customerName || 'عميل'} - {order.price} د.ع
                          </div>
                          <div className="text-xs">
                            <Badge variant={
                              order.status === 'delivered' ? 'default' :
                              order.status === 'pending' ? 'secondary' :
                              'destructive'
                            }>
                              {order.status === 'delivered' ? 'مسلم' :
                               order.status === 'pending' ? 'قيد التوصيل' :
                               order.status === 'pending_approval' ? 'بانتظار الموافقة' :
                               order.status}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedOrderId(order.id);
                          toast.info('جاري تحميل مسار الطلب...');
                        }}
                      >
                        <MapPin className="h-4 w-4 ml-2" />
                        عرض المسار
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  لا توجد طلبات لهذا المندوب
                </div>
              )}
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowDetailsDialog(false);
              setSelectedPerson(null);
              setViewMode("current");
              setSelectedOrderId(null);
              // Clear polylines and heatmap
              polylines.forEach(p => p.setMap(null));
              setPolylines([]);
              if (heatmap) {
                heatmap.setMap(null);
                setHeatmap(null);
              }
            }}>
              إغلاق
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Active Orders Live Tracking */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-emerald-600" />
              تتبع الطلبات النشطة في الوقت الفعلي
            </CardTitle>
            <CardDescription>
              الطلبات التي يتم توصيلها حالياً مع تتبع GPS مباشر
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              {activeOrdersLive?.filter((o: any) => o.isTracking).length || 0} طلب قيد التتبع
            </Badge>
            <Button variant="outline" size="sm" onClick={() => refetchActiveOrders()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {activeOrdersLive && activeOrdersLive.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeOrdersLive.map((order: any) => (
                <div
                  key={order.id}
                  className={`p-4 border rounded-lg cursor-pointer transition-all hover:shadow-md ${
                    selectedOrderId === order.id ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950' : ''
                  }`}
                  onClick={() => {
                    setSelectedOrderId(order.id);
                    // Pan to current location if available
                    if (map && order.currentLocation) {
                      const lat = parseFloat(order.currentLocation.latitude);
                      const lng = parseFloat(order.currentLocation.longitude);
                      if (!isNaN(lat) && !isNaN(lng)) {
                        map.panTo({ lat, lng });
                        map.setZoom(15);
                      }
                    }
                  }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Package className="h-5 w-5 text-emerald-600" />
                      <span className="font-bold">طلب #{order.id}</span>
                    </div>
                    {order.isTracking ? (
                      <Badge className="bg-green-500 gap-1">
                        <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                        مباشر
                      </Badge>
                    ) : (
                      <Badge variant="secondary">لا يوجد تتبع</Badge>
                    )}
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span>{order.customerName || 'زبون'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span>{order.regionName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Navigation className="h-4 w-4 text-muted-foreground" />
                      <span>{order.deliveryPersonName || 'غير محدد'}</span>
                    </div>
                  </div>

                  {order.isTracking && order.currentLocation && (
                    <div className="mt-3 pt-3 border-t space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">نقاط التتبع:</span>
                        <span className="font-medium">{order.totalPoints}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">آخر تحديث:</span>
                        <span className="font-medium">
                          {order.lastUpdate ? new Date(order.lastUpdate).toLocaleTimeString('ar-IQ') : '-'}
                        </span>
                      </div>
                      {order.currentLocation.speed && (
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">السرعة:</span>
                          <span className="font-medium">
                            {Math.round(parseFloat(order.currentLocation.speed) * 3.6)} كم/س
                          </span>
                        </div>
                      )}
                      {order.currentLocation.isOffRoute && (
                        <div className="flex items-center gap-1 text-xs text-red-600">
                          <AlertTriangle className="h-3 w-3" />
                          <span>خارج المسار</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>لا توجد طلبات قيد التوصيل حالياً</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Selected Order Live Tracking Details */}
      {selectedOrderId && selectedOrderLiveTracking && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Route className="h-5 w-5 text-blue-600" />
              تفاصيل تتبع الطلب #{selectedOrderId}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Order Info */}
              <div className="space-y-4">
                <h4 className="font-semibold">معلومات الطلب</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">الزبون:</span>
                    <span>{selectedOrderLiveTracking.order.customerName || 'غير محدد'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">المنطقة:</span>
                    <span>{selectedOrderLiveTracking.order.regionName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">المندوب:</span>
                    <span>{selectedOrderLiveTracking.order.deliveryPersonName || 'غير محدد'}</span>
                  </div>
                </div>
              </div>

              {/* Tracking Stats */}
              <div className="space-y-4">
                <h4 className="font-semibold">إحصائيات التتبع</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-muted rounded-lg text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {selectedOrderLiveTracking.stats.totalPoints}
                    </div>
                    <div className="text-xs text-muted-foreground">نقطة تتبع</div>
                  </div>
                  <div className="p-3 bg-muted rounded-lg text-center">
                    <div className="text-2xl font-bold text-emerald-600">
                      {selectedOrderLiveTracking.stats.distanceCovered} كم
                    </div>
                    <div className="text-xs text-muted-foreground">المسافة المقطوعة</div>
                  </div>
                </div>
                
                {selectedOrderLiveTracking.stats.isOffRoute && (
                  <div className="flex items-center gap-2 p-3 bg-red-100 dark:bg-red-950 rounded-lg text-red-600">
                    <AlertTriangle className="h-5 w-5" />
                    <span>المندوب خارج المسار المحدد ({selectedOrderLiveTracking.stats.deviation} متر)</span>
                  </div>
                )}

                {selectedOrderLiveTracking.currentLocation && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">آخر تحديث:</span>
                      <span>
                        {selectedOrderLiveTracking.stats.lastUpdate 
                          ? new Date(selectedOrderLiveTracking.stats.lastUpdate).toLocaleString('ar-IQ', { hour12: false, timeZone: 'Asia/Baghdad' })
                          : '-'
                        }
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 mt-4 pt-4 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  // Draw route on map
                  if (map && selectedOrderLiveTracking.trackingPoints.length > 0) {
                    // Clear existing polylines
                    polylines.forEach(p => p.setMap(null));
                    
                    const path = selectedOrderLiveTracking.trackingPoints
                      .filter((p: any) => {
                        const lat = parseFloat(p.latitude);
                        const lng = parseFloat(p.longitude);
                        return !isNaN(lat) && !isNaN(lng);
                      })
                      .map((p: any) => ({
                        lat: parseFloat(p.latitude),
                        lng: parseFloat(p.longitude),
                      }));

                    if (path.length >= 2) {
                      const polyline = new google.maps.Polyline({
                        path,
                        geodesic: true,
                        strokeColor: '#3b82f6',
                        strokeOpacity: 0.8,
                        strokeWeight: 4,
                        map,
                      });
                      setPolylines([polyline]);

                      const bounds = new google.maps.LatLngBounds();
                      path.forEach((p: any) => bounds.extend(p));
                      map.fitBounds(bounds);
                      
                      toast.success('تم رسم مسار التتبع على الخريطة');
                    } else {
                      toast.error('لا توجد نقاط كافية لرسم المسار');
                    }
                  }
                }}
              >
                <Route className="h-4 w-4 ml-2" />
                عرض المسار على الخريطة
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedOrderId(null);
                  polylines.forEach(p => p.setMap(null));
                  setPolylines([]);
                }}
              >
                إغلاق
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Delivery Persons List */}
      <Card>
        <CardHeader>
          <CardTitle>قائمة المندوبين</CardTitle>
          <CardDescription>
            اضغط على مندوب لعرض تفاصيله الكاملة
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredPersons.map((person: any) => (
              <div
                key={person.userId}
                className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-muted transition-colors"
                onClick={() => {
                  setSelectedPerson(person.userId);
                  setShowDetailsDialog(true);
                  setViewMode("current");
                  
                  // Pan to person on map
                  if (map && person.positions && person.positions.length > 0) {
                    const lat = parseFloat(person.positions[0].latitude);
                    const lng = parseFloat(person.positions[0].longitude);
                    if (!isNaN(lat) && !isNaN(lng)) {
                      map.panTo({ lat, lng });
                      map.setZoom(14);
                    }
                  }
                }}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${person.online ? 'bg-green-500' : 'bg-red-500'}`} />
                  <div>
                    <div className="font-medium">{person.name || person.username}</div>
                    <div className="text-xs text-muted-foreground">
                      {person.positions && person.positions.length > 0
                        ? `${person.positions[0].speed || 0} كم/س`
                        : 'لا توجد بيانات'}
                    </div>
                  </div>
                </div>
                <Badge variant={person.online ? "default" : "secondary"}>
                  {person.online ? 'متصل' : 'غير متصل'}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
