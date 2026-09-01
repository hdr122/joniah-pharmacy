import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Loader2,
  Phone,
  Search,
  MessageSquare,
  MapPin,
  User,
  Package,
  Calendar,
} from "lucide-react";

interface CallRecording {
  id: number;
  branchId: number;
  phone: string | null;
  callerName: string | null;
  customerName: string | null;
  area: string | null;
  address: string | null;
  items: string | null;
  notes: string | null;
  transcript: string | null;
  source: string | null;
  createdAt: string;
}

function formatDate(value: string | null) {
  if (!value) return "غير محدد";
  try {
    return new Date(value).toLocaleString("ar-IQ", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

// عرض نص المكالمة كحوار بأسطر ملوّنة حسب المتحدث (كاشير / زبون)
function TranscriptView({ transcript }: { transcript: string | null }) {
  if (!transcript || !transcript.trim()) {
    return (
      <div className="text-center py-10 text-gray-500">
        <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>لا يوجد نص لهذه المكالمة</p>
      </div>
    );
  }

  const lines = transcript
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  return (
    <div className="space-y-2">
      {lines.map((line, idx) => {
        const isCashier = line.startsWith("كاشير:");
        const isCustomer = line.startsWith("زبون:");
        const speaker = isCashier ? "كاشير" : isCustomer ? "زبون" : null;
        const content = speaker ? line.slice(line.indexOf(":") + 1).trim() : line;

        return (
          <div
            key={idx}
            className={`flex ${
              isCashier ? "justify-start" : isCustomer ? "justify-end" : "justify-center"
            }`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2 shadow-sm ${
                isCashier
                  ? "bg-violet-100 text-violet-900"
                  : isCustomer
                  ? "bg-emerald-100 text-emerald-900"
                  : "bg-gray-100 text-gray-700"
              }`}
            >
              {speaker && (
                <div className="text-xs font-bold opacity-70 mb-0.5">{speaker}</div>
              )}
              <div className="text-sm leading-relaxed whitespace-pre-wrap">{content}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function CallRecordings() {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<CallRecording | null>(null);

  const { data: calls, isLoading } = trpc.callRecordings.list.useQuery({ limit: 200 });

  const filtered = ((calls || []) as CallRecording[]).filter((c) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [c.phone, c.callerName, c.customerName, c.area, c.address, c.items, c.transcript]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(q));
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">المكالمات المسجّلة</h1>
          <p className="text-gray-600 mt-2">
            سجل المكالمات المحللة بالذكاء الاصطناعي القادمة من نظام المطعم
          </p>
        </div>
      </div>

      {/* Search Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="w-5 h-5 text-violet-600" />
            المكالمات
          </CardTitle>
          <CardDescription>ابحث بالاسم، رقم الهاتف، المنطقة، أو نص المكالمة</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-gray-500" />
            <Input
              placeholder="ابحث في المكالمات..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-md"
            />
          </div>
        </CardContent>
      </Card>

      {/* Results Card */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-violet-600" />
              النتائج ({filtered.length})
            </CardTitle>
            <Badge variant="outline" className="text-sm">
              {filtered.length} مكالمة
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Phone className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>لا توجد مكالمات مسجّلة</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>المتصل / الزبون</TableHead>
                    <TableHead>رقم الهاتف</TableHead>
                    <TableHead>المنطقة</TableHead>
                    <TableHead>العنوان</TableHead>
                    <TableHead>الطلبات</TableHead>
                    <TableHead>التاريخ</TableHead>
                    <TableHead>الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((call) => (
                    <TableRow key={call.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-gray-500" />
                          {call.customerName || call.callerName || "غير محدد"}
                        </div>
                      </TableCell>
                      <TableCell>
                        {call.phone ? (
                          <div className="flex items-center gap-2">
                            <Phone className="w-4 h-4 text-gray-500" />
                            {call.phone}
                          </div>
                        ) : (
                          <span className="text-gray-400">غير محدد</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {call.area ? (
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-gray-500" />
                            {call.area}
                          </div>
                        ) : (
                          <span className="text-gray-400">غير محدد</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {call.address ? (
                          <span className="truncate max-w-[200px] block">{call.address}</span>
                        ) : (
                          <span className="text-gray-400">غير محدد</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {call.items ? (
                          <div className="flex items-center gap-2">
                            <Package className="w-4 h-4 text-gray-500" />
                            <span className="truncate max-w-[200px]">{call.items}</span>
                          </div>
                        ) : (
                          <span className="text-gray-400">غير محدد</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Calendar className="w-4 h-4 text-gray-500" />
                          {formatDate(call.createdAt)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          onClick={() => setSelected(call)}
                        >
                          <MessageSquare className="w-4 h-4" />
                          عرض المكالمة
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

      {/* Transcript Dialog */}
      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-violet-600" />
              نص المكالمة
            </DialogTitle>
          </DialogHeader>

          {selected && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-2 gap-3 p-4 bg-gray-50 rounded-lg text-sm">
                <div>
                  <span className="text-gray-500">الاسم: </span>
                  <span className="font-medium">
                    {selected.customerName || selected.callerName || "غير محدد"}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">الهاتف: </span>
                  <span className="font-medium">{selected.phone || "غير محدد"}</span>
                </div>
                <div>
                  <span className="text-gray-500">المنطقة: </span>
                  <span className="font-medium">{selected.area || "غير محدد"}</span>
                </div>
                <div>
                  <span className="text-gray-500">التاريخ: </span>
                  <span className="font-medium">{formatDate(selected.createdAt)}</span>
                </div>
                {selected.address && (
                  <div className="col-span-2">
                    <span className="text-gray-500">العنوان: </span>
                    <span className="font-medium">{selected.address}</span>
                  </div>
                )}
                {selected.items && (
                  <div className="col-span-2">
                    <span className="text-gray-500">الطلبات: </span>
                    <span className="font-medium">{selected.items}</span>
                  </div>
                )}
                {selected.notes && (
                  <div className="col-span-2">
                    <span className="text-gray-500">ملاحظات: </span>
                    <span className="font-medium">{selected.notes}</span>
                  </div>
                )}
              </div>

              {/* Transcript */}
              <div className="border-t pt-4">
                <TranscriptView transcript={selected.transcript} />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
