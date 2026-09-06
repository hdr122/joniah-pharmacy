import { useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, MessageCircle, Send, Sparkles, RefreshCw, Search, User } from "lucide-react";
import { toast } from "sonner";

const dt = (v: any) => {
  if (!v) return "";
  try { return new Date(v).toLocaleString("ar-IQ", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }); } catch { return String(v); }
};
const showPhone = (p: string) => (p && p.startsWith("964") ? "0" + p.slice(3) : p);

export default function WhatsAppInbox() {
  const utils = trpc.useUtils();
  const convQ = trpc.whatsapp.conversations.useQuery(undefined, { refetchInterval: 5000, refetchOnWindowFocus: true });
  const statusQ = trpc.whatsapp.status.useQuery(undefined, { refetchInterval: 10000 });
  const [active, setActive] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [text, setText] = useState("");
  const msgsQ = trpc.whatsapp.messages.useQuery({ phone: active || "" }, { enabled: !!active, refetchInterval: active ? 4000 : false });
  const replyM = trpc.whatsapp.reply.useMutation({
    onSuccess: (r: any) => {
      if (r?.ok) { setText(""); utils.whatsapp.messages.invalidate(); utils.whatsapp.conversations.invalidate(); toast.success("أُرسل الرد ✓"); }
      else toast.error(r?.error || r?.skipped || "لم يُرسل");
    },
    onError: (e) => toast.error(e.message),
  });
  const sumM = trpc.whatsapp.summarize.useMutation({
    onSuccess: () => { utils.whatsapp.conversations.invalidate(); toast.success("تم تحديث الملخص"); },
    onError: (e) => toast.error(e.message),
  });
  const bottomRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgsQ.data?.length, active]);

  const conversations = (convQ.data?.conversations || []) as any[];
  const filtered = conversations.filter((c) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [c.phone, showPhone(c.phone), c.name, c.lastText, c.summary].some((v) => String(v || "").toLowerCase().includes(q));
  });
  const current = conversations.find((c) => c.phone === active);
  const connected = statusQ.data?.status === "connected";

  // لخّص تلقائياً عند فتح محادثة لم تُلخَّص أو تغيّرت
  useEffect(() => {
    if (current && (!current.summary || Number(current.summaryDirty)) && !sumM.isPending) {
      sumM.mutate({ phone: current.phone });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, current?.summaryDirty]);

  if (convQ.isLoading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2"><MessageCircle className="w-7 h-7 text-emerald-600" /> رسائل الزبائن</h1>
          <p className="text-gray-600 mt-2">كل ما يصل رقم واتساب الفرع، مع الرد من هنا وملخص ذكي لكل محادثة (Xenon AI).</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={connected ? "bg-emerald-600" : "bg-gray-400"}>{connected ? "واتساب متصل ✓" : "واتساب غير متصل"}</Badge>
          <Badge variant="outline">{convQ.data?.stats?.conversations ?? 0} محادثة</Badge>
          {(convQ.data?.stats?.unread ?? 0) > 0 && <Badge className="bg-rose-600">{convQ.data?.stats?.unread} غير مقروءة</Badge>}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" style={{ minHeight: "70vh" }}>
        {/* قائمة المحادثات */}
        <Card className="lg:col-span-1 flex flex-col">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-gray-500" />
              <Input placeholder="بحث بالرقم أو الاسم أو النص…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto space-y-1 p-2" style={{ maxHeight: "70vh" }}>
            {filtered.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-10">{connected ? "لا توجد رسائل بعد — ستظهر هنا كل رسالة تصل رقم الفرع" : "اربط واتساب الفرع أولاً من صفحة «ربط واتساب»"}</p>
            ) : filtered.map((c) => (
              <button key={c.phone} onClick={() => setActive(c.phone)}
                className={`w-full text-right rounded-lg p-3 border transition ${active === c.phone ? "bg-emerald-50 border-emerald-300" : "bg-white hover:bg-gray-50 border-gray-200"}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-gray-900 truncate flex items-center gap-1"><User className="w-3.5 h-3.5 text-gray-400" />{c.name || showPhone(c.phone)}</span>
                  {Number(c.unread) > 0 && <span className="text-[10px] bg-rose-600 text-white rounded-full px-1.5 py-0.5 font-bold">{c.unread}</span>}
                </div>
                <div className="text-xs text-gray-500 flex items-center justify-between gap-2 mt-0.5">
                  <span dir="ltr" className="font-mono">{showPhone(c.phone)}</span>
                  <span>{dt(c.lastAt)}</span>
                </div>
                <p className="text-xs text-gray-600 truncate mt-1">{c.lastText}</p>
                {c.summary && <p className="text-[11px] text-emerald-700 mt-1 line-clamp-2">🧠 {c.summary}</p>}
              </button>
            ))}
          </CardContent>
        </Card>

        {/* المحادثة + الملخص */}
        <div className="lg:col-span-2 grid grid-cols-1 xl:grid-cols-3 gap-4">
          <Card className="xl:col-span-2 flex flex-col">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center justify-between gap-2">
                <span>{current ? `${current.name || "زبون"} — ` : ""}<span dir="ltr" className="font-mono text-sm text-gray-600">{current ? showPhone(current.phone) : "اختر محادثة"}</span></span>
                {current && <Button size="sm" variant="ghost" onClick={() => utils.whatsapp.messages.invalidate()}><RefreshCw className="w-4 h-4" /></Button>}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col p-3">
              <div className="flex-1 overflow-y-auto space-y-2 bg-gray-50 rounded-lg p-3" style={{ maxHeight: "52vh", minHeight: "40vh" }}>
                {!active ? <p className="text-sm text-gray-400 text-center py-10">اختر محادثة من القائمة</p>
                  : msgsQ.isLoading ? <Loader2 className="w-6 h-6 animate-spin text-emerald-600 mx-auto" />
                  : (msgsQ.data || []).map((m: any) => (
                    <div key={m.id} className={`flex ${Number(m.fromMe) ? "justify-start" : "justify-end"}`}>
                      <div className={`max-w-[80%] rounded-2xl px-3 py-2 shadow-sm text-sm whitespace-pre-wrap ${Number(m.fromMe) ? "bg-emerald-100 text-emerald-900" : "bg-white text-gray-900 border"}`}>
                        {!Number(m.fromMe) && m.pushName && <div className="text-[10px] font-bold text-gray-500 mb-0.5">{m.pushName}</div>}
                        {m.text}
                        <div className="text-[10px] opacity-60 mt-1 text-left" dir="ltr">{dt(m.createdAt)}</div>
                      </div>
                    </div>
                  ))}
                <div ref={bottomRef} />
              </div>
              {active && (
                <div className="flex gap-2 mt-3">
                  <Input placeholder={connected ? "اكتب ردّك…" : "واتساب غير متصل"} value={text} disabled={!connected}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && text.trim()) { e.preventDefault(); replyM.mutate({ phone: active, text: text.trim() }); } }} />
                  <Button className="bg-emerald-600 hover:bg-emerald-700" disabled={!connected || replyM.isPending || !text.trim()}
                    onClick={() => replyM.mutate({ phone: active, text: text.trim() })}>
                    {replyM.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="xl:col-span-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5"><Sparkles className="w-4 h-4 text-violet-600" /> ملخص Xenon AI</span>
                {current && (
                  <Button size="sm" variant="outline" disabled={sumM.isPending} onClick={() => sumM.mutate({ phone: current.phone, force: true })}>
                    {sumM.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "تحديث"}
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!current ? <p className="text-sm text-gray-400">اختر محادثة لعرض ملخصها</p>
                : sumM.isPending && !current.summary ? <p className="text-sm text-gray-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> جارٍ التلخيص…</p>
                : current.summary ? (
                  <div>
                    <pre className="whitespace-pre-wrap text-sm font-sans text-violet-950 bg-violet-50 border border-violet-200 rounded-lg p-3" dir="rtl">{current.summary}</pre>
                    <p className="text-[11px] text-gray-400 mt-2">آخر تلخيص: {dt(current.summaryAt)}{Number(current.summaryDirty) ? " — وصلت رسائل جديدة" : ""}</p>
                  </div>
                ) : <p className="text-sm text-gray-500">لا يوجد ملخص بعد — اضغط «تحديث». يتطلب تفعيل Xenon AI للفرع من لوحة المطوّر.</p>}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
