/**
 * 🗺️ خرائط دون اتصال — تخزين بلاطات الخريطة محلياً
 * ============================================================================
 * يحفظ بلاطات (tiles) الخريطة للمحافظة في IndexedDB كي تُعرض الخريطة بلا إنترنت،
 * ويُستخدم لتتبّع مسار المندوب على خريطة حقيقية حتى عند انقطاع الاتصال.
 *
 * المصدر الافتراضي OpenStreetMap، ويمكن تغييره عبر VITE_TILE_URL لمصدرٍ يسمح
 * بالتنزيل المجمّع (سياسة OSM لا تسمح بالتنزيل الضخم — انظر الملاحظة في الأسفل).
 */

const TILE_URL =
  (import.meta as any).env?.VITE_TILE_URL ||
  "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

const DB_NAME = "xenon-tiles";
const DB_VERSION = 1;
const STORE_TILES = "tiles";
const STORE_META = "meta";

// ── محافظات العراق: الحدود الجغرافية (south, west, north, east) ───────────────
// تُستخدم لحساب البلاطات المطلوب تنزيلها لكل محافظة.
export interface ProvinceBox {
  key: string;
  name: string;
  bbox: [number, number, number, number]; // [south, west, north, east]
}

export const IRAQ_PROVINCES: ProvinceBox[] = [
  { key: "baghdad", name: "بغداد", bbox: [33.05, 44.0, 33.55, 44.75] },
  { key: "basra", name: "البصرة", bbox: [29.9, 46.9, 31.3, 48.6] },
  { key: "nineveh", name: "نينوى", bbox: [35.1, 41.2, 37.4, 43.9] },
  { key: "erbil", name: "أربيل", bbox: [35.5, 43.3, 37.4, 45.3] },
  { key: "sulaymaniyah", name: "السليمانية", bbox: [34.7, 44.8, 36.4, 46.3] },
  { key: "duhok", name: "دهوك", bbox: [36.3, 42.3, 37.4, 44.3] },
  { key: "kirkuk", name: "كركوك", bbox: [34.7, 43.4, 35.9, 45.0] },
  { key: "diyala", name: "ديالى", bbox: [33.3, 44.5, 34.9, 46.2] },
  { key: "anbar", name: "الأنبار", bbox: [32.0, 38.8, 34.5, 44.0] },
  { key: "babil", name: "بابل", bbox: [32.1, 44.0, 33.1, 45.2] },
  { key: "karbala", name: "كربلاء", bbox: [32.2, 43.3, 32.9, 44.4] },
  { key: "najaf", name: "النجف", bbox: [30.5, 42.0, 32.4, 45.0] },
  { key: "qadisiyyah", name: "القادسية (الديوانية)", bbox: [31.5, 44.5, 32.4, 45.5] },
  { key: "muthanna", name: "المثنى", bbox: [29.0, 44.3, 31.5, 46.5] },
  { key: "dhiqar", name: "ذي قار", bbox: [30.5, 45.7, 31.9, 47.2] },
  { key: "maysan", name: "ميسان", bbox: [31.2, 46.3, 32.6, 47.7] },
  { key: "wasit", name: "واسط", bbox: [32.0, 44.9, 33.4, 46.6] },
  { key: "saladin", name: "صلاح الدين", bbox: [33.7, 42.9, 35.3, 45.1] },
];

// ── حساب البلاطات ──────────────────────────────────────────────────────────
function lon2tile(lon: number, z: number): number {
  return Math.floor(((lon + 180) / 360) * Math.pow(2, z));
}
function lat2tile(lat: number, z: number): number {
  const r = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * Math.pow(2, z));
}

export interface TileCoord { z: number; x: number; y: number; }

export function tilesForBox(bbox: [number, number, number, number], minZoom: number, maxZoom: number): TileCoord[] {
  const [south, west, north, east] = bbox;
  const tiles: TileCoord[] = [];
  for (let z = minZoom; z <= maxZoom; z++) {
    const xMin = lon2tile(west, z);
    const xMax = lon2tile(east, z);
    const yMin = lat2tile(north, z); // north = أصغر y
    const yMax = lat2tile(south, z);
    for (let x = xMin; x <= xMax; x++) {
      for (let y = yMin; y <= yMax; y++) {
        tiles.push({ z, x, y });
      }
    }
  }
  return tiles;
}

export function estimateTiles(bbox: [number, number, number, number], minZoom: number, maxZoom: number): number {
  let count = 0;
  const [south, west, north, east] = bbox;
  for (let z = minZoom; z <= maxZoom; z++) {
    const xCount = lon2tile(east, z) - lon2tile(west, z) + 1;
    const yCount = lat2tile(south, z) - lat2tile(north, z) + 1;
    count += xCount * yCount;
  }
  return count;
}

export function tileUrl(z: number, x: number, y: number): string {
  return TILE_URL.replace("{z}", String(z)).replace("{x}", String(x)).replace("{y}", String(y));
}

// طبقة بلاطات offline-first لـ Leaflet: من IndexedDB أولاً ثم الشبكة (مع التخزين).
// نمرّر L كوسيط كي لا تعتمد هذه المكتبة على leaflet مباشرةً.
export function createOfflineTileLayer(L: any): any {
  const Layer = L.GridLayer.extend({
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
            img.style.background = "#e9e5f5";
            done(null, img);
          }
        } catch {
          done(null, img);
        }
      })();
      return img;
    },
  });
  return new Layer({ minZoom: 1, maxZoom: 19, maxNativeZoom: 19 });
}

