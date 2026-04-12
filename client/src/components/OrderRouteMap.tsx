import { useEffect, useRef, useState } from "react";
import { MapView } from "./Map";
import { Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";

interface OrderRouteMapProps {
  orderId: number;
  locations: Array<{
    latitude: string;
    longitude: string;
    timestamp: Date | string;
    accuracy?: number;
  }>;
  startTime: Date | string;
  endTime: Date | string;
}

export default function OrderRouteMap({ orderId, locations: initialLocations, startTime, endTime }: OrderRouteMapProps) {
  const [mapReady, setMapReady] = useState(false);
  const mapRef = useRef<google.maps.Map | null>(null);
  const polylineRef = useRef<google.maps.Polyline | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  
  // Fetch GPS data from API
  const { data: routeData, isLoading: isLoadingRoute } = trpc.gps.getOrderCompleteRoute.useQuery(
    { orderId },
    { enabled: orderId > 0 }
  );
  
  // Use API data if available, otherwise fall back to provided locations
  const locations = routeData?.route && routeData.route.length > 0 
    ? routeData.route.map((point: any) => ({
        latitude: point.latitude,
        longitude: point.longitude,
        timestamp: new Date(point.timestamp),
        accuracy: point.accuracy
      }))
    : initialLocations;

  const handleMapReady = (map: google.maps.Map) => {
    mapRef.current = map;
    setMapReady(true);
  };

  useEffect(() => {
    if (!mapReady || !mapRef.current || !locations || locations.length === 0) return;

    // Clear previous markers and polyline
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];
    if (polylineRef.current) {
      polylineRef.current.setMap(null);
    }

    // Convert locations to LatLng
    const path = locations.map((loc: { latitude: string; longitude: string }) => ({
      lat: parseFloat(loc.latitude),
      lng: parseFloat(loc.longitude)
    }));

    // Create polyline with gradient effect
    polylineRef.current = new google.maps.Polyline({
      path,
      geodesic: true,
      strokeColor: '#10b981', // emerald-500
      strokeOpacity: 1,
      strokeWeight: 5,
      map: mapRef.current,
      icons: [{
        icon: {
          path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
          scale: 3,
          fillColor: '#10b981',
          fillOpacity: 1,
          strokeColor: '#fff',
          strokeWeight: 1,
        },
        offset: '100%',
        repeat: '100px'
      }]
    });

    // Add start marker (green with animation)
    const startMarker = new google.maps.Marker({
      position: path[0],
      map: mapRef.current,
      title: `بداية التوصيل - ${new Date(startTime).toLocaleTimeString('ar-IQ')}`,
      icon: {
        url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
            <defs>
              <linearGradient id="startGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" style="stop-color:#10b981;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#059669;stop-opacity:1" />
              </linearGradient>
            </defs>
            <circle cx="24" cy="24" r="20" fill="url(#startGrad)" stroke="white" stroke-width="3"/>
            <path d="M24 14 L24 34 M14 24 L34 24" stroke="white" stroke-width="3" stroke-linecap="round"/>
          </svg>
        `),
        scaledSize: new google.maps.Size(48, 48),
        anchor: new google.maps.Point(24, 24)
      },
      animation: google.maps.Animation.DROP
    });
    markersRef.current.push(startMarker);
    
    // Add info window for start marker
    const startInfoWindow = new google.maps.InfoWindow({
      content: `
        <div style="padding: 12px; font-family: Arial, sans-serif; min-width: 200px;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
            <div style="width: 12px; height: 12px; background: #10b981; border-radius: 50%;"></div>
            <h3 style="margin: 0; font-size: 16px; font-weight: bold; color: #10b981;">بداية التوصيل</h3>
          </div>
          <p style="margin: 4px 0; font-size: 14px; color: #666;">
            <strong>الوقت:</strong> ${new Date(startTime).toLocaleString('ar-IQ')}
          </p>
        </div>
      `
    });
    startMarker.addListener('click', () => {
      startInfoWindow.open(mapRef.current, startMarker);
    });

    // Add end marker (red with animation)
    const endMarker = new google.maps.Marker({
      position: path[path.length - 1],
      map: mapRef.current,
      title: `نهاية التوصيل - ${new Date(endTime).toLocaleTimeString('ar-IQ')}`,
      icon: {
        url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
            <defs>
              <linearGradient id="endGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" style="stop-color:#ef4444;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#dc2626;stop-opacity:1" />
              </linearGradient>
            </defs>
            <circle cx="24" cy="24" r="20" fill="url(#endGrad)" stroke="white" stroke-width="3"/>
            <path d="M18 18 L30 30 M30 18 L18 30" stroke="white" stroke-width="3" stroke-linecap="round"/>
          </svg>
        `),
        scaledSize: new google.maps.Size(48, 48),
        anchor: new google.maps.Point(24, 24)
      },
      animation: google.maps.Animation.DROP
    });
    markersRef.current.push(endMarker);
    
    // Add info window for end marker
    const endInfoWindow = new google.maps.InfoWindow({
      content: `
        <div style="padding: 12px; font-family: Arial, sans-serif; min-width: 200px;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
            <div style="width: 12px; height: 12px; background: #ef4444; border-radius: 50%;"></div>
            <h3 style="margin: 0; font-size: 16px; font-weight: bold; color: #ef4444;">نهاية التوصيل</h3>
          </div>
          <p style="margin: 4px 0; font-size: 14px; color: #666;">
            <strong>الوقت:</strong> ${new Date(endTime).toLocaleString('ar-IQ')}
          </p>
        </div>
      `
    });
    endMarker.addListener('click', () => {
      endInfoWindow.open(mapRef.current, endMarker);
    });

    // Fit bounds to show entire route
    const bounds = new google.maps.LatLngBounds();
    path.forEach((point: { lat: number; lng: number }) => bounds.extend(point));
    mapRef.current.fitBounds(bounds);

    // Cleanup
    return () => {
      markersRef.current.forEach(marker => marker.setMap(null));
      if (polylineRef.current) {
        polylineRef.current.setMap(null);
      }
    };
  }, [mapReady, locations, startTime, endTime]);

  // Show loading state
  if (isLoadingRoute) {
    return (
      <div className="h-[500px] bg-muted rounded-lg flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
          <p className="text-muted-foreground">جاري تحميل بيانات المسار...</p>
        </div>
      </div>
    );
  }

  if (!locations || locations.length === 0) {
    return (
      <div className="h-[500px] bg-muted rounded-lg flex items-center justify-center">
        <p className="text-muted-foreground">لا توجد بيانات GPS لهذا الطلب</p>
      </div>
    );
  }

  // Calculate center from first location
  const centerLat = parseFloat(locations[0].latitude);
  const centerLng = parseFloat(locations[0].longitude);

  return (
    <div className="h-[500px] rounded-lg overflow-hidden relative">
      {!mapReady && (
        <div className="absolute inset-0 bg-muted/50 flex items-center justify-center z-10">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
        </div>
      )}
      <MapView
        initialCenter={{ lat: centerLat, lng: centerLng }}
        initialZoom={14}
        onMapReady={handleMapReady}
        className="w-full h-full"
      />
    </div>
  );
}
