import { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ArrowRight, Download, MapPin, Loader2, Trash2, X, Navigation, WifiOff, CheckCircle2,
} from "lucide-react";
import {
  IRAQ_PROVINCES, estimateTiles, downloadProvince, cancelDownload,
  getTile, putTile, tileUrl, getDownloadedProvinces, cachedTileCount, clearAllTiles,
  type ProvinceBox, type DownloadProgress,
} from "@/lib/offlineTiles";
import { getTrackPoints, type TrackPoint } from "@/lib/offlineQueue";

// مستويات التكبير حسب التفصيل المطلوب
const ZOOM_PRESETS = [
  { key: "city", label: "المدينة", min: 10, max: 13, hint: "خفيف — نظرة عامة" },
  { key: "streets", label: "الشوارع", min: 10, max: 15, hint: "موصى به للمندوب" },
  { key: "detailed", label: "تفصيلي", min: 10, max: 16, hint: "ثقيل — كل الأزقّة" },
] as const;

const MAX_TILES = 150000; // سقف أمان لمنع تنزيل ضخم بالخطأ

function provinceContaining(lat: number, lng: number): ProvinceBox | null {
  return IRAQ_PROVINCES.find((p) => {
    const [s, w, n, e] = p.bbox;
    return lat >= s && lat <= n && lng >= w && lng <= e;
  }) || null;
}

