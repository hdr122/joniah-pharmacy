import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Sparkles, RefreshCw, Search, Phone, User, Volume2, MessageSquare } from "lucide-react";
import { toast } from "sonner";

const MOOD: Record<string, { label: string; emoji: string; cls: string; soft: string }> = {
  happy:   { label: "فرحان", emoji: "😊", cls: "bg-emerald-600 text-white", soft: "bg-emerald-50 border-emerald-200 text-emerald-900" },
  neutral: { label: "عادي",  emoji: "😐", cls: "bg-slate-500 text-white",   soft: "bg-slate-50 border-slate-200 text-slate-900" },
  annoyed: { label: "ضايج",  emoji: "😒", cls: "bg-amber-500 text-white",   soft: "bg-amber-50 border-amber-200 text-amber-900" },
  angry:   { label: "منزعج", emoji: "😡", cls: "bg-rose-600 text-white",    soft: "bg-rose-50 border-rose-200 text-rose-900" },
};
const CHANNEL: Record<string, { label: string; emoji: string; cls: string }> = {
  whatsapp_chat: { label: "محادثة واتساب", emoji: "💬", cls: "bg-emerald-100 text-emerald-800" },
  whatsapp_call: { label: "مكالمة واتساب", emoji: "📞", cls: "bg-teal-100 text-teal-800" },
  cellular_call: { label: "مكالمة رصيد",   emoji: "📱", cls: "bg-sky-100 text-sky-800" },
  call:          { label: "مكالمة",        emoji: "📞", cls: "bg-gray-100 text-gray-700" },
};
const moodOf = (m: string) => MOOD[m] || MOOD.neutral;
const chOf = (c: string) => CHANNEL[c] || CHANNEL.call;
const showPhone = (p: string) => (p && p.startsWith("964") ? "0" + p.slice(3) : p || "");
const dt = (v: any) => {
  if (!v) return "—";
  try { return new Date(v).toLocaleString("ar-IQ", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }); } catch { return String(v); }
};
const today = () => new Date(Date.now() + 3 * 3600 * 1000).toISOString().slice(0, 10);
const daysAgo = (n: number) => new Date(Date.now() + 3 * 3600 * 1000 - n * 86400000).toISOString().slice(0, 10);

function AudioPlayer({ id }: { id: number }) {
  const { data, isLoading } = trpc.callRecordings.audio.useQuery({ id }, { refetchOnWindowFocus: false });
  if (isLoading) return <div className="text-sm text-gray-500 flex items-center gap-2 p-3 bg-gray-50 rounded-lg"><Loader2 className="w-4 h-4 animate-spin" /> جارٍ تحميل التسجيل…</div>;
  if (!data?.audioBase64) return <div className="text-sm text-gray-400 p-3 bg-gray-50 rounded-lg">لا يوجد تسجيل صوتي لهذه المكالمة</div>;
  return (
    <div className="p-3 bg-violet-50 border border-violet-200 rounded-lg space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium text-violet-900"><Volume2 className="w-4 h-4" /> التسجيل الصوتي للمكالمة</div>
      <audio controls className="w-full" src={`data:${data.mimeType || "audio/mp4"};base64,${data.audioBase64}`} />
    </div>
  );
}

function AnalysisCard({ row }: { row: any }) {
  const m = moodOf(row.mood);
  return (
    <div className={`rounded-lg border p-3 space-y-2 ${m.soft}`}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="font-bold text-base">{m.emoji} الحالة: {m.label}</span>
        <Badge className={chOf(row.channel).cls + " border-0"}>{chOf(row.channel).emoji} {chOf(row.channel).label}</Badge>
      </div>
      <div className="text-sm"><span className="font-semibold">السبب:</span> {row.reason || "—"}</div>
      {row.wants && <div className="text-sm"><span className="font-semibold">ماذا يريد:</span> {row.wants}</div>}
      {row.summary && <div className="text-sm"><span className="font-semibold">الملخص:</span> {row.summary}</div>}
      <div className="text-[11px] opacity-70">آخر تحليل: {dt(row.analyzedAt)}</div>
    </div>
  );
}

