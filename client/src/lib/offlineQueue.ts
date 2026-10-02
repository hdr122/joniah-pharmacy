/**
 * 📥 طابور المواقع دون اتصال (Offline GPS queue)
 * ============================================================================
 * يحفظ كل نقطة GPS (موقع المندوب + نقاط مسار الطلبات) في IndexedDB محلياً، ثم
 * يُرسلها إلى الخادم دفعةً واحدة عند توفّر الإنترنت. هكذا لا يضيع مسار المندوب
 * أبداً حتى لو انقطع الإنترنت ساعاتٍ أو أُغلق التطبيق — تبقى النقاط محفوظة على
 * الجهاز وتُزامَن حال عودة الاتصال.
 *
 * التخزين IndexedDB (يعمل في WebView أندرويد والمتصفّح)، والإرسال عبر عميل tRPC
 * مستقل كي يعمل من المؤقّت الخلفي بلا اعتماد على عرض React.
 */
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import { Capacitor } from "@capacitor/core";
import type { AppRouter } from "../../../server/routers";

// ── عميل tRPC مستقل للمزامنة الخلفية ────────────────────────────────────────
const syncClient = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      fetch(input, init) {
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
          signal: AbortSignal.timeout(30000),
        });
      },
    }),
  ],
});

// ── أنواع ────────────────────────────────────────────────────────────────────
export interface QueuedLocation {
  latitude: string;
  longitude: string;
  accuracy?: string;
  speed?: string;
  heading?: string;
  battery?: string;
  recordedAt: string; // ISO
}

export interface QueuedRoutePoint {
  orderId: number;
  latitude: string;
  longitude: string;
  accuracy?: string;
  speed?: string;
  heading?: string;
  recordedAt: string; // ISO
}

const DB_NAME = "xenon-offline";
const DB_VERSION = 2;
const STORE_LOC = "locations";
const STORE_ROUTE = "routePoints";
const STORE_TRACK = "track"; // سجل مسار للعرض على الخريطة — لا يُحذف عند المزامنة
const BATCH = 200; // أقصى عدد نقاط لكل دفعة إرسال
const TRACK_MAX = 8000; // أقصى عدد نقاط مسار محفوظة للعرض

// ── IndexedDB (غلاف صغير بلا اعتماديات) ─────────────────────────────────────
let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_LOC)) {
          db.createObjectStore(STORE_LOC, { keyPath: "id", autoIncrement: true });
        }
        if (!db.objectStoreNames.contains(STORE_ROUTE)) {
          db.createObjectStore(STORE_ROUTE, { keyPath: "id", autoIncrement: true });
        }
        if (!db.objectStoreNames.contains(STORE_TRACK)) {
          db.createObjectStore(STORE_TRACK, { keyPath: "id", autoIncrement: true });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    } catch (e) {
      reject(e);
    }
  });
  return dbPromise;
}

function tx(db: IDBDatabase, store: string, mode: IDBTransactionMode): IDBObjectStore {
  return db.transaction(store, mode).objectStore(store);
}

function reqToPromise<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

async function addRow(store: string, value: any): Promise<void> {
  const db = await openDb();
  await reqToPromise(tx(db, store, "readwrite").add(value));
}

async function readBatch(store: string, limit: number): Promise<Array<{ id: number; value: any }>> {
  const db = await openDb();
  const os = tx(db, store, "readonly");
  const out: Array<{ id: number; value: any }> = [];
  return new Promise((resolve, reject) => {
    const cursorReq = os.openCursor();
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (cursor && out.length < limit) {
        out.push({ id: cursor.key as number, value: cursor.value });
        cursor.continue();
      } else {
        resolve(out);
      }
    };
    cursorReq.onerror = () => reject(cursorReq.error);
  });
}

async function deleteIds(store: string, ids: number[]): Promise<void> {
  if (!ids.length) return;
  const db = await openDb();
  const os = tx(db, store, "readwrite");
  await Promise.all(ids.map((id) => reqToPromise(os.delete(id))));
}

async function countRows(store: string): Promise<number> {
  try {
    const db = await openDb();
    return await reqToPromise(tx(db, store, "readonly").count());
  } catch {
    return 0;
  }
}

// ── الواجهة العامة ───────────────────────────────────────────────────────────
export async function enqueueLocation(p: QueuedLocation): Promise<void> {
  await addRow(STORE_LOC, p).catch((e) => console.warn("[offlineQueue] enqueue loc:", e));
}

export async function enqueueRoutePoint(p: QueuedRoutePoint): Promise<void> {
  await addRow(STORE_ROUTE, p).catch((e) => console.warn("[offlineQueue] enqueue route:", e));
}

export async function getPendingCounts(): Promise<{ locations: number; routePoints: number; total: number }> {
  const [locations, routePoints] = await Promise.all([countRows(STORE_LOC), countRows(STORE_ROUTE)]);
  return { locations, routePoints, total: locations + routePoints };
}

