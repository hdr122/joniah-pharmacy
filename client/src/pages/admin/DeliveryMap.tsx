import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapView } from "@/components/Map";
import { Loader2, MapPin, User, Phone, Clock, RefreshCw, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export default function DeliveryMap() {
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [markers, setMarkers] = useState<google.maps.Marker[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showActiveOnly, setShowActiveOnly] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  
  const { data: deliveryPersons, isLoading, refetch } = trpc.gps.getActiveLocations.useQuery();

  const formatLastUpdate = (date: Date | null) => {
    if (!date) return "لم يتم التحديث";
    
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return "الآن";
    if (minutes < 60) return `منذ ${minutes} دقيقة`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `منذ ${hours} ساعة`;
    const days = Math.floor(hours / 24);
    return `منذ ${days} يوم`;
  };

  const handleMapReady = (googleMap: google.maps.Map) => {
    setMap(googleMap);
  };

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      refetch();
      setLastRefresh(new Date());
    }, 30000);

    return () => clearInterval(interval);
  }, [refetch]);

  // Update markers when data changes
  useEffect(() => {
    if (!map || !deliveryPersons) return;

    // Clear existing markers
    markers.forEach(marker => marker.setMap(null));
    
    const newMarkers: google.maps.Marker[] = [];
    const bounds = new google.maps.LatLngBounds();
    let hasMarkers = false;

    deliveryPersons.forEach((person: any) => {
      if (!person.latitude || !person.longitude) return;

      const lat = parseFloat(person.latitude);
      const lng = parseFloat(person.longitude);
      
      if (isNaN(lat) || isNaN(lng)) return;

      const position = { lat, lng };
      hasMarkers = true;
      
      // Determine marker color based on active orders
      const hasActiveOrders = person.activeOrders > 0;
      const borderColor = hasActiveOrders ? "#f59e0b" : "#10b981";
      
      // Create marker icon
      const imageUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(person.deliveryPersonName)}&background=${hasActiveOrders ? 'f59e0b' : '10b981'}&color=fff&size=200&bold=true&font-size=0.4`;
      
      const markerSize = 70;
      const imageSize = 60;
      const borderWidth = 5;
      const center = markerSize / 2;
      const imageOffset = (markerSize - imageSize) / 2;
      const radius = (imageSize / 2);
      
      const svgMarker = `
        <svg width="${markerSize}" height="${markerSize}" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <clipPath id="clip-circle-${person.deliveryPersonId}">
              <circle cx="${center}" cy="${center}" r="${radius}"/>
            </clipPath>
            <filter id="shadow-${person.deliveryPersonId}" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.3"/>
            </filter>
          </defs>
          <circle cx="${center}" cy="${center}" r="${radius + borderWidth}" fill="white" filter="url(#shadow-${person.deliveryPersonId})"/>
          <circle cx="${center}" cy="${center}" r="${radius + borderWidth}" fill="none" stroke="${borderColor}" stroke-width="${borderWidth}"/>
          <image href="${imageUrl}" x="${imageOffset}" y="${imageOffset}" width="${imageSize}" height="${imageSize}" clip-path="url(#clip-circle-${person.deliveryPersonId})" preserveAspectRatio="xMidYMid slice"/>
        </svg>
      `;
      
      const marker = new google.maps.Marker({
        position,
        map,
        title: person.deliveryPersonName,
        icon: {
          url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svgMarker),
          scaledSize: new google.maps.Size(markerSize, markerSize),
          anchor: new google.maps.Point(center, center),
        },
        optimized: false,
      });

      const infoWindow = new google.maps.InfoWindow({
        content: `
          <div style="padding: 8px; font-family: Arial, sans-serif; direction: rtl;">
            <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: bold; color: #1f2937;">
              ${person.deliveryPersonName}
            </h3>
            <p style="margin: 4px 0; font-size: 14px; color: #6b7280;">
              <strong>الطلبات النشطة:</strong> ${person.activeOrders}
            </p>
            <p style="margin: 4px 0; font-size: 14px; color: #6b7280;">
              <strong>آخر تحديث:</strong> ${formatLastUpdate(person.timestamp)}
            </p>
            <p style="margin: 4px 0;">
              <span style="display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 12px; background-color: ${
                hasActiveOrders ? "#fef3c7" : "#d1fae5"
              }; color: ${hasActiveOrders ? "#92400e" : "#065f46"};">
                ${hasActiveOrders ? "في طريقه لطلب" : "متاح"}
              </span>
            </p>
          </div>
        `,
      });

      marker.addListener("click", () => {
        infoWindow.open(map, marker);
      });

      newMarkers.push(marker);
      bounds.extend(position);
    });

    setMarkers(newMarkers);

    // Fit map to show all markers
    if (hasMarkers) {
      map.fitBounds(bounds);
      
      if (newMarkers.length === 1) {
        const listener = google.maps.event.addListener(map, "idle", () => {
          map.setZoom(15);
          google.maps.event.removeListener(listener);
        });
      }
    }
  }, [map, deliveryPersons]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  const handleManualRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setLastRefresh(new Date());
    setTimeout(() => setRefreshing(false), 500);
  };

  const filteredDeliveryPersons = showActiveOnly 
    ? deliveryPersons?.filter((p: any) => p.latitude && p.longitude && p.activeOrders > 0)
    : deliveryPersons;

  const withLocationCount = deliveryPersons?.filter((p: any) => p.latitude && p.longitude).length || 0;
  const totalCount = deliveryPersons?.length || 0;
  const activeOrdersCount = deliveryPersons?.filter((p: any) => p.activeOrders > 0).length || 0;

  return (
    <div className="p-6 space-y-6 bg-background" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">خريطة تتبع المندوبين</h1>
          <p className="text-muted-foreground mt-2">عرض مواقع المندوبين في الوقت الفعلي</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
            <span className="text-sm text-emerald-600 dark:text-emerald-400">تحديث تلقائي</span>
          </div>
          <Button
            onClick={handleManualRefresh}
            disabled={refreshing}
            variant="outline"
            className="gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            تحديث
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-r-4 border-r-emerald-500">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">مندوبون بموقع نشط</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <MapPin className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="text-3xl font-bold text-foreground">{withLocationCount}</div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-r-4 border-r-blue-500">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">إجمالي المندوبين</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                <User className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="text-3xl font-bold text-foreground">{totalCount}</div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-r-4 border-r-amber-500">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">مندوبون في طريقهم</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center">
                <MapPin className="w-6 h-6 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="text-3xl font-bold text-foreground">{activeOrdersCount}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Map */}
      <Card>
        <CardHeader>
          <CardTitle>الخريطة التفاعلية</CardTitle>
          <CardDescription>
            انقر على أي علامة لعرض تفاصيل المندوب
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="w-full h-[600px] rounded-lg overflow-hidden border border-border">
            <MapView onMapReady={handleMapReady} />
          </div>
        </CardContent>
      </Card>

      {/* Delivery Persons List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>قائمة المندوبين</CardTitle>
              <CardDescription>جميع المندوبين ومواقعهم</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="active-only"
                checked={showActiveOnly}
                onCheckedChange={setShowActiveOnly}
              />
              <Label htmlFor="active-only" className="text-sm cursor-pointer">
                فقط مع طلبات نشطة
              </Label>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {filteredDeliveryPersons && filteredDeliveryPersons.length > 0 ? (
              filteredDeliveryPersons.map((person: any) => (
                <div
                  key={person.deliveryPersonId}
                  className="flex items-center justify-between p-4 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
                      <User className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{person.deliveryPersonName}</h3>
                      <p className="text-sm text-muted-foreground">
                        {person.latitude && person.longitude ? (
                          <>
                            <MapPin className="w-3 h-3 inline ml-1" />
                            {formatLastUpdate(person.timestamp)}
                          </>
                        ) : (
                          "لا يوجد موقع"
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={person.activeOrders > 0 ? "default" : "secondary"}>
                      {person.activeOrders} طلبات نشطة
                    </Badge>
                    {person.latitude && person.longitude && (
                      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                        متصل
                      </Badge>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <MapPin className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>لا توجد مواقع نشطة حالياً</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
