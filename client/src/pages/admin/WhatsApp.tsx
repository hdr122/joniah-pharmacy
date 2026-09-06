import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, MessageCircle, QrCode, KeyRound, LogOut, Send, ShieldCheck, Bike, User } from "lucide-react";
import { toast } from "sonner";

type Settings = {
  enabled: boolean; notifyCourier: boolean; notifyCustomer: boolean;
  courierTemplate: string; customerTemplate: string;
  protectionEnabled: boolean; minDelaySec: number; maxDelaySec: number; maxPerMinute: number;
  dailyCapTotal: number; dailyCapPerCustomer: number; customerCooldownMin: number; checkOnWhatsApp: boolean;
};

const VARS = ["{order}", "{name}", "{phone}", "{area}", "{address}", "{items}", "{total}", "{note}", "{driver}", "{driverPhone}", "{branch}", "{ratingLink}"];

function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer select-none">
      <input type="checkbox" className="mt-1 w-4 h-4 accent-emerald-600" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>
        <span className="text-sm font-medium text-gray-900">{label}</span>
        {hint && <span className="block text-xs text-gray-500">{hint}</span>}
      </span>
    </label>
  );
}

export default function WhatsAppPage() {
  const utils = trpc.useUtils();
  const statusQ = trpc.whatsapp.status.useQuery(undefined, { refetchInterval: 3000, refetchOnWindowFocus: true });
  const logsQ = trpc.whatsapp.logs.useQuery(undefined, { refetchInterval: 10000 });
  const connectM = trpc.whatsapp.connect.useMutation({ onSuccess: () => utils.whatsapp.status.invalidate() });
  const pairM = trpc.whatsapp.pairingCode.useMutation({ onSuccess: () => utils.whatsapp.status.invalidate() });
  const logoutM = trpc.whatsapp.logout.useMutation({ onSuccess: () => { utils.whatsapp.status.invalidate(); toast.success("تم فصل واتساب"); } });
  const saveM = trpc.whatsapp.saveSettings.useMutation({ onSuccess: () => { utils.whatsapp.status.invalidate(); toast.success("تم الحفظ"); } });
  const testM = trpc.whatsapp.testSend.useMutation();

  const st = statusQ.data;
  const [s, setS] = useState<Settings | null>(null);
  const [pairPhone, setPairPhone] = useState("");
  const [testPhone, setTestPhone] = useState("");
  const [previewTpl, setPreviewTpl] = useState<string>("");
  useEffect(() => { if (st?.settings && !s) setS(st.settings as Settings); }, [st?.settings]);
  const previewQ = trpc.whatsapp.preview.useQuery({ template: previewTpl }, { enabled: previewTpl.length > 0 });

  const connected = st?.status === "connected";
  const set = (patch: Partial<Settings>) => setS((p) => (p ? { ...p, ...patch } : p));
  const save = () => { if (s) saveM.mutate(s); };

  if (statusQ.isLoading || !s) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2"><MessageCircle className="w-7 h-7 text-emerald-600" /> واتساب الفرع</h1>
        <p className="text-gray-600 mt-2">اربط رقم واتساب الفرع لإرسال تفاصيل الطلبات للمندوبين والزبائن تلقائياً.</p>
      </div>

      {/* ── الربط ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-emerald-600" /> حالة الربط
            <Badge className={connected ? "bg-emerald-600" : st?.status === "qr" ? "bg-amber-500" : st?.status === "connecting" ? "bg-sky-500" : "bg-gray-400"}>
              {connected ? `متصل ✓ ${st?.phone ? "— " + st.phone : ""}` : st?.status === "qr" ? "بانتظار المسح" : st?.status === "connecting" ? "جارٍ الاتصال…" : "غير متصل"}
            </Badge>
          </CardTitle>
          <CardDescription>
            يُفضَّل استخدام <b>رقم مخصص للفرع</b> (وليس رقمك الشخصي). الجلسة تُحفظ في الخادم فلا تحتاج إعادة مسح بعد تحديثات الموقع.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {st?.lastError && !connected && <p className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-md px-3 py-2">{st.lastError}</p>}
          {!connected && (
            <div className="grid md:grid-cols-2 gap-6">
              {/* QR */}
              <div className="border rounded-lg p-4 text-center space-y-3">
                <p className="text-sm font-semibold flex items-center justify-center gap-2"><QrCode className="w-4 h-4" /> الربط بالباركود</p>
                {st?.status === "qr" && st.qrDataUrl ? (
                  <img src={st.qrDataUrl} alt="QR" className="mx-auto w-64 h-64 rounded-md border" />
                ) : (
                  <div className="mx-auto w-64 h-64 rounded-md border bg-gray-50 flex items-center justify-center text-gray-400 text-sm">
                    {st?.status === "connecting" ? <Loader2 className="w-6 h-6 animate-spin" /> : "اضغط «بدء الربط» لعرض الباركود"}
                  </div>
                )}
                <Button onClick={() => connectM.mutate()} disabled={connectM.isPending || st?.status === "connecting"} className="bg-emerald-600 hover:bg-emerald-700">
                  {connectM.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "بدء الربط / تحديث الباركود"}
                </Button>
                <p className="text-xs text-gray-500">واتساب ← ⋮ ← الأجهزة المرتبطة ← ربط جهاز ← امسح الباركود</p>
              </div>
              {/* Pairing code */}
              <div className="border rounded-lg p-4 space-y-3">
                <p className="text-sm font-semibold flex items-center gap-2"><KeyRound className="w-4 h-4" /> أو الربط برمز رقمي</p>
                <p className="text-xs text-gray-500">أدخل رقم واتساب الفرع (مثال 07701234567)، ثم في واتساب: الأجهزة المرتبطة ← ربط جهاز ← <b>الربط برقم الهاتف بدلاً من ذلك</b> وأدخل الرمز.</p>
                <div className="flex gap-2">
                  <Input dir="ltr" placeholder="07xxxxxxxxx" value={pairPhone} onChange={(e) => setPairPhone(e.target.value)} />
                  <Button variant="outline" disabled={pairM.isPending || pairPhone.replace(/\D/g, "").length < 10}
                    onClick={() => pairM.mutate({ phone: pairPhone }, { onError: (e) => toast.error(e.message) })}>
                    {pairM.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "طلب الرمز"}
                  </Button>
                </div>
                {(pairM.data?.code || st?.pairingCode) && (
                  <div className="text-center">
                    <p className="text-xs text-gray-500 mb-1">رمز الربط (صالح لدقائق):</p>
                    <p className="text-3xl font-mono font-bold tracking-widest text-emerald-700" dir="ltr">{pairM.data?.code || st?.pairingCode}</p>
                  </div>
                )}
              </div>
            </div>
          )}
          {connected && (
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="text-sm text-gray-700">
                <p>الرقم المرتبط: <b dir="ltr">{st?.phone}</b></p>
                <p className="text-xs text-gray-500 mt-1">اليوم: أُرسلت <b>{st?.today?.sent ?? 0}</b> • فشلت <b>{st?.today?.failed ?? 0}</b> • تجاوزتها الحماية <b>{st?.today?.skipped ?? 0}</b>{st?.queued ? ` • في الانتظار ${st.queued}` : ""}</p>
              </div>
              <div className="flex gap-2 items-center flex-wrap">
                <Input dir="ltr" placeholder="رقم للتجربة 07xxxxxxxxx" value={testPhone} onChange={(e) => setTestPhone(e.target.value)} className="w-52" />
                <Button variant="outline" disabled={testM.isPending || testPhone.replace(/\D/g, "").length < 10}
                  onClick={() => testM.mutate({ phone: testPhone }, {
                    onSuccess: (r) => r.ok ? toast.success("أُرسلت الرسالة التجريبية ✓") : toast.error(r.error || r.skipped || "لم تُرسل"),
                    onError: (e) => toast.error(e.message),
                  })}>
                  <Send className="w-4 h-4 ml-1" /> إرسال تجريبي
                </Button>
                <Button variant="destructive" onClick={() => { if (confirm("فصل واتساب من هذا الفرع؟")) logoutM.mutate(); }}>
                  <LogOut className="w-4 h-4 ml-1" /> فصل
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── الإشعارات ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Send className="w-5 h-5 text-emerald-600" /> الإشعارات التلقائية</CardTitle>
          <CardDescription>المتغيرات المتاحة في القوالب: {VARS.map(v => <code key={v} className="mx-0.5 px-1 rounded bg-gray-100 text-[11px]" dir="ltr">{v}</code>)} — <code dir="ltr">{"{ratingLink}"}</code> محجوز لميزة التقييم مستقبلاً.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <Toggle checked={s.enabled} onChange={(v) => set({ enabled: v })} label="تفعيل إشعارات واتساب لهذا الفرع" hint="مفتاح رئيسي — عند إيقافه لا تُرسل أي رسالة" />
          <div className="grid md:grid-cols-2 gap-6">
            <div className="border rounded-lg p-4 space-y-3">
              <Toggle checked={s.notifyCourier} onChange={(v) => set({ notifyCourier: v })} label="📩 إشعار المندوب" hint="عند تعيين أو تحويل طلب إليه تصله رسالة خاصة بكل التفاصيل" />
              <textarea className="w-full border rounded-md p-2 text-sm h-44 font-mono" dir="rtl" value={s.courierTemplate} onChange={(e) => set({ courierTemplate: e.target.value })} />
              <Button variant="outline" size="sm" onClick={() => setPreviewTpl(s.courierTemplate)}>معاينة</Button>
            </div>
            <div className="border rounded-lg p-4 space-y-3">
              <Toggle checked={s.notifyCustomer} onChange={(v) => set({ notifyCustomer: v })} label="💬 إشعار الزبون" hint="عند إنشاء طلب لرقم موجود على واتساب تصله تفاصيل طلبه" />
              <textarea className="w-full border rounded-md p-2 text-sm h-44 font-mono" dir="rtl" value={s.customerTemplate} onChange={(e) => set({ customerTemplate: e.target.value })} />
              <Button variant="outline" size="sm" onClick={() => setPreviewTpl(s.customerTemplate)}>معاينة</Button>
            </div>
          </div>
          {previewTpl && (
            <div className="border rounded-lg p-4 bg-emerald-50/50">
              <p className="text-xs text-gray-500 mb-2">معاينة بأرقام تجريبية:</p>
              <pre className="whitespace-pre-wrap text-sm font-sans text-gray-800" dir="rtl">{previewQ.data ?? "…"}</pre>
            </div>
          )}
          <Button onClick={save} disabled={saveM.isPending} className="bg-emerald-600 hover:bg-emerald-700">{saveM.isPending ? "جارٍ الحفظ…" : "حفظ الإعدادات"}</Button>
        </CardContent>
      </Card>

      {/* ── 🛡 نظام Xenon للحماية ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-emerald-600" /> 🛡 نظام Xenon للحماية</CardTitle>
          <CardDescription>يقلّل خطر حظر الرقم بمحاكاة الإرسال البشري وفرض حدود. يمكن تعطيله بالكامل أو تخصيص كل قيمة.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Toggle checked={s.protectionEnabled} onChange={(v) => set({ protectionEnabled: v })} label="تفعيل نظام Xenon للحماية" hint="عند الإيقاف تُرسل الرسائل فوراً بلا حدود (غير مُستحسن)" />
          <div className={`grid grid-cols-2 md:grid-cols-3 gap-4 ${s.protectionEnabled ? "" : "opacity-50 pointer-events-none"}`}>
            <div><label className="text-xs text-gray-600">أقل تأخير بين الرسائل (ثانية)</label><Input type="number" min={0} value={s.minDelaySec} onChange={(e) => set({ minDelaySec: Number(e.target.value) })} /></div>
            <div><label className="text-xs text-gray-600">أعلى تأخير بين الرسائل (ثانية)</label><Input type="number" min={0} value={s.maxDelaySec} onChange={(e) => set({ maxDelaySec: Number(e.target.value) })} /></div>
            <div><label className="text-xs text-gray-600">الحد الأقصى في الدقيقة</label><Input type="number" min={1} value={s.maxPerMinute} onChange={(e) => set({ maxPerMinute: Number(e.target.value) })} /></div>
            <div><label className="text-xs text-gray-600">الحد اليومي الكلي للرسائل</label><Input type="number" min={1} value={s.dailyCapTotal} onChange={(e) => set({ dailyCapTotal: Number(e.target.value) })} /></div>
            <div><label className="text-xs text-gray-600 font-semibold">الحد اليومي لكل زبون</label><Input type="number" min={1} value={s.dailyCapPerCustomer} onChange={(e) => set({ dailyCapPerCustomer: Number(e.target.value) })} /></div>
            <div><label className="text-xs text-gray-600">عدم تكرار الرسالة لنفس الزبون خلال (دقيقة)</label><Input type="number" min={0} value={s.customerCooldownMin} onChange={(e) => set({ customerCooldownMin: Number(e.target.value) })} /></div>
          </div>
          <div className={s.protectionEnabled ? "" : "opacity-50 pointer-events-none"}>
            <Toggle checked={s.checkOnWhatsApp} onChange={(v) => set({ checkOnWhatsApp: v })} label="التحقق أن رقم الزبون على واتساب قبل الإرسال" hint="يمنع محاولات الإرسال لأرقام غير مسجّلة (من أهم عوامل الحظر)" />
          </div>
          <Button onClick={save} disabled={saveM.isPending} className="bg-emerald-600 hover:bg-emerald-700">{saveM.isPending ? "جارٍ الحفظ…" : "حفظ إعدادات الحماية"}</Button>
        </CardContent>
      </Card>

      {/* ── السجل ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">📜 آخر الرسائل</CardTitle>
        </CardHeader>
        <CardContent>
          {(logsQ.data || []).length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-6">لا توجد رسائل بعد</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-right text-gray-500 border-b"><th className="py-2">الوقت</th><th>النوع</th><th>الرقم</th><th>الطلب</th><th>الحالة</th><th>ملاحظة</th></tr></thead>
                <tbody>
                  {(logsQ.data || []).map((l: any) => (
                    <tr key={l.id} className="border-b last:border-0">
                      <td className="py-2 text-gray-600 whitespace-nowrap">{new Date(l.createdAt).toLocaleString("ar-IQ", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}</td>
                      <td>{l.kind === "courier" ? <span className="inline-flex items-center gap-1"><Bike className="w-3.5 h-3.5" /> مندوب</span> : l.kind === "customer" ? <span className="inline-flex items-center gap-1"><User className="w-3.5 h-3.5" /> زبون</span> : "تجريبي"}</td>
                      <td dir="ltr" className="text-right font-mono text-xs">{l.toPhone}</td>
                      <td>{l.orderId ? `#${l.orderId}` : "—"}</td>
                      <td><Badge className={l.status === "sent" ? "bg-emerald-600" : l.status === "skipped" ? "bg-amber-500" : "bg-rose-600"}>{l.status === "sent" ? "أُرسلت" : l.status === "skipped" ? "تجاوز (حماية)" : "فشل"}</Badge></td>
                      <td className="text-xs text-gray-500">{l.error || ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
