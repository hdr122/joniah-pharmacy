// 🎧 بثّ تسجيلات المكالمات — مع تحويل صيغة AMR (تسجيل مكالمات أندرويد) إلى صيغة
// يستطيع المتصفّح تشغيلها. لا متصفّح (لا كروم ولا سفاري ولا WebView أندرويد) يشغّل AMR،
// ولهذا كان زر الاستماع لا يعمل إطلاقاً رغم وجود الملف الصوتي.
//
// المسار: GET /api/call-audio/:id  — يتحقّق من جلسة المستخدم ومن أن المكالمة تخصّ فرعه.
import type { Express, Request, Response } from "express";
import { spawn } from "child_process";
import { sdk } from "./_core/sdk";
import * as db from "./db";

// صيغ يشغّلها المتصفّح مباشرة بلا تحويل
const BROWSER_SAFE = /^audio\/(mpeg|mp3|mp4|aac|ogg|opus|webm|wav|x-wav|wave|flac)$/i;

// هل تحتاج هذه البيانات إلى تحويل؟ نعتمد على التوقيع داخل الملف لا على mimeType فقط،
// لأن الأنظمة الخارجية كثيراً ما ترسل "audio/mp4" لملف AMR.
function needsTranscode(buf: Buffer, mimeType: string): boolean {
  const head = buf.subarray(0, 9).toString("latin1");
  if (head.startsWith("#!AMR")) return true; // AMR-NB / AMR-WB
  if (head.startsWith("#!SILK")) return true;
  if (BROWSER_SAFE.test(mimeType)) return false;
  // ID3 / MPEG frame / ftyp / OggS / RIFF => آمنة
  if (head.startsWith("ID3") || head.startsWith("OggS") || head.startsWith("RIFF")) return false;
  if (buf.length > 12 && buf.subarray(4, 8).toString("latin1") === "ftyp") return false;
  if (buf.length > 2 && buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0) return false;
  return true;
}

// تنظيف base64 من بادئة data: إن أرسلها النظام الخارجي
function decodeBase64(raw: string): Buffer {
  const comma = raw.indexOf(",");
  const payload = raw.startsWith("data:") && comma > -1 ? raw.slice(comma + 1) : raw;
  return Buffer.from(payload.replace(/\s/g, ""), "base64");
}

let ffmpegPath: string | null | undefined; // undefined = لم يُفحص بعد، null = غير متوفر

async function resolveFfmpeg(): Promise<string | null> {
  if (ffmpegPath !== undefined) return ffmpegPath;
  for (const candidate of ["ffmpeg", "/usr/bin/ffmpeg", "/usr/local/bin/ffmpeg"]) {
    const ok = await new Promise<boolean>((resolve) => {
      const p = spawn(candidate, ["-version"], { stdio: "ignore" });
      p.on("error", () => resolve(false));
      p.on("close", (code) => resolve(code === 0));
    });
    if (ok) {
      ffmpegPath = candidate;
      console.log(`[CallAudio] ffmpeg متوفر: ${candidate}`);
      return ffmpegPath;
    }
  }
  console.warn("[CallAudio] ffmpeg غير متوفر — تسجيلات AMR ستُعرض كملف للتنزيل بدل التشغيل المباشر");
  ffmpegPath = null;
  return null;
}

// تحويل عبر ffmpeg إلى MP3 (أصغر حجماً ومدعوم في كل مكان)
function transcodeWithFfmpeg(bin: string, input: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const p = spawn(bin, [
      "-hide_banner", "-loglevel", "error",
      "-i", "pipe:0",
      "-vn", "-ac", "1", "-ar", "16000", "-b:a", "32k",
      "-f", "mp3", "pipe:1",
    ]);
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    p.stdout.on("data", (c) => out.push(c));
    p.stderr.on("data", (c) => err.push(c));
    p.on("error", reject);
    p.on("close", (code) => {
      if (code === 0 && out.length) return resolve(Buffer.concat(out));
      reject(new Error(`ffmpeg exited ${code}: ${Buffer.concat(err).toString().slice(0, 300)}`));
    });
    p.stdin.on("error", () => { /* الأنبوب أُغلق مبكراً */ });
    p.stdin.end(input);
  });
}

