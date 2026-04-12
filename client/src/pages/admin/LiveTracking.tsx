import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapView } from "@/components/Map";
import { Loader2, MapPin, Navigation, Battery, Clock, RefreshCw, Activity, TrendingUp } from "lucide-react";

interface DeliveryPerson {
  deliveryPersonId: number;
  deliveryPersonName: string;
  latitude: string;
  longitude: string;
  speed: string | null;
  heading: string | null;
  battery: string | null;
  timestamp: Date;
  status: 'online' | 'recent' | 'offline';
  activeOrders: number;
}

export default function LiveTracking() {
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [markers, setMarkers] = useState<Map<number, google.maps.Marker>>(new Map());
  const [polylines, setPolylines] = useState<Map<number, google.maps.Polyline>>(new Map());
  const [selectedPerson, setSelectedPerson] = useState<number | null>(null);
  const [timeRange, setTimeRange] = useState<string>("1"); // hours
  const [showPath, setShowPath] = useState(true);
  
  const { data: deliveryPersons, isLoading, refetch } = trpc.gps.getActiveLocations.useQuery();
  const { data: locationHistory } = trpc.gps.getLocationHistory.useQuery(
    { deliveryPersonId: selectedPerson!, hours: parseInt(timeRange) },
    { enabled: !!selectedPerson && showPath }
  );

  const handleMapReady = (googleMap: google.maps.Map) => {
    setMap(googleMap);
  };

  // Auto-refresh every 15 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      refetch();
    }, 15000);

    return () => clearInterval(interval);
  }, [refetch]);

  // Update markers when data changes
  useEffect(() => {
    if (!map || !deliveryPersons) return;

    const newMarkers = new Map<number, google.maps.Marker>();
    const bounds = new google.maps.LatLngBounds();
    let hasMarkers = false;

    deliveryPersons.forEach((person: DeliveryPerson) => {
      if (!person.latitude || !person.longitude) return;

      const lat = parseFloat(person.latitude);
      const lng = parseFloat(person.longitude);
      
      if (isNaN(lat) || isNaN(lng)) return;

      const position = { lat, lng };
      hasMarkers = true;
      bounds.extend(position);
      
      // Get existing marker or create new one
      let marker = markers.get(person.deliveryPersonId);
      
      if (!marker) {
        // Create marker icon with rotation based on heading
        const heading = person.heading ? parseFloat(person.heading) : 0;
        const statusColor = person.status === 'online' ? '#10b981' : person.status === 'recent' ? '#f59e0b' : '#ef4444';
        
        const svgMarker = `
          <svg width="40" height="40" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <filter id="shadow-${person.deliveryPersonId}" x="-50%" y="-50%" width="200%" height="200%">
                <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.4"/>
              </filter>
            </defs>
            <g transform="rotate(${heading} 20 20)" filter="url(#shadow-${person.deliveryPersonId})">
              <circle cx="20" cy="20" r="18" fill="${statusColor}" stroke="white" stroke-width="3"/>
              <path d="M 20 8 L 26 28 L 20 24 L 14 28 Z" fill="white"/>
            </g>
          </svg>
        `;
        
        marker = new google.maps.Marker({
          position,
          map,
          icon: {
            url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svgMarker),
            scaledSize: new google.maps.Size(40, 40),
            anchor: new google.maps.Point(20, 20),
          },
          title: person.deliveryPersonName,
        });

        // Add click listener
        marker.addListener('click', () => {
          setSelectedPerson(person.deliveryPersonId);
        });
      } else {
        marker.setPosition(position);
      }

      newMarkers.set(person.deliveryPersonId, marker);
    });

    // Remove markers that no longer exist
    markers.forEach((marker, id) => {
      if (!newMarkers.has(id)) {
        marker.setMap(null);
      }
    });

    setMarkers(newMarkers);

    // Fit bounds if we have markers
    if (hasMarkers && !selectedPerson) {
      map.fitBounds(bounds);
    }
  }, [map, deliveryPersons]);

  // Draw path when location history changes
  useEffect(() => {
    if (!map || !locationHistory || !selectedPerson) return;

    // Clear existing polyline for this person
    const existingPolyline = polylines.get(selectedPerson);
    if (existingPolyline) {
      existingPolyline.setMap(null);
    }

    if (locationHistory.length < 2) return;

    // Create path from location history
    const path = locationHistory.map((loc: any) => ({
      lat: parseFloat(loc.latitude),
      lng: parseFloat(loc.longitude),
    }));

    // Create polyline with gradient colors based on speed
    const polyline = new google.maps.Polyline({
      path,
      geodesic: true,
      strokeColor: '#3b82f6',
      strokeOpacity: 0.8,
      strokeWeight: 4,
      map,
    });

    polylines.set(selectedPerson, polyline);
    setPolylines(new Map(polylines));

    // Fit bounds to show entire path
    const bounds = new google.maps.LatLngBounds();
    path.forEach(point => bounds.extend(point));
    map.fitBounds(bounds);
  }, [map, locationHistory, selectedPerson]);

  const selectedPersonData = deliveryPersons?.find(
    (p: DeliveryPerson) => p.deliveryPersonId === selectedPerson
  );

  const getSpeedInKmh = (speed: string | null) => {
    if (!speed) return 0;
    const speedNum = parseFloat(speed);
    return isNaN(speedNum) ? 0 : Math.round(speedNum * 3.6); // m/s to km/h
  };

  const getDirectionLabel = (heading: string | null) => {
    if (!heading) return "غير معروف";
    const deg = parseFloat(heading);
    if (isNaN(deg)) return "غير معروف";
    
    const directions = ['شمال', 'شمال شرق', 'شرق', 'جنوب شرق', 'جنوب', 'جنوب غرب', 'غرب', 'شمال غرب'];
    const index = Math.round(deg / 45) % 8;
    return directions[index];
  };

  const getBatteryColor = (battery: string | null) => {
    if (!battery) return "text-gray-500";
    const level = parseInt(battery);
    if (level > 50) return "text-green-500";
    if (level > 20) return "text-yellow-500";
    return "text-red-500";
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="border-b bg-background p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">تتبع المندوبين المباشر</h1>
            <p className="text-sm text-muted-foreground">تحديث تلقائي كل 15 ثانية</p>
          </div>
          <div className="flex items-center gap-4">
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="اختر المدة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">آخر ساعة</SelectItem>
                <SelectItem value="3">آخر 3 ساعات</SelectItem>
                <SelectItem value="6">آخر 6 ساعات</SelectItem>
                <SelectItem value="12">آخر 12 ساعة</SelectItem>
                <SelectItem value="24">آخر 24 ساعة</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => refetch()} variant="outline" size="icon">
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="w-80 border-r bg-background overflow-y-auto p-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">المندوبين النشطين</CardTitle>
              <CardDescription>
                {deliveryPersons?.length || 0} مندوب
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {deliveryPersons?.map((person: DeliveryPerson) => (
                <Card
                  key={person.deliveryPersonId}
                  className={`cursor-pointer transition-colors ${
                    selectedPerson === person.deliveryPersonId
                      ? 'border-primary bg-primary/5'
                      : 'hover:bg-accent'
                  }`}
                  onClick={() => setSelectedPerson(person.deliveryPersonId)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h3 className="font-semibold">{person.deliveryPersonName}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge
                            variant={
                              person.status === 'online'
                                ? 'default'
                                : person.status === 'recent'
                                ? 'secondary'
                                : 'outline'
                            }
                          >
                            {person.status === 'online' ? 'متصل' : person.status === 'recent' ? 'نشط مؤخراً' : 'غير متصل'}
                          </Badge>
                          {person.activeOrders > 0 && (
                            <Badge variant="destructive">{person.activeOrders} طلب</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 text-sm mt-3">
                      <div className="flex items-center gap-1">
                        <TrendingUp className="w-3 h-3 text-muted-foreground" />
                        <span className="text-muted-foreground">السرعة:</span>
                        <span className="font-medium">{getSpeedInKmh(person.speed)} كم/س</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Navigation className="w-3 h-3 text-muted-foreground" />
                        <span className="text-muted-foreground">الاتجاه:</span>
                        <span className="font-medium">{getDirectionLabel(person.heading)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Battery className={`w-3 h-3 ${getBatteryColor(person.battery)}`} />
                        <span className="text-muted-foreground">البطارية:</span>
                        <span className="font-medium">{person.battery || 'غير معروف'}%</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-muted-foreground" />
                        <span className="text-muted-foreground">آخر تحديث:</span>
                        <span className="font-medium text-xs">
                          {new Date(person.timestamp).toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Map */}
        <div className="flex-1 relative">
          <MapView onMapReady={handleMapReady} />
          
          {selectedPersonData && (
            <Card className="absolute top-4 left-4 w-80 shadow-lg">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{selectedPersonData.deliveryPersonName}</CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedPerson(null)}
                  >
                    ✕
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col">
                    <span className="text-sm text-muted-foreground">السرعة</span>
                    <span className="text-2xl font-bold">{getSpeedInKmh(selectedPersonData.speed)}</span>
                    <span className="text-xs text-muted-foreground">كم/ساعة</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm text-muted-foreground">الاتجاه</span>
                    <span className="text-lg font-semibold">{getDirectionLabel(selectedPersonData.heading)}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm text-muted-foreground">البطارية</span>
                    <div className="flex items-center gap-2">
                      <Battery className={`w-5 h-5 ${getBatteryColor(selectedPersonData.battery)}`} />
                      <span className="text-lg font-semibold">{selectedPersonData.battery || '؟'}%</span>
                    </div>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm text-muted-foreground">الطلبات النشطة</span>
                    <span className="text-2xl font-bold">{selectedPersonData.activeOrders}</span>
                  </div>
                </div>
                
                {locationHistory && locationHistory.length > 0 && (
                  <div className="pt-3 border-t">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">نقاط المسار</span>
                      <span className="font-semibold">{locationHistory.length} نقطة</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