// استخراج إحداثيات (lat,lng) من رابط خرائط (q=.. أو @lat,lng أو ll=..) أو نص "lat,lng"
export function parseLatLng(input?: string | null): { lat: number; lng: number } | null {
  if (!input) return null;
  const s = String(input);
  const patterns = [
    /[?&](?:q|ll|destination|daddr)=(-?\d+\.\d+)[, ]+(-?\d+\.\d+)/i,
    /@(-?\d+\.\d+),(-?\d+\.\d+)/,
    /(-?\d{1,2}\.\d{3,}),\s*(-?\d{1,3}\.\d{3,})/,
  ];
  for (const re of patterns) {
    const m = re.exec(s);
    if (m) {
      const lat = parseFloat(m[1]); const lng = parseFloat(m[2]);
      if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
        return { lat, lng };
      }
    }
  }
  return null;
}

// ── IndexedDB ────────────────────────────────────────────────────────────────
let dbPromise: Promise<IDBDatabase> | null = null;
function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_TILES)) db.createObjectStore(STORE_TILES);
      if (!db.objectStoreNames.contains(STORE_META)) db.createObjectStore(STORE_META);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}
function reqP<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
}
const tileKey = (z: number, x: number, y: number) => `${z}/${x}/${y}`;

export async function getTile(z: number, x: number, y: number): Promise<Blob | null> {
  try {
    const db = await openDb();
    const v = await reqP(db.transaction(STORE_TILES, "readonly").objectStore(STORE_TILES).get(tileKey(z, x, y)));
    return (v as Blob) || null;
  } catch { return null; }
}

export async function putTile(z: number, x: number, y: number, blob: Blob): Promise<void> {
  try {
    const db = await openDb();
    await reqP(db.transaction(STORE_TILES, "readwrite").objectStore(STORE_TILES).put(blob, tileKey(z, x, y)));
  } catch (e) { /* التخزين ثانوي */ }
}

export async function cachedTileCount(): Promise<number> {
  try {
    const db = await openDb();
    return await reqP(db.transaction(STORE_TILES, "readonly").objectStore(STORE_TILES).count());
  } catch { return 0; }
}

export async function getDownloadedProvinces(): Promise<Record<string, { name: string; tiles: number; at: string }>> {
  try {
    const db = await openDb();
    const v = await reqP(db.transaction(STORE_META, "readonly").objectStore(STORE_META).get("provinces"));
    return (v as any) || {};
  } catch { return {}; }
}

async function setDownloadedProvince(key: string, name: string, tiles: number): Promise<void> {
  try {
    const db = await openDb();
    const cur = await getDownloadedProvinces();
    cur[key] = { name, tiles, at: new Date().toISOString() };
    await reqP(db.transaction(STORE_META, "readwrite").objectStore(STORE_META).put(cur, "provinces"));
  } catch { /* ثانوي */ }
}

export async function clearAllTiles(): Promise<void> {
  const db = await openDb();
  await reqP(db.transaction(STORE_TILES, "readwrite").objectStore(STORE_TILES).clear());
  await reqP(db.transaction(STORE_META, "readwrite").objectStore(STORE_META).clear());
}

// ── تنزيل بلاطات محافظة ──────────────────────────────────────────────────────
export interface DownloadProgress {
  done: number;
  total: number;
  failed: number;
  running: boolean;
}

let cancelRequested = false;
export function cancelDownload() { cancelRequested = true; }

/**
 * ينزّل بلاطات المحافظة ويخزّنها. يتخطّى المخزّن مسبقاً. مع حدّ تزامن وتهدئة
 * بسيطة لاحترام مصدر البلاطات.
 */
export async function downloadProvince(
  province: ProvinceBox,
  minZoom: number,
  maxZoom: number,
  onProgress: (p: DownloadProgress) => void,
): Promise<DownloadProgress> {
  cancelRequested = false;
  const tiles = tilesForBox(province.bbox, minZoom, maxZoom);
  const total = tiles.length;
  let done = 0;
  let failed = 0;
  const CONCURRENCY = 5;

  let idx = 0;
  async function worker() {
    while (idx < tiles.length && !cancelRequested) {
      const t = tiles[idx++];
      try {
        const existing = await getTile(t.z, t.x, t.y);
        if (!existing) {
          const res = await fetch(tileUrl(t.z, t.x, t.y), { headers: { Accept: "image/png,image/*" } });
          if (res.ok) {
            const blob = await res.blob();
            await putTile(t.z, t.x, t.y, blob);
          } else {
            failed++;
          }
          // تهدئة بسيطة بين الطلبات
          await new Promise((r) => setTimeout(r, 40));
        }
      } catch {
        failed++;
      }
      done++;
      if (done % 10 === 0 || done === total) {
        onProgress({ done, total, failed, running: !cancelRequested });
      }
    }
  }

  const workers = Array.from({ length: CONCURRENCY }, () => worker());
  await Promise.all(workers);

  if (!cancelRequested) await setDownloadedProvince(province.key, province.name, total - failed);
  const final = { done, total, failed, running: false };
  onProgress(final);
  return final;
}

/**
 * ملاحظة مهمّة حول السياسة: خادم OpenStreetMap العام لا يسمح بالتنزيل المجمّع
 * للبلاطات. للاستخدام الكثيف استعمل مصدراً يسمح بذلك (MapTiler/Thunderforest
 * بمفتاح، أو خادمك الخاص) عبر ضبط VITE_TILE_URL.
 */
