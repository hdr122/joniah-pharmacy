import { useEffect, useRef, useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, MapPin, RefreshCw, Users, Package, Map as MapIcon } from 'lucide-react';
import { MapView } from '@/components/Map';
import WazeMap from '@/components/WazeMap';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

export default function DeliveryTracking() {
  const { data: locations, isLoading, refetch } = trpc.gps.getActiveLocations.useQuery(undefined, {
    refetchInterval: 30000, // Refresh every 30 seconds
  });
  
  const { data: orders, refetch: refetchOrders } = trpc.gps.getActiveOrdersWithLocations.useQuery(undefined, {
    refetchInterval: 30000, // Refresh every 30 seconds
  });
  
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [markers, setMarkers] = useState<google.maps.Marker[]>([]);
  const [orderMarkers, setOrderMarkers] = useState<google.maps.Marker[]>([]);
  const [polylines, setPolylines] = useState<google.maps.Polyline[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [useWaze, setUseWaze] = useState(() => {
    const saved = localStorage.getItem('use-waze-map');
    return saved === 'true';
  });
  const directionsServiceRef = useRef<google.maps.DirectionsService | null>(null);
  const directionsRendererRef = useRef<Map<number, google.maps.DirectionsRenderer>>(new Map());
  
  // Save map preference
  useEffect(() => {
    localStorage.setItem('use-waze-map', useWaze.toString());
  }, [useWaze]);

  const handleMapReady = (mapInstance: google.maps.Map) => {
    setMap(mapInstance);
    
    // Initialize Directions Service
    directionsServiceRef.current = new google.maps.DirectionsService();
    
    // Set default center to Baghdad
    mapInstance.setCenter({ lat: 33.3152, lng: 44.3661 });
    mapInstance.setZoom(11);
  };

  // Update delivery person markers
  useEffect(() => {
    if (!map || !locations) return;

    // Clear existing markers
    markers.forEach(marker => marker.setMap(null));

    // Create new markers
    const newMarkers: google.maps.Marker[] = [];
    const bounds = new google.maps.LatLngBounds();

    locations.forEach((location: any) => {
      if (!location.latitude || !location.longitude) return;

      const lat = parseFloat(location.latitude);
      const lng = parseFloat(location.longitude);
      
      if (isNaN(lat) || isNaN(lng)) return;

      const position = { lat, lng };
      
      // Create custom icon for delivery person with status color
      const statusColor = location.status === 'online' ? '10b981' : // green
                         location.status === 'recent' ? 'f59e0b' : // amber
                         '6b7280'; // gray
      const iconUrl = location.profileImage || `https://ui-avatars.com/api/?name=${encodeURIComponent(location.deliveryPersonName || 'مندوب')}&background=${statusColor}&color=fff&size=128`;
      
      // Create marker
      const marker = new google.maps.Marker({
        position,
        map,
        title: location.deliveryPersonName || 'مندوب',
        icon: {
          url: iconUrl,
          scaledSize: new google.maps.Size(40, 40),
          anchor: new google.maps.Point(20, 20),
        },
        zIndex: 1000,
      });

      // Add info window
      const statusText = location.status === 'online' ? 'متصل الآن' :
                        location.status === 'recent' ? 'متصل مؤخراً' :
                        'غير متصل';
      const statusColorBg = location.status === 'online' ? '#10b981' :
                           location.status === 'recent' ? '#f59e0b' :
                           '#6b7280';
      const infoWindow = new google.maps.InfoWindow({
        content: `
          <div style="padding: 8px; font-family: Arial, sans-serif;">
            <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: bold;">${location.deliveryPersonName || 'مندوب'}</h3>
            <p style="margin: 4px 0; font-size: 12px;">
              <span style="display: inline-block; padding: 2px 8px; background: ${statusColorBg}; color: white; border-radius: 4px; font-size: 11px;">${statusText}</span>
            </p>
            <p style="margin: 4px 0; font-size: 12px; color: #666;">
              <strong>آخر تحديث:</strong> ${location.timestamp ? new Date(location.timestamp).toLocaleString('ar-IQ', { hour12: false, timeZone: 'Asia/Baghdad' }) : 'غير متوفر'}
            </p>
            <p style="margin: 4px 0; font-size: 12px; color: #666;">
              <strong>الطلبات النشطة:</strong> ${location.activeOrders || 0}
            </p>
          </div>
        `,
      });

      marker.addListener('click', () => {
        infoWindow.open(map, marker);
      });

      newMarkers.push(marker);
      bounds.extend(position);
    });

    setMarkers(newMarkers);

    // Fit map to show all markers if there are any
    if (newMarkers.length > 0 && !orders?.length) {
      map.fitBounds(bounds);
    }
  }, [map, locations]);

  // Update order markers and routes
  useEffect(() => {
    if (!map || !orders || !directionsServiceRef.current) return;

    // Clear existing order markers
    orderMarkers.forEach(marker => marker.setMap(null));
    
    // Clear existing polylines
    polylines.forEach(polyline => polyline.setMap(null));
    
    // Clear existing direction renderers
    directionsRendererRef.current.forEach(renderer => renderer.setMap(null));
    directionsRendererRef.current.clear();

    const newOrderMarkers: google.maps.Marker[] = [];
    const newPolylines: google.maps.Polyline[] = [];
    const bounds = new google.maps.LatLngBounds();

    orders.forEach((order: any) => {
      // Add order delivery location marker
      if (order.deliveryLatitude && order.deliveryLongitude) {
        const deliveryLat = parseFloat(order.deliveryLatitude);
        const deliveryLng = parseFloat(order.deliveryLongitude);
        
        if (!isNaN(deliveryLat) && !isNaN(deliveryLng)) {
          const deliveryPosition = { lat: deliveryLat, lng: deliveryLng };
          
          // Create order marker
          const orderMarker = new google.maps.Marker({
            position: deliveryPosition,
            map,
            title: `طلب #${order.orderNumber}`,
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 12,
              fillColor: order.status === 'in_transit' ? '#f59e0b' : '#3b82f6',
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 2,
            },
            label: {
              text: '📦',
              fontSize: '16px',
            },
            zIndex: 500,
          });

          // Add info window for order
          const orderInfoWindow = new google.maps.InfoWindow({
            content: `
              <div style="padding: 8px; font-family: Arial, sans-serif; min-width: 200px;">
                <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: bold;">طلب #${order.orderNumber}</h3>
                <p style="margin: 4px 0; font-size: 12px;"><strong>العميل:</strong> ${order.customerName}</p>
                <p style="margin: 4px 0; font-size: 12px;"><strong>المبلغ:</strong> ${order.totalAmount} د.ع</p>
                <p style="margin: 4px 0; font-size: 12px;"><strong>المندوب:</strong> ${order.deliveryPersonName || 'غير محدد'}</p>
                <p style="margin: 4px 0; font-size: 12px;"><strong>الحالة:</strong> ${
                  order.status === 'pending' ? 'قيد الانتظار' :
                  order.status === 'in_transit' ? 'قيد التوصيل' : order.status
                }</p>
              </div>
            `,
          });

          orderMarker.addListener('click', () => {
            orderInfoWindow.open(map, orderMarker);
          });

          newOrderMarkers.push(orderMarker);
          bounds.extend(deliveryPosition);

          // Draw route if delivery person location is available
          if (order.deliveryPersonLatitude && order.deliveryPersonLongitude) {
            const personLat = parseFloat(order.deliveryPersonLatitude);
            const personLng = parseFloat(order.deliveryPersonLongitude);
            
            if (!isNaN(personLat) && !isNaN(personLng)) {
              const personPosition = { lat: personLat, lng: personLng };
              bounds.extend(personPosition);
              
              // Use Directions API to get route
              const directionsRenderer = new google.maps.DirectionsRenderer({
                map,
                suppressMarkers: true, // We already have our custom markers
                polylineOptions: {
                  strokeColor: order.status === 'in_transit' ? '#f59e0b' : '#3b82f6',
                  strokeWeight: 3,
                  strokeOpacity: 0.7,
                },
              });
              
              directionsServiceRef.current!.route(
                {
                  origin: personPosition,
                  destination: deliveryPosition,
                  travelMode: google.maps.TravelMode.DRIVING,
                },
                (result, status) => {
                  if (status === 'OK' && result) {
                    directionsRenderer.setDirections(result);
                  } else {
                    // Fallback to straight line if directions fail
                    const polyline = new google.maps.Polyline({
                      path: [personPosition, deliveryPosition],
                      strokeColor: order.status === 'in_transit' ? '#f59e0b' : '#3b82f6',
                      strokeWeight: 2,
                      strokeOpacity: 0.5,
                      map,
                    });
                    newPolylines.push(polyline);
                  }
                }
              );
              
              directionsRendererRef.current.set(order.orderId, directionsRenderer);
            }
          }
        }
      }
    });

    setOrderMarkers(newOrderMarkers);
    setPolylines(newPolylines);

    // Fit map to show all markers
    if (newOrderMarkers.length > 0 || markers.length > 0) {
      map.fitBounds(bounds);
    }
  }, [map, orders, markers]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetch(), refetchOrders()]);
    setRefreshing(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">تتبع المندوبين</h1>
          <p className="text-muted-foreground mt-1">
            عرض مواقع المندوبين والطلبات النشطة على الخريطة
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 px-4 py-2 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950 dark:to-pink-950 rounded-lg border-2 border-purple-200 dark:border-purple-800">
            <MapIcon className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            <Label htmlFor="waze-mode" className="text-sm font-semibold cursor-pointer text-purple-900 dark:text-purple-100">
              {useWaze ? 'Waze' : 'Google Maps'}
            </Label>
            <Switch
              id="waze-mode"
              checked={useWaze}
              onCheckedChange={setUseWaze}
              className="data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-purple-600 data-[state=checked]:to-pink-600"
            />
          </div>
          <Button onClick={handleRefresh} disabled={refreshing || isLoading}>
            {refreshing ? (
              <Loader2 className="h-4 w-4 animate-spin ml-2" />
            ) : (
              <RefreshCw className="h-4 w-4 ml-2" />
            )}
            تحديث
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">المندوبين النشطين</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{locations?.length || 0}</div>
            <p className="text-xs text-muted-foreground">
              يتم التحديث كل 30 ثانية
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">الطلبات النشطة</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{orders?.length || 0}</div>
            <p className="text-xs text-muted-foreground">
              قيد الانتظار أو التوصيل
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">المسافات</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{polylines.length + directionsRendererRef.current.size}</div>
            <p className="text-xs text-muted-foreground">
              مسارات نشطة
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>الخريطة</CardTitle>
          <CardDescription>
            <span className="inline-flex items-center gap-2 ml-4">
              <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
              مندوب
            </span>
            <span className="inline-flex items-center gap-2 ml-4">
              <span className="w-3 h-3 rounded-full bg-blue-500"></span>
              طلب قيد الانتظار
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-amber-500"></span>
              طلب قيد التوصيل
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-[600px]">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : useWaze ? (
            <div className="h-[600px] rounded-lg overflow-hidden border border-border">
              <WazeMap 
                locations={locations || []} 
                className="w-full h-full"
              />
            </div>
          ) : (
            <div className="h-[600px] rounded-lg overflow-hidden border border-border">
              <MapView onMapReady={handleMapReady} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