function DetailDialog({ refKey, onClose }: { refKey: string | null; onClose: () => void }) {
  const utils = trpc.useUtils();
  const q = trpc.sentiment.detail.useQuery({ refKey: refKey || "" }, { enabled: !!refKey, refetchOnWindowFocus: false });
  const re = trpc.sentiment.reanalyze.useMutation({
    onSuccess: () => { toast.success("تمت إعادة التحليل"); q.refetch(); utils.sentiment.list.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const d: any = q.data;
  const row = d?.row;
  return (
    <Dialog open={!!refKey} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-2 flex-wrap">
            <span className="flex items-center gap-2"><User className="w-5 h-5 text-gray-500" /> {row?.name || "زبون"} <span dir="ltr" className="font-mono text-sm text-gray-600">{showPhone(row?.phone)}</span></span>
            {refKey && <Button size="sm" variant="outline" disabled={re.isPending} onClick={() => re.mutate({ refKey })}>{re.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} إعادة التحليل</Button>}
          </DialogTitle>
        </DialogHeader>
        {q.isLoading ? <div className="py-10 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-violet-600" /></div> : (
          <div className="space-y-4">
            {row && <AnalysisCard row={row} />}
            {d?.kind === "chat" && (
              <div className="bg-gray-50 rounded-lg p-3 space-y-2 max-h-[45vh] overflow-y-auto">
                {(d.messages || []).map((m: any) => (
                  <div key={m.id} className={`flex ${Number(m.fromMe) ? "justify-start" : "justify-end"}`}>
                    <div className={`max-w-[80%] rounded-2xl px-3 py-2 shadow-sm text-sm whitespace-pre-wrap ${Number(m.fromMe) ? "bg-emerald-100 text-emerald-900" : "bg-white text-gray-900 border"}`}>
                      <div className="text-[10px] font-bold opacity-70 mb-0.5">{Number(m.fromMe) ? "المطعم" : (m.pushName || "الزبون")}</div>
                      {m.text}
                      <div className="text-[10px] opacity-60 mt-1 text-left" dir="ltr">{dt(m.createdAt)}</div>
                    </div>
                  </div>
                ))}
                {(d.messages || []).length === 0 && <p className="text-sm text-gray-400 text-center py-6">لا توجد رسائل</p>}
              </div>
            )}
            {d?.kind === "recording" && (
              <div className="space-y-3">
                {d.hasAudio && d.recording?.id && <AudioPlayer id={Number(d.recording.id)} />}
                <div className="grid grid-cols-2 gap-2 text-sm bg-gray-50 rounded-lg p-3 text-gray-900">
                  <div><span className="font-semibold">المنطقة:</span> {d.recording?.area || "—"}</div>
                  <div><span className="font-semibold">التاريخ:</span> {dt(d.recording?.createdAt)}</div>
                  {d.recording?.address && <div className="col-span-2"><span className="font-semibold">العنوان:</span> {d.recording.address}</div>}
                  {d.recording?.items && <div className="col-span-2"><span className="font-semibold">الطلبات:</span> {d.recording.items}</div>}
                </div>
                <div className="bg-gray-50 rounded-lg p-3 space-y-2 max-h-[40vh] overflow-y-auto">
                  {String(d.recording?.transcript || "").split("\n").map((l: string) => l.trim()).filter(Boolean).map((line: string, i: number) => {
                    const isCashier = line.startsWith("كاشير:"); const isCust = line.startsWith("زبون:");
                    const content = (isCashier || isCust) ? line.slice(line.indexOf(":") + 1).trim() : line;
                    return (
                      <div key={i} className={`flex ${isCashier ? "justify-start" : isCust ? "justify-end" : "justify-center"}`}>
                        <div className={`max-w-[80%] rounded-2xl px-3 py-2 shadow-sm text-sm ${isCashier ? "bg-violet-100 text-violet-900" : isCust ? "bg-emerald-100 text-emerald-900" : "bg-gray-100 text-gray-700"}`}>
                          {(isCashier || isCust) && <div className="text-[10px] font-bold opacity-70 mb-0.5">{isCashier ? "كاشير" : "زبون"}</div>}
                          {content}
                        </div>
                      </div>
                    );
                  })}
                  {!d.recording?.transcript && <p className="text-sm text-gray-400 text-center py-6">لا يوجد نص لهذه المكالمة</p>}
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function CustomerAnalysis() {
  const utils = trpc.useUtils();
  const [view, setView] = useState<"people" | "all">("people");
  const [mood, setMood] = useState("");
  const [channel, setChannel] = useState("");
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const listQ = trpc.sentiment.list.useQuery({ mood: mood || undefined, channel: channel || undefined, q: q || undefined, from: from || undefined, to: to || undefined },
    { refetchInterval: 30000, refetchOnWindowFocus: true });
  const runM = trpc.sentiment.analyzeNow.useMutation({
    onSuccess: (r: any) => {
      utils.sentiment.list.invalidate();
      if (r?.busy) toast.info("التحليل يعمل حالياً — انتظر قليلاً");
      else if (r?.error) toast.error(r.error);
      else toast.success(`تم تحليل ${r?.analyzed ?? 0} عنصراً${r?.remaining ? ` — بقي ${r.remaining}` : ""}`);
    },
    onError: (e) => toast.error(e.message),
  });

  const rows: any[] = listQ.data?.rows || [];
  const stats: any = listQ.data?.stats || {};
  const pending: any = listQ.data?.pending || {};

  // تجميع حسب الشخص (الرقم؛ وإن لم يوجد فالاسم)
  const people = useMemo(() => {
    const map = new Map<string, any>();
    for (const r of rows) {
      const key = r.phone ? String(r.phone) : "name:" + (r.name || "?");
      const p = map.get(key) || { key, phone: r.phone, name: r.name, items: [] as any[], channels: new Set<string>() };
      if (!p.name && r.name) p.name = r.name;
      p.items.push(r); p.channels.add(r.channel);
      map.set(key, p);
    }
    const arr = Array.from(map.values());
    for (const p of arr) {
      p.items.sort((a: any, b: any) => new Date(b.sourceAt || 0).getTime() - new Date(a.sourceAt || 0).getTime());
      p.latest = p.items[0];
      p.worst = p.items.reduce((w: any, x: any) => (Number(x.score) < Number(w.score) ? x : w), p.items[0]);
    }
    arr.sort((a, b) => new Date(b.latest?.sourceAt || 0).getTime() - new Date(a.latest?.sourceAt || 0).getTime());
    return arr;
  }, [rows]);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2"><Sparkles className="w-7 h-7 text-violet-600" /> تحليل الزبائن والمكالمات</h1>
          <p className="text-gray-600 mt-2">Xenon AI يقرأ كل محادثة واتساب وكل مكالمة (واتساب أو رصيد) ويحدّد حالة الزبون وسببها وماذا يريد.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button className="bg-violet-600 hover:bg-violet-700 gap-2" disabled={runM.isPending} onClick={() => runM.mutate({ max: 12 })}>
            {runM.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            تحليل الجديد الآن{pending.total ? ` (${pending.total})` : ""}
          </Button>
          <Button variant="outline" onClick={() => listQ.refetch()}><RefreshCw className="w-4 h-4" /></Button>
        </div>
      </div>

      {/* إحصائيات سريعة */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {(["happy", "neutral", "annoyed", "angry"] as const).map((k) => (
          <button key={k} onClick={() => setMood(mood === k ? "" : k)}
            className={`rounded-xl border p-3 text-right transition ${MOOD[k].soft} ${mood === k ? "ring-2 ring-violet-500" : ""}`}>
            <div className="text-2xl">{MOOD[k].emoji}</div>
            <div className="font-bold">{MOOD[k].label}</div>
            <div className="text-2xl font-black">{stats[k] ?? 0}</div>
          </button>
        ))}
        <div className="rounded-xl border p-3 bg-white">
          <div className="text-2xl">🧠</div>
          <div className="font-bold text-gray-900">المحلَّل</div>
          <div className="text-2xl font-black text-gray-900">{stats.total ?? 0}</div>
          {pending.total > 0 && <div className="text-xs text-amber-800 mt-1">بانتظار التحليل: {pending.total} (يعمل تلقائياً كل 10 دقائق)</div>}
        </div>
      </div>

      {/* فلاتر */}
      <Card>
        <CardContent className="pt-4 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-gray-500" />
            <Input placeholder="بحث بالاسم أو الرقم أو السبب…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <select className="border rounded-md px-3 py-2 text-sm bg-white" value={channel} onChange={(e) => setChannel(e.target.value)}>
            <option value="">كل القنوات</option>
            <option value="whatsapp_chat">💬 محادثة واتساب</option>
            <option value="whatsapp_call">📞 مكالمة واتساب</option>
            <option value="cellular_call">📱 مكالمة رصيد</option>
            <option value="call">📞 مكالمة (غير محدد النوع)</option>
          </select>
          <select className="border rounded-md px-3 py-2 text-sm bg-white" value={mood} onChange={(e) => setMood(e.target.value)}>
            <option value="">كل الحالات</option>
            <option value="happy">😊 فرحان</option>
            <option value="neutral">😐 عادي</option>
            <option value="annoyed">😒 ضايج</option>
            <option value="angry">😡 منزعج</option>
          </select>
          <Input type="date" className="w-[150px]" value={from} onChange={(e) => setFrom(e.target.value)} />
          <span className="text-gray-500 text-sm">إلى</span>
          <Input type="date" className="w-[150px]" value={to} onChange={(e) => setTo(e.target.value)} />
          <Button variant="outline" size="sm" onClick={() => { setFrom(today()); setTo(today()); }}>اليوم</Button>
          <Button variant="outline" size="sm" onClick={() => { setFrom(daysAgo(1)); setTo(daysAgo(1)); }}>أمس</Button>
          <Button variant="outline" size="sm" onClick={() => { setFrom(daysAgo(7)); setTo(today()); }}>7 أيام</Button>
          <Button variant="ghost" size="sm" onClick={() => { setFrom(""); setTo(""); setMood(""); setChannel(""); setQ(""); }}>مسح</Button>
          <div className="mr-auto flex rounded-md border overflow-hidden">
            <button className={`px-3 py-1.5 text-sm ${view === "people" ? "bg-violet-600 text-white" : "bg-white text-gray-700"}`} onClick={() => setView("people")}>👤 حسب الشخص</button>
            <button className={`px-3 py-1.5 text-sm ${view === "all" ? "bg-violet-600 text-white" : "bg-white text-gray-700"}`} onClick={() => setView("all")}>📋 كل التحليلات</button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">{view === "people" ? `الأشخاص (${people.length})` : `التحليلات (${rows.length})`}</CardTitle></CardHeader>
        <CardContent>
          {listQ.isLoading ? <div className="py-10 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-violet-600" /></div>
            : rows.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Sparkles className="w-14 h-14 mx-auto mb-3 opacity-40" />
                <p>لا توجد تحليلات بعد.</p>
                <p className="text-sm mt-1">{pending.total ? "اضغط «تحليل الجديد الآن» أو انتظر التشغيل التلقائي." : "ستظهر هنا نتائج تحليل المكالمات المسجّلة ومحادثات واتساب تلقائياً."}</p>
              </div>
            ) : view === "people" ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {people.map((p) => {
                  const m = moodOf(p.latest?.mood);
                  return (
                    <div key={p.key} className={`rounded-xl border p-3 space-y-2 ${m.soft}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-bold text-base truncate flex items-center gap-1"><User className="w-4 h-4 opacity-60" /> {p.name || "زبون غير معروف"}</div>
                          <div dir="ltr" className="font-mono text-sm opacity-80 text-right flex items-center gap-1 justify-end"><Phone className="w-3.5 h-3.5" /> {showPhone(p.phone) || "بلا رقم"}</div>
                        </div>
                        <Badge className={m.cls + " border-0 text-sm"}>{m.emoji} {m.label}</Badge>
                      </div>
                      <div className="text-sm"><span className="font-semibold">السبب:</span> {p.latest?.reason || "—"}</div>
                      {p.latest?.wants && <div className="text-sm"><span className="font-semibold">يريد:</span> {p.latest.wants}</div>}
                      <div className="flex items-center gap-1 flex-wrap">
                        {Array.from(p.channels as Set<string>).map((c) => <Badge key={c} className={chOf(c).cls + " border-0"}>{chOf(c).emoji} {chOf(c).label}</Badge>)}
                        <span className="text-[11px] opacity-70 mr-auto">{p.items.length} تواصل · آخره {dt(p.latest?.sourceAt)}</span>
                      </div>
                      <div className="flex flex-wrap gap-1 pt-1">
                        {p.items.slice(0, 6).map((it: any) => (
                          <Button key={it.refKey} size="sm" variant="outline" className="h-7 text-xs gap-1 bg-white" onClick={() => setOpen(it.refKey)}>
                            {it.refType === "chat" ? <MessageSquare className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />} {moodOf(it.mood).emoji} {chOf(it.channel).label} · {dt(it.sourceAt)}
                          </Button>
                        ))}
                        {p.items.length > 6 && <span className="text-xs opacity-70 self-center">+{p.items.length - 6}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>الشخص</TableHead>
                      <TableHead>الرقم</TableHead>
                      <TableHead>الحالة</TableHead>
                      <TableHead>السبب</TableHead>
                      <TableHead>ماذا يريد</TableHead>
                      <TableHead>القناة</TableHead>
                      <TableHead>الوقت</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow key={r.refKey}>
                        <TableCell className="font-medium">{r.name || "—"}</TableCell>
                        <TableCell dir="ltr" className="font-mono text-sm">{showPhone(r.phone) || "—"}</TableCell>
                        <TableCell><Badge className={moodOf(r.mood).cls + " border-0"}>{moodOf(r.mood).emoji} {moodOf(r.mood).label}</Badge></TableCell>
                        <TableCell className="max-w-[320px]"><span className="line-clamp-2 text-sm">{r.reason || "—"}</span></TableCell>
                        <TableCell className="max-w-[220px]"><span className="line-clamp-2 text-sm">{r.wants || "—"}</span></TableCell>
                        <TableCell><Badge className={chOf(r.channel).cls + " border-0"}>{chOf(r.channel).emoji} {chOf(r.channel).label}</Badge></TableCell>
                        <TableCell className="text-sm text-gray-600 whitespace-nowrap">{dt(r.sourceAt)}</TableCell>
                        <TableCell>
                          <Button size="sm" variant="outline" className="gap-1" onClick={() => setOpen(r.refKey)}>
                            {r.refType === "chat" ? <MessageSquare className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />} عرض
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
        </CardContent>
      </Card>

      <DetailDialog refKey={open} onClose={() => setOpen(null)} />
    </div>
  );
}
