import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MapPin, Navigation, User, ExternalLink, Loader2 } from "lucide-react";
import { createOfflineTileLayer, parseLatLng } from "@/lib/offlineTiles";

/**
 * معاينة موقع المندوب وموقع الزبون للطلب على خريطة واحدة (تعمل بلا إنترنت إن حُفظت
 * بلاطات المحافظة). تُفتح عند الضغط على طلب مقبول.
 */
export default function OrderLocationPreview({
  order,
  open,
  onClose,
}: {
  order: any | null;
  open: boolean;
  onClose: () => void;
}) {
  const mapElRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const meRef = useRef<L.CircleMarker | null>(null);
  const custRef = useRef<L.Marker | null>(null);
  const lineRef = useRef<L.Polyline | null>(null);
  const watchRef = useRef<number | null>(null);
  const [me, setMe] = useState<{ lat: number; lng: number } | null>(null);

  // موقع الزبون من روابط الطلب (أول رابط صالح)
  const customer =
    parseLatLng(order?.locationLink) ||
    parseLatLng(order?.customerLocationUrl1) ||
    parseLatLng(order?.customerLocationUrl2) ||
    parseLatLng(order?.customerLastDeliveryLocation);
  const customerUrl = order?.locationLink || order?.customerLocationUrl1 || order?.customerLocationUrl2 || order?.customerLastDeliveryLocation;

  useEffect(() => {
    if (!open || !mapElRef.current || mapRef.current) return;
    const center: L.LatLngExpression = customer ? [customer.lat, customer.lng] : [33.3152, 44.3661];
    const map = L.map(mapElRef.current, { center, zoom: customer ? 15 : 12, zoomControl: true, attributionControl: false });
    mapRef.current = map;
    createOfflineTileLayer(L).addTo(map);
    L.control.attribution({ prefix: false }).addAttribution("© OpenStreetMap").addTo(map);

    if (customer) {
      custRef.current = L.marker([customer.lat, customer.lng]).addTo(map).bindPopup("موقع الزبون");
    }

    // الموقع الحالي للمندوب
    if ("geolocation" in navigator) {
      watchRef.current = navigator.geolocation.watchPosition(
        (pos) => setMe({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {},
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
      );
    }

    // أعطِ الخريطة لحظة لتضبط الحجم داخل النافذة
    setTimeout(() => map.invalidateSize(), 250);

    return () => {
      if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
      map.remove();
      mapRef.current = null;
      meRef.current = null; custRef.current = null; lineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, order?.id]);

  // حدّث نقطة المندوب والخط بينه وبين الزبون + ضبط الإطار ليشملهما
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !me) return;
    const ll: L.LatLngExpression = [me.lat, me.lng];
    if (!meRef.current) {
      meRef.current = L.circleMarker(ll, { radius: 8, color: "#fff", weight: 2, fillColor: "#7c3aed", fillOpacity: 1 }).addTo(map).bindPopup("موقعك");
    } else {
      meRef.current.setLatLng(ll);
    }
    if (customer) {
      const pts: L.LatLngExpression[] = [ll, [customer.lat, customer.lng]];
      if (!lineRef.current) lineRef.current = L.polyline(pts, { color: "#d946ef", weight: 3, dashArray: "6 6" }).addTo(map);
      else lineRef.current.setLatLngs(pts);
      try { map.fitBounds(L.latLngBounds(pts).pad(0.3)); } catch {}
    } else {
      map.setView(ll, 15);
    }
  }, [me, customer]);

  const distanceKm = me && customer
    ? (L.latLng(me.lat, me.lng).distanceTo(L.latLng(customer.lat, customer.lng)) / 1000)
    : null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg p-0 overflow-hidden" dir="rtl">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-violet-600" />
            موقع الطلب #{order?.id}
          </DialogTitle>
        </DialogHeader>

        <div ref={mapElRef} className="w-full" style={{ height: "48vh", minHeight: 280 }} />

        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2 text-sm">
            <span className="flex items-center gap-1.5 text-violet-700 dark:text-violet-300">
              <Navigation className="w-4 h-4" /> موقعك {me ? "✓" : <Loader2 className="w-3 h-3 animate-spin inline" />}
            </span>
            <span className="flex items-center gap-1.5 text-fuchsia-700 dark:text-fuchsia-300">
              <User className="w-4 h-4" /> موقع الزبون {customer ? "✓" : "غير متوفّر"}
            </span>
            {distanceKm != null && (
              <span className="font-semibold text-foreground">المسافة ≈ {distanceKm.toFixed(1)} كم</span>
            )}
          </div>

          {!customer && (
            <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
              لا يوجد موقع محفوظ للزبون لهذا الطلب. يظهر موقعك فقط على الخريطة.
            </p>
          )}

          <div className="flex gap-2">
            {customerUrl && (
              <Button variant="outline" className="flex-1" onClick={() => window.open(customerUrl, "_blank")}>
                <ExternalLink className="w-4 h-4 ml-1" /> فتح موقع الزبون في الخرائط
              </Button>
            )}
            {me && customer && (
              <Button className="flex-1 bg-violet-600 hover:bg-violet-700"
                onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${customer.lat},${customer.lng}`, "_blank")}>
                <Navigation className="w-4 h-4 ml-1" /> المسار إلى الزبون
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
