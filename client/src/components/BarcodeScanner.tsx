import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { X } from "lucide-react";

// ماسح باركود/QR مستمر بالكاميرا — يبقى مفتوحاً ويستدعي onDetect لكل مسح جديد.
// يُستخدم في لوحة المندوب (APK) وفي لوحة الأدمِن لمسح باركود فاتورة الدلفري.
export default function BarcodeScanner({
  onDetect,
  onClose,
  title = "امسح الباركود",
  hint = "وجّه الكاميرا إلى باركود الفاتورة — يُقبل الطلب تلقائياً",
}: {
  onDetect: (text: string) => void;
  onClose: () => void;
  title?: string;
  hint?: string;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<any>(null);
  const onDetectRef = useRef(onDetect);
  const lastRef = useRef<{ code: string; at: number }>({ code: "", at: 0 });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { onDetectRef.current = onDetect; });

  useEffect(() => {
    let stopped = false;
    const reader = new BrowserMultiFormatReader();
    (async () => {
      try {
        const controls = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: "environment" } } },
          videoRef.current!,
          (result: any) => {
            if (stopped || !result) return;
            const text = typeof result.getText === "function" ? result.getText() : String(result);
            const now = Date.now();
            // تجاهل نفس الكود خلال 3 ثوانٍ كي لا يُقبل الطلب مراراً
            if (text === lastRef.current.code && now - lastRef.current.at < 3000) return;
            lastRef.current = { code: text, at: now };
            onDetectRef.current(text);
          }
        );
        controlsRef.current = controls;
      } catch (e: any) {
        setError(e?.message || "تعذّر فتح الكاميرا — تأكّد من منح الإذن");
      }
    })();
    return () => {
      stopped = true;
      try { controlsRef.current?.stop(); } catch (_) {}
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col" dir="rtl">
      <div className="flex items-center justify-between px-4 py-3 bg-black/85 text-white">
        <span className="font-bold text-base">{title}</span>
        <button onClick={onClose} className="p-2 rounded-lg bg-white/10 hover:bg-white/20" aria-label="إغلاق">
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div className="w-64 h-64 border-4 border-sky-400/80 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
        </div>
        {error && (
          <div className="absolute bottom-6 left-4 right-4 text-center text-white bg-red-600/85 rounded-xl p-3 text-sm">
            {error}
          </div>
        )}
      </div>
      <div className="px-4 py-3 bg-black/85 text-center text-white/80 text-sm">{hint}</div>
    </div>
  );
}
