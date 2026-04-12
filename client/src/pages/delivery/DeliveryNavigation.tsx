import { useState, useEffect, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { MapView } from "@/components/Map";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { 
  Navigation, 
  MapPin, 
  ArrowLeft, 
  Play, 
  Pause, 
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Clock,
  Compass,
  Route,
  ExternalLink,
  Phone,
  Target,
  Gauge,
  Battery,
  Signal
} from "lucide-react";
import { useLocation, useRoute } from "wouter";

interface LocationPoint {
  lat: number;
  lng: number;
  timestamp: Date;
  accuracy?: number;
  speed?: number;
  heading?: number;
}

export default function DeliveryNavigation() {
  const [, setLocationPath] = useLocation();
  const [match, params] = useRoute("/delivery/navigation/:orderId");
  const orderId = params?.orderId ? parseInt(params.orderId) : null;

  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [currentPosition, setCurrentPosition] = useState<LocationPoint | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [showLocationSelector, setShowLocationSelector] = useState(false);
  const [routePath, setRoutePath] = useState<google.maps.LatLng[]>([]);
  const [isOffRoute, setIsOffRoute] = useState(false);
  const [deviation, setDeviation] = useState(0);
  const [estimatedTime, setEstimatedTime] = useState<string>("");
  const [distance, setDistance] = useState<string>("");
  const [distanceRemaining, setDistanceRemaining] = useState<number>(0);
  const [progressPercent, setProgressPercent] = useState(0);
  const [totalDistance, setTotalDistance] = useState<number>(0);
  const [currentSpeed, setCurrentSpeed] = useState<number>(0);
  const [locationAccuracy, setLocationAccuracy] = useState<number>(0);
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);
  const [destinationCoords, setDestinationCoords] = useState<{ lat: number; lng: number } | null>(null);
  
  const directionsServiceRef = useRef<google.maps.DirectionsService | null>(null);
  const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null);
  const currentMarkerRef = useRef<google.maps.Marker | null>(null);
  const destinationMarkerRef = useRef<google.maps.Marker | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const routePointsRef = useRef<LocationPoint[]>([]);
  const lastSaveTimeRef = useRef<number>(0);
  const initialDistanceRef = useRef<number>(0);

  // Fetch order details
  const { data: order, isLoading } = trpc.orders.getById.useQuery(
    { id: orderId! },
    { enabled: !!orderId }
  );

  // Save route point mutation
  const saveRoutePointMutation = trpc.orderRouteTracking.savePoint.useMutation();
  
  // Save GPS location mutation
  const saveLocationMutation = trpc.gps.saveLocation.useMutation();

  // Get battery level
  useEffect(() => {
    if ('getBattery' in navigator) {
      (navigator as any).getBattery().then((battery: any) => {
        setBatteryLevel(Math.round(battery.level * 100));
        battery.addEventListener('levelchange', () => {
          setBatteryLevel(Math.round(battery.level * 100));
        });
      }).catch(() => {});
    }
  }, []);

  // Get available locations for the order
  const availableLocations = useCallback(() => {
    if (!order) return [];
    const locations: { id: string; name: string; url: string }[] = [];
    const addedUrls = new Set<string>(); // لتجنب تكرار نفس الرابط
    
    // Helper function to add location without duplicates
    const addLocation = (id: string, name: string, url: string) => {
      if (url && !addedUrls.has(url)) {
        locations.push({ id, name, url });
        addedUrls.add(url);
      }
    };
    
    // Priority order: locationLink > customerLocationUrl1 > customerLocationUrl
    // locationLink is the main delivery location set when creating the order
    if (order.locationLink) {
      addLocation("main", "موقع التوصيل", order.locationLink);
    } else if ((order as any).customerLocationUrl1) {
      addLocation("main", "الموقع الرئيسي", (order as any).customerLocationUrl1);
    } else if ((order as any).customerLocationUrl) {
      addLocation("main", "الموقع الرئيسي", (order as any).customerLocationUrl);
    }
    
    // Add secondary locations only if different from main
    if ((order as any).customerLocationUrl2) {
      addLocation("secondary", "الموقع الثانوي", (order as any).customerLocationUrl2);
    }
    if ((order as any).customerLastDeliveryLocation) {
      addLocation("lastDelivery", "آخر موقع تسليم", (order as any).customerLastDeliveryLocation);
    }
    
    return locations;
  }, [order]);

  // Parse coordinates from URL (including goo.gl short links)
  const parseCoordinates = async (url: string): Promise<{ lat: number; lng: number } | null> => {
    if (!url) return null;
    
    console.log("[Navigation] Parsing URL:", url);
    
    // Decode URL first
    const decodedUrl = decodeURIComponent(url);
    console.log("[Navigation] Decoded URL:", decodedUrl);
    
    // Try different URL formats - order matters!
    const patterns = [
      // Google Maps place with coordinates: place/Name/@33.123,44.456
      /place\/[^/]*\/@([\d.-]+),([\d.-]+)/,
      // @ format: @33.123,44.456,17z
      /@([\d.-]+),([\d.-]+),?\d*z?/,
      // Standard query parameter: ?q=33.123,44.456
      /[?&]q=([\d.-]+),([\d.-]+)/,
      // ll parameter: ll=33.123,44.456
      /[?&]ll=([\d.-]+),([\d.-]+)/,
      // center parameter: center=33.123,44.456
      /[?&]center=([\d.-]+),([\d.-]+)/,
      // destination parameter: destination=33.123,44.456
      /destination=([\d.-]+),([\d.-]+)/,
      // saddr/daddr parameters
      /[sd]addr=([\d.-]+),([\d.-]+)/,
      // Place format: place/33.123,44.456
      /place\/([\d.-]+),([\d.-]+)/,
      // Direct coordinates in URL: /33.123,44.456
      /\/([\d.-]+),([\d.-]+)/,
      // Query with zoom: ?q=33.123,44.456,17z
      /[?&]q=([\d.-]+),([\d.-]+),\d+z/,
      // Maps URL with coordinates: maps?.*=([d.-]+),([d.-]+)
      /maps\?.*=([\d.-]+),([\d.-]+)/,
      // Any two numbers separated by comma (latitude range 29-38 for Iraq, longitude range 38-49)
      /(3[0-8]\.[\d]+),(4[0-9]\.[\d]+)/,
      // Broader Iraq coordinates (lat: 29-38, lng: 38-49)
      /(2[9]|3[0-8])\.[\d]+,(3[8-9]|4[0-9])\.[\d]+/,
      // Fallback: any two decimal numbers that look like coordinates
      /([\d]{2}\.[\d]{4,}),([\d]{2}\.[\d]{4,})/,
    ];
    
    // Try all patterns on both original and decoded URL
    const urlsToTry = [url, decodedUrl];
    
    for (const urlToTry of urlsToTry) {
      for (const pattern of patterns) {
        const match = urlToTry.match(pattern);
        if (match) {
          const lat = parseFloat(match[1]);
          const lng = parseFloat(match[2]);
          // Validate coordinates are within valid ranges
          if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
            // Additional validation for Iraq region
            if (lat >= 29 && lat <= 38 && lng >= 38 && lng <= 49) {
              console.log("[Navigation] Found Iraq coordinates:", { lat, lng });
              return { lat, lng };
            }
            // Still return if valid global coordinates
            console.log("[Navigation] Found coordinates:", { lat, lng });
            return { lat, lng };
          }
        }
      }
    }
    
    // If no pattern matches, try to extract any two decimal numbers
    const numbers = decodedUrl.match(/([\d]+\.[\d]+)/g);
    if (numbers && numbers.length >= 2) {
      for (let i = 0; i < numbers.length - 1; i++) {
        const lat = parseFloat(numbers[i]);
        const lng = parseFloat(numbers[i + 1]);
        // Check if they look like Iraq coordinates (lat: 29-38, lng: 38-49)
        if (!isNaN(lat) && !isNaN(lng) && lat >= 29 && lat <= 38 && lng >= 38 && lng <= 49) {
          console.log("[Navigation] Found Iraq coordinates from numbers:", { lat, lng });
          return { lat, lng };
        }
      }
      // Try reversed order (lng, lat)
      for (let i = 0; i < numbers.length - 1; i++) {
        const lng = parseFloat(numbers[i]);
        const lat = parseFloat(numbers[i + 1]);
        if (!isNaN(lat) && !isNaN(lng) && lat >= 29 && lat <= 38 && lng >= 38 && lng <= 49) {
          console.log("[Navigation] Found Iraq coordinates (reversed):", { lat, lng });
          return { lat, lng };
        }
      }
    }
    
    // Handle goo.gl short links by fetching the redirect URL first
    if (url.includes('goo.gl') || url.includes('maps.app.goo.gl') || url.includes('g.co')) {
      console.log("[Navigation] Detected short link, trying to resolve...");
      try {
        // Try to fetch the redirect URL
        const response = await fetch(url, { 
          method: 'HEAD',
          redirect: 'follow'
        });
        const finalUrl = response.url;
        console.log("[Navigation] Resolved short link to:", finalUrl);
        
        // Try to parse coordinates from the resolved URL
        const coords = await parseCoordinates(finalUrl);
        if (coords) {
          return coords;
        }
      } catch (error) {
        console.log('[Navigation] Could not fetch redirect, trying geocoding...');
      }
      
      // Fallback: try geocoding the short link directly
      try {
        const geocoder = new google.maps.Geocoder();
        const result = await geocoder.geocode({ address: url });
        
        if (result.results && result.results.length > 0) {
          const location = result.results[0].geometry.location;
          console.log("[Navigation] Geocoded short link:", { lat: location.lat(), lng: location.lng() });
          return {
            lat: location.lat(),
            lng: location.lng()
          };
        }
      } catch (error) {
        console.error('[Navigation] Error geocoding short link:', error);
      }
    }
    
    // Last resort: try to extract place name and geocode it
    const placeMatch = decodedUrl.match(/place\/([^/@]+)/);
    if (placeMatch) {
      const placeName = placeMatch[1].replace(/\+/g, ' ');
      console.log("[Navigation] Trying to geocode place name:", placeName);
      try {
        const geocoder = new google.maps.Geocoder();
        const result = await geocoder.geocode({ address: placeName + ', Iraq' });
        
        if (result.results && result.results.length > 0) {
          const location = result.results[0].geometry.location;
          console.log("[Navigation] Geocoded place:", { lat: location.lat(), lng: location.lng() });
          return {
            lat: location.lat(),
            lng: location.lng()
          };
        }
      } catch (error) {
        console.error('[Navigation] Error geocoding place name:', error);
      }
    }
    
    console.log("[Navigation] Could not parse coordinates from URL");
    return null;
  };

  // Calculate distance between two points using Haversine formula
  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
  };

  // Initialize map
  const handleMapReady = (mapInstance: google.maps.Map) => {
    setMap(mapInstance);
    mapInstance.setCenter({ lat: 33.3152, lng: 44.3661 }); // Baghdad default
    mapInstance.setZoom(14);
    
    directionsServiceRef.current = new google.maps.DirectionsService();
    directionsRendererRef.current = new google.maps.DirectionsRenderer({
      map: mapInstance,
      suppressMarkers: true,
      polylineOptions: {
        strokeColor: "#10b981", // Emerald green for better visibility
        strokeWeight: 8, // Thicker line
        strokeOpacity: 0.9,
        icons: [{
          icon: {
            path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
            scale: 3,
            fillColor: "#ffffff",
            fillOpacity: 1,
            strokeColor: "#10b981",
            strokeWeight: 1,
          },
          offset: "100%",
          repeat: "100px", // Arrow every 100px
        }],
      },
    });
    
    // Get current location immediately
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const pos = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          mapInstance.setCenter(pos);
          setCurrentPosition({
            lat: pos.lat,
            lng: pos.lng,
            timestamp: new Date(),
            accuracy: position.coords.accuracy,
            speed: position.coords.speed || 0,
            heading: position.coords.heading || undefined,
          });
          
          // Create current position marker immediately
          if (!currentMarkerRef.current) {
            currentMarkerRef.current = new google.maps.Marker({
              position: pos,
              map: mapInstance,
              icon: {
                path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
                scale: 10,
                fillColor: "#3b82f6",
                fillOpacity: 1,
                strokeColor: "#ffffff",
                strokeWeight: 3,
                rotation: position.coords.heading || 0,
              },
              title: "موقعي الحالي",
              zIndex: 1000,
            });
          }
        },
        (error) => {
          console.error("[Navigation] Initial position error:", error);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      );
    }
  };

  // Start watching position with high accuracy
  const startWatchingPosition = useCallback(() => {
    if (!navigator.geolocation) {
      toast.error("الموقع الجغرافي غير مدعوم في هذا المتصفح");
      return;
    }

    console.log("[Navigation] Starting high-accuracy position tracking...");

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const newPosition: LocationPoint = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          timestamp: new Date(),
          accuracy: position.coords.accuracy,
          speed: position.coords.speed || 0,
          heading: position.coords.heading || undefined,
        };
        
        setCurrentPosition(newPosition);
        setCurrentSpeed(position.coords.speed ? Math.round(position.coords.speed * 3.6) : 0); // Convert m/s to km/h
        setLocationAccuracy(Math.round(position.coords.accuracy || 0));
        
        // Update marker
        if (map && currentMarkerRef.current) {
          currentMarkerRef.current.setPosition(newPosition);
          
          // Rotate marker based on heading
          if (position.coords.heading !== null) {
            const icon = currentMarkerRef.current.getIcon() as google.maps.Symbol;
            if (icon) {
              currentMarkerRef.current.setIcon({
                ...icon,
                rotation: position.coords.heading,
              });
            }
          }
        } else if (map) {
          currentMarkerRef.current = new google.maps.Marker({
            position: newPosition,
            map,
            icon: {
              path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
              scale: 10, // Larger marker
              fillColor: "#3b82f6",
              fillOpacity: 1,
              strokeColor: "#ffffff",
              strokeWeight: 3,
              rotation: position.coords.heading || 0,
            },
            title: "موقعي الحالي",
            zIndex: 1000, // Always on top
          });
          
          // Add accuracy circle
          new google.maps.Circle({
            map,
            center: newPosition,
            radius: position.coords.accuracy || 10,
            fillColor: "#3b82f6",
            fillOpacity: 0.1,
            strokeColor: "#3b82f6",
            strokeOpacity: 0.3,
            strokeWeight: 1,
          });
        }

        // Center map on current position while navigating
        if (isNavigating && map) {
          map.panTo(newPosition);
        }

        // Calculate distance to destination and progress
        if (destinationCoords && isNavigating) {
          const distToDest = calculateDistance(
            newPosition.lat, newPosition.lng,
            destinationCoords.lat, destinationCoords.lng
          );
          setDistanceRemaining(distToDest);
          
          // Calculate progress percentage
          if (initialDistanceRef.current > 0) {
            const progress = Math.max(0, Math.min(100, 
              ((initialDistanceRef.current - distToDest) / initialDistanceRef.current) * 100
            ));
            setProgressPercent(progress);
          }
          
          // Estimate time based on current speed or average speed
          const avgSpeed = currentSpeed > 0 ? currentSpeed : 30; // Default 30 km/h
          const timeInHours = distToDest / avgSpeed;
          const timeInMinutes = Math.round(timeInHours * 60);
          if (timeInMinutes < 60) {
            setEstimatedTime(`${timeInMinutes} دقيقة`);
          } else {
            const hours = Math.floor(timeInMinutes / 60);
            const mins = timeInMinutes % 60;
            setEstimatedTime(`${hours} ساعة ${mins} دقيقة`);
          }
          
          setDistance(`${distToDest.toFixed(1)} كم`);
        }

        // Save route point if navigating
        if (isNavigating && orderId) {
          routePointsRef.current.push(newPosition);
          
          const now = Date.now();
          // Save to server every 3 seconds for high precision tracking
          if (now - lastSaveTimeRef.current >= 3000) {
            lastSaveTimeRef.current = now;
            
            saveRoutePointMutation.mutate({
              orderId,
              latitude: newPosition.lat.toString(),
              longitude: newPosition.lng.toString(),
              accuracy: position.coords.accuracy?.toString(),
              speed: position.coords.speed?.toString() || undefined,
              heading: position.coords.heading?.toString() || undefined,
              deviationFromRoute: Math.round(deviation),
              isOffRoute,
            });
            
            // Also save to general GPS tracking
            saveLocationMutation.mutate({
              latitude: newPosition.lat.toString(),
              longitude: newPosition.lng.toString(),
              accuracy: position.coords.accuracy?.toString(),
              speed: position.coords.speed?.toString() || undefined,
              heading: position.coords.heading?.toString() || undefined,
              battery: batteryLevel?.toString(),
            });
          }

          // Check if off route
          if (routePath.length > 0) {
            const minDistance = calculateMinDistanceToRoute(newPosition, routePath);
            setDeviation(minDistance);
            if (minDistance > 100) { // More than 100 meters off route
              if (!isOffRoute) {
                setIsOffRoute(true);
                toast.warning("أنت خارج المسار! جاري إعادة حساب المسار...");
                recalculateRoute(newPosition);
              }
            } else {
              setIsOffRoute(false);
            }
          }
        }
      },
      (error) => {
        console.error("[Navigation] Geolocation error:", error);
        switch (error.code) {
          case error.PERMISSION_DENIED:
            toast.error("تم رفض صلاحية الوصول للموقع");
            break;
          case error.POSITION_UNAVAILABLE:
            toast.error("لا يمكن تحديد الموقع. تأكد من تفعيل GPS");
            break;
          case error.TIMEOUT:
            toast.warning("انتهت مهلة تحديد الموقع، جاري المحاولة مرة أخرى...");
            break;
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 1000, // Accept cached position up to 1 second old
        timeout: 10000,
      }
    );
  }, [map, isNavigating, orderId, deviation, isOffRoute, routePath, saveRoutePointMutation, saveLocationMutation, destinationCoords, currentSpeed, batteryLevel]);

  // Calculate minimum distance to route
  const calculateMinDistanceToRoute = (point: LocationPoint, route: google.maps.LatLng[]): number => {
    let minDistance = Infinity;
    
    for (let i = 0; i < route.length - 1; i++) {
      const distance = google.maps.geometry.spherical.computeDistanceBetween(
        new google.maps.LatLng(point.lat, point.lng),
        route[i]
      );
      if (distance < minDistance) {
        minDistance = distance;
      }
    }
    
    return minDistance;
  };

  // Recalculate route
  const recalculateRoute = useCallback(async (origin: LocationPoint) => {
    if (!directionsServiceRef.current || !directionsRendererRef.current || !selectedLocation) return;
    
    const locations = availableLocations();
    const location = locations.find(l => l.id === selectedLocation);
    if (!location) return;
    
    const destination = await parseCoordinates(location.url);
    if (!destination) return;

    toast.info("جاري إعادة حساب المسار...");

    directionsServiceRef.current.route(
      {
        origin: new google.maps.LatLng(origin.lat, origin.lng),
        destination: new google.maps.LatLng(destination.lat, destination.lng),
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === google.maps.DirectionsStatus.OK && result) {
          directionsRendererRef.current?.setDirections(result);
          
          // Extract route path
          const path = result.routes[0].overview_path;
          setRoutePath(path);
          
          // Update ETA and distance
          const leg = result.routes[0].legs[0];
          setEstimatedTime(leg.duration?.text || "");
          setDistance(leg.distance?.text || "");
          
          toast.success("تم تحديث المسار");
        }
      }
    );
  }, [selectedLocation, availableLocations]);

  // Start navigation
  const startNavigation = useCallback(async (locationId: string) => {
    const locations = availableLocations();
    const location = locations.find(l => l.id === locationId);
    if (!location) return;
    
    toast.info("جاري تحديد الموقع...");
    
    const destination = await parseCoordinates(location.url);
    if (!destination) {
      toast.error("لا يمكن تحديد الإحداثيات من الرابط. تأكد من صحة رابط الموقع.");
      return;
    }

    setSelectedLocation(locationId);
    setShowLocationSelector(false);
    setIsNavigating(true);
    setDestinationCoords(destination);
    routePointsRef.current = [];
    lastSaveTimeRef.current = Date.now();

    // Add destination marker
    if (map) {
      if (destinationMarkerRef.current) {
        destinationMarkerRef.current.setMap(null);
      }
      destinationMarkerRef.current = new google.maps.Marker({
        position: destination,
        map,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 14,
          fillColor: "#ef4444",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 3,
        },
        title: "الوجهة",
      });
    }

    // Calculate initial route
    if (currentPosition && directionsServiceRef.current && directionsRendererRef.current) {
      // Calculate initial distance for progress tracking
      const initDist = calculateDistance(
        currentPosition.lat, currentPosition.lng,
        destination.lat, destination.lng
      );
      initialDistanceRef.current = initDist;
      setTotalDistance(initDist);
      setDistanceRemaining(initDist);

      directionsServiceRef.current.route(
        {
          origin: new google.maps.LatLng(currentPosition.lat, currentPosition.lng),
          destination: new google.maps.LatLng(destination.lat, destination.lng),
          travelMode: google.maps.TravelMode.DRIVING,
        },
        (result, status) => {
          if (status === google.maps.DirectionsStatus.OK && result) {
            directionsRendererRef.current?.setDirections(result);
            
            const path = result.routes[0].overview_path;
            setRoutePath(path);
            
            const leg = result.routes[0].legs[0];
            setEstimatedTime(leg.duration?.text || "");
            setDistance(leg.distance?.text || "");
            
            // Fit bounds
            const bounds = new google.maps.LatLngBounds();
            bounds.extend(new google.maps.LatLng(currentPosition.lat, currentPosition.lng));
            bounds.extend(new google.maps.LatLng(destination.lat, destination.lng));
            map?.fitBounds(bounds);
            
            toast.success("تم بدء الملاحة! تتبع موقعك بدقة عالية.");
          } else {
            toast.error("فشل في حساب المسار");
          }
        }
      );
    } else {
      toast.error("يرجى الانتظار حتى يتم تحديد موقعك");
    }
  }, [availableLocations, currentPosition, map]);

  // Stop navigation
  const stopNavigation = () => {
    setIsNavigating(false);
    setSelectedLocation(null);
    setRoutePath([]);
    setIsOffRoute(false);
    setDeviation(0);
    setProgressPercent(0);
    setDestinationCoords(null);
    initialDistanceRef.current = 0;
    
    if (directionsRendererRef.current) {
      directionsRendererRef.current.setDirections({ routes: [] } as any);
    }
    if (destinationMarkerRef.current) {
      destinationMarkerRef.current.setMap(null);
    }
    
    toast.info("تم إيقاف الملاحة");
  };

  // Open in external app
  const openInExternalApp = async (app: "google" | "waze") => {
    const locations = availableLocations();
    const location = locations.find(l => l.id === selectedLocation);
    if (!location) return;
    
    const destination = await parseCoordinates(location.url);
    if (!destination) return;

    if (app === "google") {
      window.open(
        `https://www.google.com/maps/dir/?api=1&destination=${destination.lat},${destination.lng}&travelmode=driving`,
        "_blank"
      );
    } else {
      window.open(
        `https://waze.com/ul?ll=${destination.lat},${destination.lng}&navigate=yes`,
        "_blank"
      );
    }
  };

  // Start watching position on mount
  useEffect(() => {
    startWatchingPosition();
    
    return () => {
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [startWatchingPosition]);

  // Show location selector when order is loaded and has multiple locations
  useEffect(() => {
    if (order && !isNavigating) {
      const locations = availableLocations();
      if (locations.length > 1) {
        setShowLocationSelector(true);
      } else if (locations.length === 1) {
        // Auto-start if only one location
        startNavigation(locations[0].id);
      } else if (locations.length === 0) {
        toast.error("لا يوجد موقع متاح للتوصيل في هذا الطلب");
      }
    }
  }, [order, isNavigating, availableLocations, startNavigation]);

  if (!orderId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">لم يتم تحديد الطلب</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col" dir="rtl">
      {/* Header */}
      <div className="bg-card border-b p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setLocationPath("/delivery")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="font-bold text-lg">ملاحة الطلب #{orderId}</h1>
            <p className="text-sm text-muted-foreground">{(order as any)?.customerName || "زبون"}</p>
          </div>
        </div>
        
        {isNavigating && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => openInExternalApp("google")}
              className="gap-1"
            >
              <ExternalLink className="w-4 h-4" />
              Google
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => openInExternalApp("waze")}
              className="gap-1 text-cyan-600"
            >
              <Navigation className="w-4 h-4" />
              Waze
            </Button>
          </div>
        )}
      </div>

      {/* Status Bar */}
      {isNavigating && (
        <div className={`p-3 ${isOffRoute ? "bg-red-500" : "bg-emerald-500"} text-white`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {isOffRoute ? (
                <>
                  <AlertTriangle className="w-5 h-5" />
                  <span>أنت خارج المسار!</span>
                </>
              ) : (
                <>
                  <Compass className="w-5 h-5" />
                  <span>على المسار الصحيح</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                <span>{estimatedTime || "-"}</span>
              </div>
              <div className="flex items-center gap-1">
                <Route className="w-4 h-4" />
                <span>{distance || "-"}</span>
              </div>
            </div>
          </div>
          
          {/* Progress Bar */}
          <div className="space-y-1">
            <Progress value={progressPercent} className="h-2 bg-white/30" />
            <div className="flex justify-between text-xs">
              <span>التقدم: {Math.round(progressPercent)}%</span>
              <span>المتبقي: {distanceRemaining.toFixed(1)} كم</span>
            </div>
          </div>
        </div>
      )}

      {/* Real-time Stats */}
      {isNavigating && (
        <div className="bg-card border-b p-2 grid grid-cols-4 gap-2 text-center text-xs">
          <div className="flex flex-col items-center">
            <Gauge className="w-4 h-4 text-blue-500 mb-1" />
            <span className="font-bold">{currentSpeed}</span>
            <span className="text-muted-foreground">كم/س</span>
          </div>
          <div className="flex flex-col items-center">
            <Target className="w-4 h-4 text-green-500 mb-1" />
            <span className="font-bold">{locationAccuracy}</span>
            <span className="text-muted-foreground">متر دقة</span>
          </div>
          <div className="flex flex-col items-center">
            <Signal className="w-4 h-4 text-purple-500 mb-1" />
            <span className="font-bold">{Math.round(deviation)}</span>
            <span className="text-muted-foreground">متر انحراف</span>
          </div>
          {batteryLevel !== null && (
            <div className="flex flex-col items-center">
              <Battery className={`w-4 h-4 mb-1 ${batteryLevel < 20 ? 'text-red-500' : 'text-green-500'}`} />
              <span className="font-bold">{batteryLevel}%</span>
              <span className="text-muted-foreground">البطارية</span>
            </div>
          )}
        </div>
      )}

      {/* Map */}
      <div className="flex-1 relative">
        <MapView onMapReady={handleMapReady} />
        
        {/* Navigation Controls */}
        <div className="absolute bottom-4 left-4 right-4 space-y-3">
          {isNavigating ? (
            <Card className="bg-card/95 backdrop-blur">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">جاري التوصيل</p>
                    <p className="text-sm text-muted-foreground">
                      {availableLocations().find(l => l.id === selectedLocation)?.name}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => currentPosition && recalculateRoute(currentPosition)}
                    >
                      <RefreshCw className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={stopNavigation}
                    >
                      <Pause className="w-4 h-4 ml-1" />
                      إيقاف
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-card/95 backdrop-blur">
              <CardContent className="p-4">
                <Button
                  className="w-full bg-gradient-to-r from-emerald-600 to-teal-600"
                  onClick={() => {
                    const locations = availableLocations();
                    if (locations.length > 1) {
                      setShowLocationSelector(true);
                    } else if (locations.length === 1) {
                      startNavigation(locations[0].id);
                    } else {
                      toast.error("لا يوجد موقع متاح للتوصيل");
                    }
                  }}
                >
                  <Play className="w-5 h-5 ml-2" />
                  بدء التوصيل
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Order Info */}
      {order && (
        <Card className="m-4 mt-0">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{(order as any).customerName || "زبون"}</p>
                <p className="text-sm text-muted-foreground">{(order as any).regionName}</p>
              </div>
              {(order as any).customerPhone && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(`tel:${(order as any).customerPhone}`, "_self")}
                >
                  <Phone className="w-4 h-4 ml-1" />
                  اتصال
                </Button>
              )}
            </div>
            {order.note && (
              <p className="text-sm text-muted-foreground mt-2 p-2 bg-muted rounded">
                {order.note}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Location Selector Dialog */}
      <Dialog open={showLocationSelector} onOpenChange={setShowLocationSelector}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>اختر موقع التوصيل</DialogTitle>
            <DialogDescription>
              يوجد أكثر من موقع متاح، اختر الموقع الذي تريد التوصيل إليه
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {availableLocations().map((location) => (
              <Button
                key={location.id}
                variant="outline"
                className="w-full justify-start gap-3 h-auto py-3"
                onClick={() => startNavigation(location.id)}
              >
                <MapPin className="w-5 h-5 text-emerald-600" />
                <div className="text-right">
                  <p className="font-medium">{location.name}</p>
                  <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                    {location.url}
                  </p>
                </div>
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