// ذاكرة مؤقتة للملفات المحوّلة (التحويل مكلف والملفات صغيرة)
const cache = new Map<number, { mimeType: string; data: Buffer; playable: boolean }>();
const CACHE_MAX = 40;

function putCache(id: number, value: { mimeType: string; data: Buffer; playable: boolean }) {
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(id, value);
}

async function loadPlayable(branchId: number, id: number) {
  const cached = cache.get(id);
  if (cached) return cached;

  const row = await db.getCallRecordingAudio(branchId, id);
  if (!row?.audioBase64) return null;

  const raw = decodeBase64(row.audioBase64);
  if (!raw.length) return null;

  let result: { mimeType: string; data: Buffer; playable: boolean } = {
    mimeType: row.mimeType || "audio/mpeg",
    data: raw,
    playable: true,
  };

  if (needsTranscode(raw, row.mimeType || "")) {
    const bin = await resolveFfmpeg();
    let converted = false;
    if (bin) {
      try {
        result = { mimeType: "audio/mpeg", data: await transcodeWithFfmpeg(bin, raw), playable: true };
        converted = true;
      } catch (e) {
        console.warn(`[CallAudio] فشل تحويل التسجيل #${id}:`, (e as Error).message);
      }
    }
    if (!converted) {
      // لا يمكن التحويل — نُعيد الملف الأصلي ونُعلم الواجهة بأنه غير قابل للتشغيل
      // في المتصفّح كي تعرض زر التنزيل بدل مشغّل صامت.
      result = { mimeType: row.mimeType || "audio/amr", data: raw, playable: false };
    }
  }

  putCache(id, result);
  return result;
}

export function registerCallAudioRoutes(app: Express) {
  app.get("/api/call-audio/:id", async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return res.status(400).json({ error: "bad_id" });

      const user = await sdk.authenticateRequest(req as any).catch(() => null);
      const branchId = user?.branchId;
      if (!user || !branchId) return res.status(401).json({ error: "unauthorized" });

      const audio = await loadPlayable(branchId, id);
      if (!audio) return res.status(404).json({ error: "not_found" });

      const total = audio.data.length;
      res.setHeader("Content-Type", audio.mimeType);
      res.setHeader("Accept-Ranges", "bytes");
      res.setHeader("Cache-Control", "private, max-age=3600");
      res.setHeader("X-Audio-Playable", audio.playable ? "1" : "0");
      const ext = audio.playable ? "mp3" : (audio.mimeType.split("/")[1] || "bin").replace(/[^a-z0-9]/gi, "");
      res.setHeader("Content-Disposition", `${audio.playable ? "inline" : "attachment"}; filename="call-${id}.${ext}"`);

      // دعم Range — ضروري لكي يعمل شريط التقدّم على أندرويد وسفاري
      const range = req.headers.range;
      if (range) {
        const m = /bytes=(\d*)-(\d*)/.exec(range);
        if (m) {
          const start = m[1] ? parseInt(m[1], 10) : 0;
          const end = m[2] ? Math.min(parseInt(m[2], 10), total - 1) : total - 1;
          if (start >= total || start > end) {
            res.setHeader("Content-Range", `bytes */${total}`);
            return res.status(416).end();
          }
          res.status(206);
          res.setHeader("Content-Range", `bytes ${start}-${end}/${total}`);
          res.setHeader("Content-Length", String(end - start + 1));
          return res.end(audio.data.subarray(start, end + 1));
        }
      }

      res.setHeader("Content-Length", String(total));
      res.end(audio.data);
    } catch (e) {
      console.error("[CallAudio] error:", e);
      if (!res.headersSent) res.status(500).json({ error: "internal_error" });
    }
  });
}
