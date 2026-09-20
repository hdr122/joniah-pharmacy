// ─────────────────────────────────────────────────────────────────────────────
// توحيد أخطاء الذكاء الاصطناعي تحت علامة Xenon فقط.
// يجب ألا يتسرّب أي نص من المزوّد (Gemini / Google / AI Studio / حدود الإنفاق…)
// إلى واجهة الموقع. أي فشل من خدمة الذكاء يُترجَم لرسالة عربية واحدة موحّدة.
// ─────────────────────────────────────────────────────────────────────────────

export const XENON_AI_OUT_OF_CREDIT =
  "رصيدك في ذكاء اصطناعي Xenon قد نفذ — اتصل بالمطور لشحنه";

// أنماط تكشف تسرّب هوية المزوّد الأصلي في أي رسالة خطأ.
const PROVIDER_LEAK =
  /gemini|google|generativelanguage|ai\.studio|ai\.google\.dev|AI Studio|spending cap|spend|quota|RESOURCE_EXHAUSTED|api[_ ]?key|generativeai/i;

/** أي استجابة غير ناجحة من خدمة الذكاء → رسالة Xenon واحدة. النص الأصلي يُسجَّل محليًا فقط. */
export function xenonAiError(status?: number, rawText?: string): Error {
  if (rawText) {
    try { console.warn("[xenon-ai] upstream", status ?? "", String(rawText).slice(0, 300)); } catch { /* noop */ }
  }
  return new Error(XENON_AI_OUT_OF_CREDIT);
}

/** يُنظّف أي رسالة قد تحمل نص المزوّد قبل إرسالها للعميل (دفاع بالعمق). */
export function sanitizeAiMessage(msg?: string): string {
  const m = String(msg || "");
  return PROVIDER_LEAK.test(m) ? XENON_AI_OUT_OF_CREDIT : m;
}
