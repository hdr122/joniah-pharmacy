import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Loader2, QrCode, KeyRound, LogOut, ShieldCheck, Send, Clock, Users,
  Megaphone, Inbox, AlarmClock, CheckCircle2, XCircle, PauseCircle, MessageCircle,
} from "lucide-react";
import { toast } from "sonner";

type Settings = {
  enabled: boolean; autoEnabled: boolean; template: string;
  anchor: "delivered" | "created"; delayHours: number;
  intervalSec: number; jitterSec: number; batchSize: number; batchPauseMin: number;
  dailyCap: number; checkOnWhatsApp: boolean; quietFromHour: number; quietToHour: number;
};

const VARS = ["{name}", "{phone}", "{order}", "{total}", "{area}", "{address}", "{branch}"];

function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer select-none">
      <input type="checkbox" className="mt-1 w-4 h-4 accent-violet-600 shrink-0" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="min-w-0">
        <span className="text-sm font-medium text-foreground">{label}</span>
        {hint && <span className="block text-xs text-muted-foreground leading-relaxed">{hint}</span>}
      </span>
    </label>
  );
}

function NumField({ label, hint, value, onChange, min, max, suffix }: {
  label: string; hint?: string; value: number; onChange: (v: number) => void; min?: number; max?: number; suffix?: string;
}) {
  return (
    <div>
      <Label className="text-sm">{label}</Label>
      <div className="relative mt-1">
        <Input type="number" inputMode="numeric" min={min} max={max} value={Number.isFinite(value) ? value : 0}
          onChange={(e) => onChange(parseInt(e.target.value, 10))} className="pl-14" />
        {suffix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">{suffix}</span>}
      </div>
      {hint && <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{hint}</p>}
    </div>
  );
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  pending: { label: "بانتظار موعدها", cls: "bg-amber-500" },
  sending: { label: "جارٍ الإرسال", cls: "bg-sky-500" },
  sent: { label: "أُرسلت", cls: "bg-emerald-600" },
  skipped: { label: "تُخطّيت", cls: "bg-gray-400" },
  failed: { label: "فشلت", cls: "bg-rose-600" },
  cancelled: { label: "أُلغيت", cls: "bg-gray-400" },
};

export default function WhatsAppFollowupPage() {
  const utils = trpc.useUtils();
  const statusQ = trpc.followup.status.useQuery(undefined, { refetchInterval: 4000 });
  const jobsQ = trpc.followup.jobs.useQuery({ limit: 60 }, { refetchInterval: 10000 });
  const campaignsQ = trpc.followup.campaigns.useQuery(undefined, { refetchInterval: 10000 });

  const connectM = trpc.followup.connect.useMutation({ onSuccess: () => utils.followup.status.invalidate() });
  const pairM = trpc.followup.pairingCode.useMutation({ onSuccess: () => utils.followup.status.invalidate() });
  const logoutM = trpc.followup.logout.useMutation({
    onSuccess: () => { utils.followup.status.invalidate(); toast.success("تم فصل رقم المتابعة"); },
  });
  const saveM = trpc.followup.saveSettings.useMutation({
    onSuccess: () => { utils.followup.status.invalidate(); toast.success("تم حفظ إعدادات المتابعة"); },
    onError: (e) => toast.error(e.message),
  });
  const campaignM = trpc.followup.createCampaign.useMutation({
    onSuccess: (r) => {
      toast.success(`أُضيفت ${r.queued} رسالة إلى قائمة الإرسال`);
      utils.followup.campaigns.invalidate(); utils.followup.jobs.invalidate(); utils.followup.status.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const cancelM = trpc.followup.cancelCampaign.useMutation({
    onSuccess: () => { toast.success("أُلغيت الحملة"); utils.followup.campaigns.invalidate(); utils.followup.jobs.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const st = statusQ.data;
  const [s, setS] = useState<Settings | null>(null);
  const [pairPhone, setPairPhone] = useState("");
  useEffect(() => { if (st?.settings && !s) setS(st.settings as Settings); }, [st?.settings]);

  // الحملة اليدوية
  const [cName, setCName] = useState("حملة متابعة");
  const [cTarget, setCTarget] = useState<"all" | "ordered">("ordered");
  const [cAll, setCAll] = useState(false);
  const [cLimit, setCLimit] = useState(50);
  const [cTemplate, setCTemplate] = useState("");

  const audienceQ = trpc.followup.audience.useQuery(
    { target: cTarget, limitCount: cAll ? 0 : cLimit },
    { enabled: !!st },
  );

  const previewQ = trpc.followup.preview.useQuery(
    { template: cTemplate || s?.template || "" },
    { enabled: !!(cTemplate || s?.template) },
  );

  const connected = st?.status === "connected";
  const set = (patch: Partial<Settings>) => setS((p) => (p ? { ...p, ...patch } : p));

  // كم تستغرق الحملة تقريباً بالإعدادات الحالية — رقم يمنع المفاجآت
  const eta = useMemo(() => {
    if (!s || !audienceQ.data?.count) return null;
    const n = audienceQ.data.count;
    const perMsg = s.intervalSec + s.jitterSec / 2;
    const pauses = s.batchPauseMin > 0 && s.batchSize > 0 ? Math.floor(n / s.batchSize) * s.batchPauseMin * 60 : 0;
    const totalSec = n * perMsg + pauses;
    const h = Math.floor(totalSec / 3600);
    const m = Math.round((totalSec % 3600) / 60);
    return h > 0 ? `${h} ساعة و${m} دقيقة` : `${m} دقيقة`;
  }, [s, audienceQ.data?.count]);

  if (statusQ.isLoading || !s) {
    return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-violet-600" /></div>;
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
          <Megaphone className="w-7 h-7 text-violet-600 shrink-0" /> ربط واتساب — قسم المتابعة
        </h1>
        <p className="text-muted-foreground mt-2 leading-relaxed">
          رقم واتساب <b>ثانٍ ومنفصل</b> عن رقم الفرع، مهمّته متابعة الزبائن بعد طلباتهم.
          يُرسل رسالة للزبون بعد مدّة تحدّدها، ويمكنك إطلاق حملة على زبائن الفرع.
        </p>
      </div>

      {/* ── الربط ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 flex-wrap">
            <QrCode className="w-5 h-5 text-violet-600 shrink-0" /> حالة الربط
            <Badge className={connected ? "bg-emerald-600" : st?.status === "qr" ? "bg-amber-500" : st?.status === "connecting" ? "bg-sky-500" : "bg-gray-400"}>
              {connected ? `متصل ✓ ${st?.phone ? "— " + st.phone : ""}`
                : st?.status === "qr" ? "بانتظار المسح"
                : st?.status === "connecting" ? "جارٍ الاتصال…" : "غير متصل"}
            </Badge>
          </CardTitle>
          <CardDescription className="leading-relaxed">
            استخدم <b>رقماً مختلفاً عن رقم الفرع الأساسي</b>. لا يمكن ربط الرقم نفسه على الخطّين.
            الجلسة محفوظة في الخادم فلا تحتاج إعادة مسح بعد تحديثات الموقع.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {st?.lastError && !connected && (
            <p className="text-sm text-rose-600 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-md px-3 py-2">{st.lastError}</p>
          )}

          {!connected && (
            <div className="grid md:grid-cols-2 gap-6">
              <div className="border rounded-lg p-4 text-center space-y-3">
                <p className="text-sm font-semibold flex items-center justify-center gap-2"><QrCode className="w-4 h-4" /> الربط بالباركود</p>
                {st?.status === "qr" && st.qrDataUrl ? (
                  <img src={st.qrDataUrl} alt="QR" className="mx-auto w-full max-w-[16rem] aspect-square rounded-md border" />
                ) : (
                  <div className="mx-auto w-full max-w-[16rem] aspect-square rounded-md border bg-muted flex items-center justify-center text-muted-foreground text-sm">
                    {st?.status === "connecting" ? <Loader2 className="w-6 h-6 animate-spin" /> : "اضغط «بدء الربط» لعرض الباركود"}
                  </div>
                )}
                <Button onClick={() => connectM.mutate()} disabled={connectM.isPending || st?.status === "connecting"} className="bg-violet-600 hover:bg-violet-700 w-full">
                  {connectM.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "بدء الربط / تحديث الباركود"}
                </Button>
                <p className="text-xs text-muted-foreground">واتساب ← ⋮ ← الأجهزة المرتبطة ← ربط جهاز ← امسح الباركود</p>
              </div>

              <div className="border rounded-lg p-4 space-y-3">
                <p className="text-sm font-semibold flex items-center gap-2"><KeyRound className="w-4 h-4" /> أو الربط برمز رقمي</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  أدخل رقم المتابعة، ثم في واتساب: الأجهزة المرتبطة ← ربط جهاز ← <b>الربط برقم الهاتف بدلاً من ذلك</b>.
                </p>
                <div className="flex gap-2 flex-wrap">
                  <Input dir="ltr" placeholder="07xxxxxxxxx" value={pairPhone} onChange={(e) => setPairPhone(e.target.value)} className="flex-1 min-w-[10rem]" />
                  <Button variant="outline" disabled={pairM.isPending || pairPhone.replace(/\D/g, "").length < 10}
                    onClick={() => pairM.mutate({ phone: pairPhone }, { onError: (e) => toast.error(e.message) })}>
                    {pairM.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "طلب الرمز"}
                  </Button>
                </div>
                {(pairM.data?.code || st?.pairingCode) && (
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground mb-1">رمز الربط (صالح لدقائق):</p>
                    <p className="text-2xl md:text-3xl font-mono font-bold tracking-widest text-violet-700 dark:text-violet-300" dir="ltr">
                      {pairM.data?.code || st?.pairingCode}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {connected && (
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="text-sm">
                <p>رقم المتابعة المرتبط: <b dir="ltr">{st?.phone}</b></p>
                <p className="text-xs text-muted-foreground mt-1">
                  اليوم: أُرسلت <b>{st?.today?.sent ?? 0}</b> • فشلت <b>{st?.today?.failed ?? 0}</b> • تخطّتها الحماية <b>{st?.today?.skipped ?? 0}</b>
                </p>
              </div>
              <Button variant="outline" className="text-rose-600 border-rose-300" disabled={logoutM.isPending} onClick={() => logoutM.mutate()}>
                <LogOut className="w-4 h-4 ml-1" /> فصل الرقم
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── عدّادات ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "بانتظار الإرسال", value: st?.stats?.pending ?? 0, Icon: Clock, cls: "text-amber-600" },
          { label: "مستحقّة الآن", value: st?.stats?.dueNow ?? 0, Icon: AlarmClock, cls: "text-violet-600" },
          { label: "أُرسلت اليوم", value: st?.stats?.sentToday ?? 0, Icon: CheckCircle2, cls: "text-emerald-600" },
          { label: "فشلت اليوم", value: st?.stats?.failedToday ?? 0, Icon: XCircle, cls: "text-rose-600" },
        ].map(({ label, value, Icon, cls }) => (
          <Card key={label}>
            <CardContent className="p-4 flex items-center gap-3">
              <Icon className={`w-5 h-5 shrink-0 ${cls}`} />
              <div className="min-w-0">
                <p className="text-xl font-bold">{value}</p>
                <p className="text-xs text-muted-foreground truncate">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {st?.runner?.note && (
        <p className="text-xs text-muted-foreground flex items-center gap-2">
          <PauseCircle className="w-3.5 h-3.5 shrink-0" />
          حالة المُرسل: {st.runner.note}
          {st.runner.pausedUntil && ` — استراحة حتى ${new Date(st.runner.pausedUntil).toLocaleTimeString("ar-IQ", { hour: "2-digit", minute: "2-digit" })}`}
        </p>
      )}

      <Tabs defaultValue="settings" dir="rtl">
        <TabsList className="grid w-full grid-cols-3 h-auto">
          <TabsTrigger value="settings" className="text-xs md:text-sm py-2">المؤقّت والحماية</TabsTrigger>
          <TabsTrigger value="campaign" className="text-xs md:text-sm py-2">حملة على الزبائن</TabsTrigger>
          <TabsTrigger value="queue" className="text-xs md:text-sm py-2">قائمة الإرسال</TabsTrigger>
        </TabsList>

        {/* ══ المؤقّت والحماية ══ */}
        <TabsContent value="settings" className="space-y-6 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Clock className="w-5 h-5 text-violet-600" /> مؤقّت المتابعة</CardTitle>
              <CardDescription>رسالة تلقائية لكل زبون بعد مدّة من طلبه.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <Toggle checked={s.enabled} onChange={(v) => set({ enabled: v })}
                label="تفعيل قسم المتابعة"
                hint="عند الإيقاف لا تُرسل أي رسالة متابعة، وتبقى الرسائل المجدولة في الانتظار." />
              <Toggle checked={s.autoEnabled} onChange={(v) => set({ autoEnabled: v })}
                label="جدولة تلقائية لكل طلب"
                hint="عند الإيقاف لا تُجدوَل رسائل جديدة تلقائياً — تبقى الحملات اليدوية فقط." />

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm">يبدأ العدّ من</Label>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    {([["delivered", "تسليم الطلب"], ["created", "إنشاء الطلب"]] as const).map(([v, lbl]) => (
                      <button key={v} type="button" onClick={() => set({ anchor: v })}
                        className={`border rounded-md py-2 text-sm transition-colors ${
                          s.anchor === v ? "bg-violet-600 text-white border-violet-600" : "hover:bg-muted"
                        }`}>
                        {lbl}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    {s.anchor === "delivered"
                      ? "الطلبات الملغاة والمرتجعة لا تُرسل لها متابعة."
                      : "قد تصل الرسالة لزبون لم يستلم طلبه بعد."}
                  </p>
                </div>
                <NumField label="بعد كم ساعة تُرسل الرسالة" suffix="ساعة" min={0} max={720}
                  value={s.delayHours} onChange={(v) => set({ delayHours: v })}
                  hint="مثال: 24 = بعد يوم كامل، 2 = بعد ساعتين، 1 = بعد ساعة." />
              </div>

              <div>
                <Label className="text-sm">نص رسالة المتابعة</Label>
                <Textarea value={s.template} onChange={(e) => set({ template: e.target.value })}
                  className="mt-1 min-h-[150px] text-base leading-relaxed resize-y" rows={7} />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {VARS.map((v) => (
                    <button key={v} type="button" onClick={() => set({ template: s.template + " " + v })}
                      className="text-xs px-2 py-1 rounded border hover:bg-muted font-mono" dir="ltr">{v}</button>
                  ))}
                </div>
                {previewQ.data && (
                  <div className="mt-3 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900">
                    <p className="text-xs text-muted-foreground mb-1">معاينة كما تصل الزبون:</p>
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{previewQ.data}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-emerald-600" /> 🛡 نظام الحماية</CardTitle>
              <CardDescription className="leading-relaxed">
                الإرسال المتلاحق أشهر سبب لحظر أرقام الواتساب. هذه الحدود تُبطئ الإرسال عمداً — لا تخفضها كثيراً.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid md:grid-cols-2 gap-4">
                <NumField label="فاصل بين كل رسالة والتالية" suffix="ثانية" min={10} max={3600}
                  value={s.intervalSec} onChange={(v) => set({ intervalSec: v })}
                  hint="60 = رسالة كل دقيقة، 20 = كل 20 ثانية. أقل قيمة مسموحة 10 ثوانٍ." />
                <NumField label="عشوائية تُضاف للفاصل" suffix="ثانية" min={0} max={600}
                  value={s.jitterSec} onChange={(v) => set({ jitterSec: v })}
                  hint="وقت عشوائي يُضاف لكل فاصل حتى لا يبدو الإرسال آلياً منتظماً." />
                <NumField label="عدد الرسائل قبل الاستراحة" suffix="رسالة" min={1} max={100}
                  value={s.batchSize} onChange={(v) => set({ batchSize: v })}
                  hint="مثال: 5 = بعد كل 5 رسائل يأخذ النظام استراحة." />
                <NumField label="مدّة الاستراحة" suffix="دقيقة" min={0} max={240}
                  value={s.batchPauseMin} onChange={(v) => set({ batchPauseMin: v })}
                  hint="بعد انتهائها تُكمل بقية الرسائل تلقائياً. 0 = بلا استراحة." />
                <NumField label="الحد اليومي للرسائل" suffix="رسالة" min={1} max={5000}
                  value={s.dailyCap} onChange={(v) => set({ dailyCap: v })}
                  hint="عند بلوغه يتوقّف الإرسال حتى اليوم التالي." />
                <div className="grid grid-cols-2 gap-2">
                  <NumField label="بدء ساعات الهدوء" suffix="س" min={0} max={23}
                    value={s.quietFromHour} onChange={(v) => set({ quietFromHour: v })} />
                  <NumField label="نهاية ساعات الهدوء" suffix="س" min={0} max={23}
                    value={s.quietToHour} onChange={(v) => set({ quietToHour: v })} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground -mt-2">
                ساعات الهدوء بتوقيت بغداد: لا تُرسل رسائل بين {s.quietFromHour}:00 و{s.quietToHour}:00.
                اجعل الرقمين متساويين لتعطيلها.
              </p>

              <Toggle checked={s.checkOnWhatsApp} onChange={(v) => set({ checkOnWhatsApp: v })}
                label="التحقّق من أن الرقم على واتساب قبل الإرسال"
                hint="الأرقام التي لا تملك واتساب تُتخطّى بلا محاولة إرسال — يُنصَح بإبقائه مفعّلاً." />

              <div className="flex justify-end">
                <Button onClick={() => saveM.mutate(s)} disabled={saveM.isPending} className="bg-violet-600 hover:bg-violet-700">
                  {saveM.isPending ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : null} حفظ الإعدادات
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ══ حملة يدوية ══ */}
        <TabsContent value="campaign" className="space-y-6 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Users className="w-5 h-5 text-violet-600" /> حملة على زبائن الفرع</CardTitle>
              <CardDescription>أرسل كليشة واحدة لعدد من الزبائن أو لهم جميعاً، بنفس نظام الحماية أعلاه.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <Label className="text-sm">اسم الحملة</Label>
                <Input value={cName} onChange={(e) => setCName(e.target.value)} className="mt-1" placeholder="حملة متابعة" />
              </div>

              <div>
                <Label className="text-sm">من تشمل الحملة</Label>
                <div className="grid md:grid-cols-2 gap-2 mt-1">
                  {([["ordered", "زبائن طلبوا من هذا الفرع", "الأحدث طلباً أولاً"], ["all", "كل زبائن الفرع", "بمن فيهم من لم يطلب بعد"]] as const).map(([v, lbl, hint]) => (
                    <button key={v} type="button" onClick={() => setCTarget(v)}
                      className={`border rounded-md p-3 text-right transition-colors ${
                        cTarget === v ? "bg-violet-600 text-white border-violet-600" : "hover:bg-muted"
                      }`}>
                      <span className="block text-sm font-medium">{lbl}</span>
                      <span className={`block text-xs mt-0.5 ${cTarget === v ? "text-violet-100" : "text-muted-foreground"}`}>{hint}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <Toggle checked={cAll} onChange={setCAll} label="إرسال للجميع بلا حد للعدد"
                  hint="عند الإيقاف تُرسل لعدد محدّد فقط من الزبائن." />
                {!cAll && (
                  <NumField label="عدد الزبائن" suffix="زبون" min={1} max={5000}
                    value={cLimit} onChange={(v) => setCLimit(v)} />
                )}
              </div>

              <div>
                <Label className="text-sm">نص الكليشة</Label>
                <Textarea value={cTemplate} onChange={(e) => setCTemplate(e.target.value)}
                  placeholder={s.template}
                  className="mt-1 min-h-[140px] text-base leading-relaxed resize-y" rows={6} />
                <p className="text-xs text-muted-foreground mt-1">اتركه فارغاً لاستخدام نص رسالة المتابعة أعلاه. المتغيّرات المتاحة: {VARS.join(" ")}</p>
              </div>

              <div className="p-3 rounded-lg bg-violet-50 dark:bg-violet-950/20 border border-violet-200 dark:border-violet-900 space-y-1">
                <p className="text-sm">
                  ستصل الرسالة إلى <b>{audienceQ.isLoading ? "…" : audienceQ.data?.count ?? 0}</b> زبون.
                </p>
                {eta && <p className="text-xs text-muted-foreground">المدّة التقريبية لإتمام الحملة بالإعدادات الحالية: <b>{eta}</b></p>}
                {!connected && <p className="text-xs text-rose-600">رقم المتابعة غير متصل — ستبقى الرسائل في الانتظار حتى تربطه.</p>}
                {!s.enabled && <p className="text-xs text-rose-600">قسم المتابعة غير مفعّل — فعّله من تبويب «المؤقّت والحماية» ليبدأ الإرسال.</p>}
              </div>

              <div className="flex justify-end">
                <Button
                  disabled={campaignM.isPending || !audienceQ.data?.count}
                  onClick={() => campaignM.mutate({ name: cName, template: cTemplate || undefined, target: cTarget, limitCount: cAll ? 0 : cLimit })}
                  className="bg-violet-600 hover:bg-violet-700">
                  {campaignM.isPending ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : <Send className="w-4 h-4 ml-1" />}
                  إطلاق الحملة
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-lg">الحملات السابقة</CardTitle></CardHeader>
            <CardContent>
              {!campaignsQ.data?.length ? (
                <p className="text-sm text-muted-foreground text-center py-6">لا توجد حملات بعد</p>
              ) : (
                <div className="space-y-2">
                  {campaignsQ.data.map((c: any) => (
                    <div key={c.id} className="border rounded-lg p-3 flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0">
                        <p className="font-medium text-sm">{c.name || "حملة"}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {c.total} زبون • أُرسلت {c.sent} • تُخطّيت {c.skipped} • فشلت {c.failed} • متبقّي {c.pending}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge className={c.status === "done" ? "bg-emerald-600" : c.status === "cancelled" ? "bg-gray-400" : "bg-sky-500"}>
                          {c.status === "done" ? "اكتملت" : c.status === "cancelled" ? "أُلغيت" : "جارية"}
                        </Badge>
                        {c.status === "running" && (
                          <Button size="sm" variant="outline" className="text-rose-600 border-rose-300"
                            disabled={cancelM.isPending} onClick={() => cancelM.mutate({ id: c.id })}>
                            إيقاف
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ══ قائمة الإرسال ══ */}
        <TabsContent value="queue" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg"><Inbox className="w-5 h-5 text-violet-600" /> آخر 60 رسالة في قائمة الإرسال</CardTitle>
            </CardHeader>
            <CardContent>
              {!jobsQ.data?.length ? (
                <p className="text-sm text-muted-foreground text-center py-6">لا توجد رسائل بعد</p>
              ) : (
                <div className="space-y-2">
                  {jobsQ.data.map((j: any) => {
                    const b = STATUS_BADGE[j.status] || { label: j.status, cls: "bg-gray-400" };
                    return (
                      <div key={j.id} className="border rounded-lg p-3 flex items-start justify-between gap-3 flex-wrap">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">
                            {j.name || "زبون"} <span dir="ltr" className="text-muted-foreground font-normal">{j.phone}</span>
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {j.orderId ? `طلب #${j.orderId} • ` : j.campaignId ? "حملة • " : ""}
                            موعدها {new Date(j.dueAt).toLocaleString("ar-IQ", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                          </p>
                          {j.error && <p className="text-xs text-rose-600 mt-0.5 break-words">{j.error}</p>}
                        </div>
                        <Badge className={`${b.cls} shrink-0`}>{b.label}</Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <p className="text-xs text-muted-foreground flex items-start gap-2 leading-relaxed">
        <MessageCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        ردود الزبائن على رقم المتابعة تصل إلى صندوق رسائل منفصل عن صندوق الرقم الأساسي.
      </p>
    </div>
  );
}