// آخر نقاط المسار المخزّنة محلياً لرسم المسار على الخريطة دون اتصال
export async function getBufferedRoutePoints(limit = 5000): Promise<QueuedRoutePoint[]> {
  const rows = await readBatch(STORE_ROUTE, limit).catch(() => []);
  return rows.map((r) => r.value as QueuedRoutePoint);
}

// ── سجل المسار للعرض على الخريطة (يبقى بعد المزامنة) ─────────────────────────
export interface TrackPoint { lat: number; lng: number; t: number; }

export async function appendTrackPoint(p: TrackPoint): Promise<void> {
  try {
    await addRow(STORE_TRACK, p);
    // تقليم دوري كي لا ينمو بلا حدّ
    const n = await countRows(STORE_TRACK);
    if (n > TRACK_MAX) {
      const rows = await readBatch(STORE_TRACK, n - TRACK_MAX);
      await deleteIds(STORE_TRACK, rows.map((r) => r.id));
    }
  } catch (e) { console.warn("[offlineQueue] track:", e); }
}

export async function getTrackPoints(limit = TRACK_MAX): Promise<TrackPoint[]> {
  const rows = await readBatch(STORE_TRACK, limit).catch(() => []);
  return rows.map((r) => r.value as TrackPoint);
}

export async function clearTrack(): Promise<void> {
  try {
    const db = await openDb();
    await reqToPromise(tx(db, STORE_TRACK, "readwrite").clear());
  } catch { /* ثانوي */ }
}

let flushing = false;

export function isOnline(): boolean {
  // في أندرويد قد يكون navigator.onLine غير دقيق؛ نعتبره متصلاً افتراضياً
  // ونترك فشل الطلب يُعيد النقاط للطابور.
  if (typeof navigator !== "undefined" && "onLine" in navigator) return navigator.onLine;
  return true;
}

/**
 * يُفرّغ الطابور إلى الخادم. آمن للاستدعاء المتكرر (قفل داخلي). يُعيد عدد ما أُرسل.
 */
export async function flushQueue(): Promise<{ sentLocations: number; sentRoutePoints: number }> {
  if (flushing) return { sentLocations: 0, sentRoutePoints: 0 };
  if (!isOnline()) return { sentLocations: 0, sentRoutePoints: 0 };
  flushing = true;
  let sentLocations = 0;
  let sentRoutePoints = 0;
  try {
    // المواقع
    while (true) {
      const rows = await readBatch(STORE_LOC, BATCH);
      if (!rows.length) break;
      try {
        await syncClient.gps.saveLocationsBatch.mutate({ points: rows.map((r) => r.value) });
        await deleteIds(STORE_LOC, rows.map((r) => r.id));
        sentLocations += rows.length;
      } catch (e) {
        console.warn("[offlineQueue] flush locations failed, سيُعاد لاحقاً:", e);
        break; // نتوقّف ونُبقي النقاط للمحاولة التالية
      }
      if (rows.length < BATCH) break;
    }
    // نقاط المسار
    while (true) {
      const rows = await readBatch(STORE_ROUTE, BATCH);
      if (!rows.length) break;
      try {
        await syncClient.gps.saveRoutePointsBatch.mutate({ points: rows.map((r) => r.value) });
        await deleteIds(STORE_ROUTE, rows.map((r) => r.id));
        sentRoutePoints += rows.length;
      } catch (e) {
        console.warn("[offlineQueue] flush route failed, سيُعاد لاحقاً:", e);
        break;
      }
      if (rows.length < BATCH) break;
    }
  } finally {
    flushing = false;
  }
  return { sentLocations, sentRoutePoints };
}

// ── المزامنة التلقائية ───────────────────────────────────────────────────────
let autoFlushStarted = false;
let flushTimer: ReturnType<typeof setInterval> | null = null;

export function startAutoFlush(intervalMs = 20000): void {
  if (autoFlushStarted) return;
  autoFlushStarted = true;

  const kick = () => { flushQueue().catch(() => {}); };

  // عند عودة الاتصال في المتصفّح
  if (typeof window !== "undefined") {
    window.addEventListener("online", kick);
  }

  // على أندرويد: استخدم إضافة Network للكشف الموثوق عن عودة الاتصال
  if (Capacitor.isNativePlatform()) {
    import("@capacitor/network").then(({ Network }) => {
      Network.addListener("networkStatusChange", (status) => {
        if (status.connected) kick();
      });
    }).catch(() => {});
  }

  // مؤقّت دوري كشبكة أمان
  flushTimer = setInterval(kick, intervalMs);

  // محاولة أولى عند الإقلاع
  kick();
}

export function stopAutoFlush(): void {
  if (flushTimer) { clearInterval(flushTimer); flushTimer = null; }
  autoFlushStarted = false;
}