export default function OfflineMap() {
  const [, setLocation] = useLocation();
  const mapRef = useRef<L.Map | null>(null);
  const mapElRef = useRef<HTMLDivElement | null>(null);
  const trackLineRef = useRef<L.Polyline | null>(null);
  const meMarkerRef = useRef<L.CircleMarker | null>(null);
  const watchIdRef = useRef<number | null>(null);

  const [selected, setSelected] = useState<string>(() => {
    try { return localStorage.getItem("riderProvince") || "anbar"; } catch { return "anbar"; }
  });
  // المحافظة التي حدّدها المطوّر لهذا الفرع — هي الهدف الأساسي للتنزيل التلقائي
  const branchProvinceQ = trpc.branches.myMapProvince.useQuery(undefined, { staleTime: 5 * 60 * 1000 });
  const [preset, setPreset] = useState<string>("streets");
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [downloaded, setDownloaded] = useState<Record<string, { name: string; tiles: number; at: string }>>({});
  const [cachedCount, setCachedCount] = useState(0);
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [showManual, setShowManual] = useState(false);
  const [metaLoaded, setMetaLoaded] = useState(false); // هل حُمّلت قائمة الخرائط المحفوظة؟
  // محافظة مؤكّدة (من الموقع أو من آخر اختيار) — التنزيل التلقائي لا يبدأ إلا لها
  const confirmedRef = useRef<string | null>(null);
  const autoRef = useRef(false);

  const province = IRAQ_PROVINCES.find((p) => p.key === selected)!;
  const presetObj = ZOOM_PRESETS.find((z) => z.key === preset)!;
  const estimate = estimateTiles(province.bbox, presetObj.min, presetObj.max);

  const refreshMeta = useCallback(async () => {
    setDownloaded(await getDownloadedProvinces());
    setCachedCount(await cachedTileCount());
    setMetaLoaded(true);
  }, []);

  // المحافظة التي حدّدها المطوّر للفرع هي الهدف المعتمد للتنزيل التلقائي
  useEffect(() => {
    const p = branchProvinceQ.data?.province;
    if (!p) return;
    if (!IRAQ_PROVINCES.some((x) => x.key === p)) return;
    confirmedRef.current = p;
    setSelected(p);
    try { localStorage.setItem("riderProvince", p); } catch {}
  }, [branchProvinceQ.data?.province]);

  // إنشاء الخريطة مرّة واحدة
  useEffect(() => {
    if (mapRef.current || !mapElRef.current) return;

    const map = L.map(mapElRef.current, {
      center: [33.3152, 44.3661], // بغداد افتراضياً
      zoom: 12,
      zoomControl: true,
      attributionControl: true,
    });
    mapRef.current = map;

    // طبقة بلاطات offline-first: من IndexedDB أولاً، ثم الشبكة (مع التخزين) إن توفّرت
    const OfflineLayer = (L.GridLayer as any).extend({
      createTile(coords: any, done: (err: any, tile: HTMLElement) => void) {
        const img = document.createElement("img");
        img.setAttribute("role", "presentation");
        img.alt = "";
        (async () => {
          try {
            let blob = await getTile(coords.z, coords.x, coords.y);
            if (!blob && navigator.onLine) {
              const res = await fetch(tileUrl(coords.z, coords.x, coords.y));
              if (res.ok) { blob = await res.blob(); putTile(coords.z, coords.x, coords.y, blob); }
            }
            if (blob) {
              const url = URL.createObjectURL(blob);
              img.onload = () => { URL.revokeObjectURL(url); done(null, img); };
              img.onerror = () => { URL.revokeObjectURL(url); done(null, img); };
              img.src = url;
            } else {
              // لا بلاطة محلياً ولا إنترنت — بلاطة رمادية فارغة
              img.style.background = "#e9e5f5";
              done(null, img);
            }
          } catch (e) {
            done(null, img);
          }
        })();
        return img;
      },
    });
    new OfflineLayer({ minZoom: 1, maxZoom: 19, maxNativeZoom: 19 }).addTo(map);

    L.control.attribution({ prefix: false }).addAttribution("© OpenStreetMap").addTo(map);

    // ارسم المسار المحفوظ + حدّد الموقع الحالي
    (async () => {
      const pts = await getTrackPoints();
      drawTrack(pts);
      if (pts.length) {
        const last = pts[pts.length - 1];
        map.setView([last.lat, last.lng], 15);
      }
    })();

    // تتبّع حيّ خفيف لعرض الموقع على هذه الصفحة
    if ("geolocation" in navigator) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          const ll: L.LatLngExpression = [latitude, longitude];
          if (!meMarkerRef.current) {
            meMarkerRef.current = L.circleMarker(ll, {
              radius: 8, color: "#fff", weight: 2, fillColor: "#7c3aed", fillOpacity: 1,
            }).addTo(map);
            map.setView(ll, 16);
            // المحافظة يحدّدها المطوّر للفرع (branches.myMapProvince)؛ لا نغيّرها من الموقع.
            // نكتفي بالاكتشاف كبديل احتياطي إن لم تُحدَّد محافظة بعد.
            if (!confirmedRef.current) {
              const p = provinceContaining(latitude, longitude);
              if (p) { confirmedRef.current = p.key; setSelected(p.key); }
            }
          } else {
            meMarkerRef.current.setLatLng(ll);
          }
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
      );
    }

    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  function drawTrack(pts: TrackPoint[]) {
    const map = mapRef.current;
    if (!map) return;
    const latlngs = pts.map((p) => [p.lat, p.lng] as L.LatLngExpression);
    if (trackLineRef.current) {
      trackLineRef.current.setLatLngs(latlngs);
    } else {
      trackLineRef.current = L.polyline(latlngs, { color: "#d946ef", weight: 4, opacity: 0.85 }).addTo(map);
    }
  }

  useEffect(() => {
    refreshMeta();
    // محافظة محفوظة من جلسة سابقة ⇒ تُعتبر مؤكّدة حتى لو تعذّر تحديد الموقع
    try {
      const last = localStorage.getItem("riderProvince");
      if (last && !confirmedRef.current) confirmedRef.current = last;
    } catch {}
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    // حدّث المسار دورياً أثناء فتح الصفحة
    const t = setInterval(async () => { drawTrack(await getTrackPoints()); }, 15000);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); clearInterval(t); };
  }, [refreshMeta]);

  // تنزيل خريطة محافظة. silent = للتنزيل التلقائي أول مرّة بلا نافذة تأكيد.
  const runDownload = async (prov: ProvinceBox, pr: typeof ZOOM_PRESETS[number], silent: boolean) => {
    if (!online) { if (!silent) toast.error("التنزيل يحتاج إنترنت. وصّل الإنترنت ثم نزّل خريطة المحافظة."); return; }
    const est = estimateTiles(prov.bbox, pr.min, pr.max);
    if (est > MAX_TILES) { if (!silent) toast.error(`عدد البلاطات كبير جداً (${est.toLocaleString()}). اختر تفصيلاً أقل.`); return; }
    if (!silent) {
      const approxMb = Math.round((est * 18) / 1024);
      if (!confirm(`سيتم تنزيل خريطة «${prov.name}» (${pr.label}).\n\nعدد البلاطات: ${est.toLocaleString()}\nالحجم التقريبي: ~${approxMb} ميغابايت\n\nيُفضّل استخدام Wi-Fi. متابعة؟`)) return;
    }
    setProgress({ done: 0, total: est, failed: 0, running: true });
    try {
      await downloadProvince(prov, pr.min, pr.max, (p) => setProgress(p));
      toast.success(`تم حفظ خريطة ${prov.name} — تعمل الآن بلا إنترنت ✓`);
    } catch (e: any) {
      if (!silent) toast.error("تعذّر إكمال التنزيل: " + (e?.message || ""));
    } finally {
      await refreshMeta();
      setTimeout(() => setProgress(null), 2500);
    }
  };

  const startDownload = () => runDownload(province, presetObj, false);

  // ⬇️ تنزيل تلقائي مرّة واحدة: عند فتح الصفحة، إن لم تكن خريطة محافظة المندوب
  // محفوظة بعد، تُنزَّل تلقائياً (مستوى الشوارع). بعدها لا تُنزَّل ثانيةً لأنها محفوظة.
  useEffect(() => {
    if (!metaLoaded) return;                    // انتظر تحميل قائمة المحفوظة — وإلا تنزيل مكرّر
    const prov = confirmedRef.current;
    if (!prov) return;                         // ننتظر تأكيد المحافظة (من الموقع/الذاكرة)
    if (autoRef.current) return;               // مرّة واحدة فقط لكل فتح
    if (!online) return;
    if (downloaded[prov]) return;              // محفوظة سلفاً ⇒ لا تنزيل
    if (progress?.running) return;
    const p = IRAQ_PROVINCES.find((x) => x.key === prov);
    if (!p) return;
    autoRef.current = true;
    const streets = ZOOM_PRESETS.find((z) => z.key === "streets")!;
    runDownload(p, streets, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online, downloaded, selected, metaLoaded]);

  const pct = progress && progress.total ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 to-fuchsia-50 dark:from-[#120b26] dark:to-[#1c1136]" dir="rtl">
      {/* شريط علوي */}
      <div className="sticky top-0 z-[1000] bg-[#170f2e] text-white px-4 py-3 flex items-center gap-3 shadow-lg">
        <Button variant="ghost" size="icon" className="text-white hover:bg-white/10 shrink-0" onClick={() => setLocation("/delivery")}>
          <ArrowRight className="w-5 h-5" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold flex items-center gap-2">
            <MapPin className="w-5 h-5 text-fuchsia-400 shrink-0" /> خريطة المحافظة ومسارك
          </h1>
        </div>
        <Badge className={online ? "bg-emerald-600" : "bg-amber-600"}>
          {online ? "متصل" : <span className="flex items-center gap-1"><WifiOff className="w-3 h-3" /> بلا إنترنت</span>}
        </Badge>
      </div>

      {/* الخريطة */}
      <div ref={mapElRef} className="w-full" style={{ height: "52vh", zIndex: 0 }} />

      <div className="p-4 space-y-4 max-w-3xl mx-auto">
        {/* حالة خريطة المحافظة */}
        <Card className="overflow-hidden">
          {progress?.running ? (
            // أثناء التنزيل (تلقائي أو يدوي)
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Loader2 className="w-4 h-4 animate-spin text-violet-600" />
                جارٍ حفظ خريطة {province.name} للعمل بلا إنترنت…
              </div>
              <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-gradient-to-l from-violet-600 to-fuchsia-500 transition-all" style={{ width: `${pct}%` }} />
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{progress.done.toLocaleString()} / {progress.total.toLocaleString()} ({pct}%)</span>
                <Button size="sm" variant="outline" className="text-rose-600 border-rose-300 h-7" onClick={() => cancelDownload()}>
                  <X className="w-3 h-3 ml-1" /> إيقاف
                </Button>
              </div>
            </CardContent>
          ) : downloaded[selected] ? (
            // الخريطة محفوظة — لا حاجة للتنزيل ثانيةً
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="shrink-0 w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-foreground">خريطة {downloaded[selected].name} محفوظة ✓</p>
                  <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">
                    تعمل الآن بلا إنترنت. لا حاجة لتنزيلها مرّة أخرى. ({downloaded[selected].tiles.toLocaleString()} بلاطة)
                  </p>
                  <button onClick={() => setShowManual((v) => !v)} className="text-xs text-violet-600 dark:text-violet-400 underline underline-offset-2 mt-2">
                    {showManual ? "إخفاء الخيارات" : "تنزيل محافظة أخرى أو تحديث"}
                  </button>
                </div>
              </div>
            </CardContent>
          ) : (
            // لم تُحفظ بعد — التنزيل التلقائي سيبدأ، أو انتظار الإنترنت/تحديد المحافظة
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="shrink-0 w-10 h-10 rounded-full bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center">
                  <Download className="w-5 h-5 text-violet-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-foreground">خريطة {province.name} للعمل بلا إنترنت</p>
                  <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">
                    {online
                      ? "سيتم حفظ الخريطة تلقائياً مرّة واحدة. يُفضّل أن يكون أول تنزيل على Wi‑Fi."
                      : "وصّل الإنترنت لحفظ الخريطة مرّة واحدة، ثم ستعمل بلا إنترنت."}
                  </p>
                </div>
              </div>
              <Button onClick={startDownload} disabled={!online || estimate > MAX_TILES} className="w-full bg-violet-600 hover:bg-violet-700">
                <Download className="w-4 h-4 ml-2" /> تنزيل خريطة {province.name} الآن
              </Button>
              <button onClick={() => setShowManual((v) => !v)} className="block mx-auto text-xs text-violet-600 dark:text-violet-400 underline underline-offset-2">
                {showManual ? "إخفاء الخيارات المتقدّمة" : "خيارات متقدّمة (المحافظة والتفصيل)"}
              </button>
            </CardContent>
          )}

          {/* خيارات متقدّمة — مطويّة افتراضياً لتبسيط الواجهة */}
          {showManual && !progress?.running && (
            <CardContent className="border-t p-4 space-y-4">
              <div>
                <label className="text-sm font-medium">المحافظة</label>
                <select
                  value={selected}
                  onChange={(e) => { setSelected(e.target.value); try { localStorage.setItem("riderProvince", e.target.value); } catch {} }}
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                >
                  {IRAQ_PROVINCES.map((p) => (
                    <option key={p.key} value={p.key}>
                      {p.name}{downloaded[p.key] ? " ✓ (محفوظة)" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">مستوى التفصيل</label>
                <div className="grid grid-cols-3 gap-2 mt-1">
                  {ZOOM_PRESETS.map((z) => (
                    <button key={z.key} type="button" onClick={() => setPreset(z.key)}
                      className={`border rounded-md p-2 text-center transition-colors ${preset === z.key ? "bg-violet-600 text-white border-violet-600" : "hover:bg-muted"}`}>
                      <span className="block text-sm font-medium">{z.label}</span>
                      <span className={`block text-[10px] mt-0.5 ${preset === z.key ? "text-violet-100" : "text-muted-foreground"}`}>{z.hint}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="text-sm text-muted-foreground">
                البلاطات التقديرية: <b className="text-foreground">{estimate.toLocaleString()}</b>
                {" "}• الحجم ~<b className="text-foreground">{Math.round((estimate * 18) / 1024)}</b> ميغابايت
                {estimate > MAX_TILES && <span className="text-rose-600 block mt-1">كبير جداً — اختر تفصيلاً أقل.</span>}
              </div>
              <Button onClick={startDownload} disabled={!online || estimate > MAX_TILES} variant="outline" className="w-full">
                <Download className="w-4 h-4 ml-2" /> تنزيل/تحديث خريطة {province.name} ({presetObj.label})
              </Button>
            </CardContent>
          )}
        </Card>

        {/* الخرائط المنزّلة */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">الخرائط المحفوظة على جهازك</CardTitle>
          </CardHeader>
          <CardContent>
            {Object.keys(downloaded).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">لا توجد خرائط منزّلة بعد</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(downloaded).map(([key, v]) => (
                  <div key={key} className="flex items-center justify-between border rounded-lg p-2.5">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <div>
                        <p className="text-sm font-medium">{v.name}</p>
                        <p className="text-xs text-muted-foreground">{v.tiles.toLocaleString()} بلاطة</p>
                      </div>
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-muted-foreground">إجمالي البلاطات المخزّنة: {cachedCount.toLocaleString()}</span>
                  <Button size="sm" variant="outline" className="text-rose-600 border-rose-300"
                    onClick={async () => { if (confirm("حذف كل الخرائط المنزّلة من الجهاز؟")) { await clearAllTiles(); await refreshMeta(); toast.success("حُذفت الخرائط المخزّنة"); } }}>
                    <Trash2 className="w-3.5 h-3.5 ml-1" /> حذف الكل
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground flex items-start gap-2 leading-relaxed pb-6">
          <Navigation className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          الخط الأرجواني هو مسارك المسجّل. يُحفظ على جهازك لحظة بلحظة — حتى لو انقطع الإنترنت — ويُرسل للإدارة تلقائياً عند عودة الاتصال.
        </p>
      </div>
    </div>
  );
}
