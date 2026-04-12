import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar, X, Filter } from "lucide-react";

export type DateFilterType = "simple" | "range";

export interface SimpleDateFilter {
  year: number;
  month: number | null;
  day: number | null;
}

export interface RangeDateFilter {
  startDate: string; // ISO format with time
  endDate: string; // ISO format with time
}

export interface DateFilterValue {
  type: DateFilterType;
  simple?: SimpleDateFilter;
  range?: RangeDateFilter;
}

interface AdvancedDateFilterProps {
  value: DateFilterValue | null;
  onChange: (value: DateFilterValue | null) => void;
  showQuickFilters?: boolean;
  storageKey?: string;
}

export function AdvancedDateFilter({
  value,
  onChange,
  showQuickFilters = true,
  storageKey,
}: AdvancedDateFilterProps) {
  const [filterType, setFilterType] = useState<DateFilterType>("simple");
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [month, setMonth] = useState<number | null>(null);
  const [day, setDay] = useState<number | null>(null);
  const [startDate, setStartDate] = useState<string>("");
  const [startTime, setStartTime] = useState<string>("00:00");
  const [endDate, setEndDate] = useState<string>("");
  const [endTime, setEndTime] = useState<string>("23:59");

  // تحميل من localStorage عند البداية
  useEffect(() => {
    if (storageKey) {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          onChange(parsed);
          if (parsed.type === "simple" && parsed.simple) {
            setFilterType("simple");
            setYear(parsed.simple.year);
            setMonth(parsed.simple.month);
            setDay(parsed.simple.day);
          } else if (parsed.type === "range" && parsed.range) {
            setFilterType("range");
            const start = new Date(parsed.range.startDate);
            const end = new Date(parsed.range.endDate);
            setStartDate(start.toISOString().split("T")[0]);
            setStartTime(
              `${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}`
            );
            setEndDate(end.toISOString().split("T")[0]);
            setEndTime(
              `${String(end.getHours()).padStart(2, "0")}:${String(end.getMinutes()).padStart(2, "0")}`
            );
          }
        } catch (e) {
          console.error("Failed to load filter from localStorage:", e);
        }
      }
    }
  }, [storageKey]);

  // حفظ في localStorage عند التغيير
  useEffect(() => {
    if (storageKey && value) {
      localStorage.setItem(storageKey, JSON.stringify(value));
    }
  }, [value, storageKey]);

  const handleApplySimple = () => {
    const filter: DateFilterValue = {
      type: "simple",
      simple: { year, month, day },
    };
    onChange(filter);
  };

  const handleApplyRange = () => {
    if (!startDate || !endDate) {
      alert("يرجى اختيار تاريخ البداية والنهاية");
      return;
    }

    const start = new Date(`${startDate}T${startTime}`);
    const end = new Date(`${endDate}T${endTime}`);

    if (start > end) {
      alert("تاريخ البداية يجب أن يكون قبل تاريخ النهاية");
      return;
    }

    const filter: DateFilterValue = {
      type: "range",
      range: {
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      },
    };
    onChange(filter);
  };

  const handleClear = () => {
    onChange(null);
    setMonth(null);
    setDay(null);
    setStartDate("");
    setEndDate("");
    if (storageKey) {
      localStorage.removeItem(storageKey);
    }
  };

  const handleQuickFilter = (type: "today" | "yesterday" | "thisWeek" | "thisMonth") => {
    const now = new Date();
    const baghdadOffset = 3 * 60; // +3 hours in minutes
    const localOffset = now.getTimezoneOffset();
    const offsetDiff = baghdadOffset - localOffset;

    const adjustToBaghdad = (date: Date) => {
      return new Date(date.getTime() + offsetDiff * 60 * 1000);
    };

    let start: Date;
    let end: Date;

    switch (type) {
      case "today":
        // اليوم يبدأ من الساعة 8 صباحاً اليوم وينتهي الساعة 8 صباحاً اليوم التالي
        const todayStart = new Date();
        todayStart.setHours(8, 0, 0, 0);
        start = adjustToBaghdad(todayStart);
        
        const todayEnd = new Date();
        todayEnd.setDate(todayEnd.getDate() + 1);
        todayEnd.setHours(8, 0, 0, 0);
        end = adjustToBaghdad(todayEnd);
        break;
      case "yesterday":
        const yesterdayStart = new Date();
        yesterdayStart.setDate(yesterdayStart.getDate() - 1);
        yesterdayStart.setHours(8, 0, 0, 0);
        start = adjustToBaghdad(yesterdayStart);
        
        const yesterdayEnd = new Date();
        yesterdayEnd.setDate(yesterdayEnd.getDate() - 1);
        yesterdayEnd.setHours(23, 59, 59, 999);
        end = adjustToBaghdad(yesterdayEnd);
        break;
      case "thisWeek":
        const weekStartDate = new Date();
        const dayOfWeek = weekStartDate.getDay();
        weekStartDate.setDate(weekStartDate.getDate() - dayOfWeek);
        weekStartDate.setHours(8, 0, 0, 0);
        start = adjustToBaghdad(weekStartDate);
        
        const weekEndDate = new Date();
        end = adjustToBaghdad(weekEndDate);
        break;
      case "thisMonth":
        start = adjustToBaghdad(new Date(now.getFullYear(), now.getMonth(), 1, 8, 0, 0, 0));
        end = adjustToBaghdad(new Date());
        break;
      default:
        return;
    }

    const filter: DateFilterValue = {
      type: "range",
      range: {
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      },
    };
    onChange(filter);
  };

  // توليد قائمة السنوات (من 2020 إلى السنة الحالية + 1)
  const years = Array.from(
    { length: new Date().getFullYear() - 2019 + 2 },
    (_, i) => 2020 + i
  );

  // توليد قائمة الأشهر
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  // توليد قائمة الأيام (حسب الشهر والسنة)
  const getDaysInMonth = (year: number, month: number | null) => {
    if (!month) return 31;
    return new Date(year, month, 0).getDate();
  };

  const days = Array.from({ length: getDaysInMonth(year, month) }, (_, i) => i + 1);

  return (
    <Card className="p-4 bg-card">
      <div className="space-y-4">
        {/* عنوان الفلتر */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-foreground">فلتر التاريخ</h3>
          </div>
          {value && (
            <Button variant="ghost" size="sm" onClick={handleClear}>
              <X className="h-4 w-4 ml-1" />
              مسح الفلتر
            </Button>
          )}
        </div>

        {/* أزرار الفلاتر السريعة */}
        {showQuickFilters && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleQuickFilter("today")}
            >
              اليوم
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleQuickFilter("yesterday")}
            >
              أمس
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleQuickFilter("thisWeek")}
            >
              هذا الأسبوع
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleQuickFilter("thisMonth")}
            >
              هذا الشهر
            </Button>
          </div>
        )}

        {/* اختيار نوع الفلتر */}
        <div className="flex gap-2">
          <Button
            variant={filterType === "simple" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterType("simple")}
            className="flex-1"
          >
            فلتر بسيط
          </Button>
          <Button
            variant={filterType === "range" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterType("range")}
            className="flex-1"
          >
            نطاق تاريخ
          </Button>
        </div>

        {/* فلتر بسيط */}
        {filterType === "simple" && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {/* السنة */}
              <div>
                <Label className="text-sm text-muted-foreground">السنة</Label>
                <Select
                  value={String(year)}
                  onValueChange={(v) => setYear(Number(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((y) => (
                      <SelectItem key={y} value={String(y)}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* الشهر */}
              <div>
                <Label className="text-sm text-muted-foreground">الشهر</Label>
                <Select
                  value={month ? String(month) : "all"}
                  onValueChange={(v) => {
                    setMonth(v === "all" ? null : Number(v));
                    setDay(null);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="الكل" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">الكل</SelectItem>
                    {months.map((m) => (
                      <SelectItem key={m} value={String(m)}>
                        شهر {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* اليوم */}
              <div>
                <Label className="text-sm text-muted-foreground">اليوم</Label>
                <Select
                  value={day ? String(day) : "all"}
                  onValueChange={(v) => setDay(v === "all" ? null : Number(v))}
                  disabled={!month}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="الكل" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">الكل</SelectItem>
                    {days.map((d) => (
                      <SelectItem key={d} value={String(d)}>
                        يوم {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button onClick={handleApplySimple} className="w-full">
              <Filter className="h-4 w-4 ml-2" />
              تطبيق الفلتر
            </Button>
          </div>
        )}

        {/* فلتر نطاق */}
        {filterType === "range" && (
          <div className="space-y-3">
            {/* من تاريخ */}
            <div>
              <Label className="text-sm text-muted-foreground">من تاريخ</Label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-3 py-2 border border-border rounded-md bg-background text-foreground"
                />
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="px-3 py-2 border border-border rounded-md bg-background text-foreground"
                />
              </div>
            </div>

            {/* إلى تاريخ */}
            <div>
              <Label className="text-sm text-muted-foreground">إلى تاريخ</Label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-3 py-2 border border-border rounded-md bg-background text-foreground"
                />
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="px-3 py-2 border border-border rounded-md bg-background text-foreground"
                />
              </div>
            </div>

            <Button onClick={handleApplyRange} className="w-full">
              <Filter className="h-4 w-4 ml-2" />
              تطبيق الفلتر
            </Button>
          </div>
        )}

        {/* عرض الفلتر الحالي */}
        {value && (
          <div className="p-3 bg-muted rounded-md text-sm text-muted-foreground">
            <strong className="text-foreground">الفلتر الحالي:</strong>{" "}
            {value.type === "simple" && value.simple && (
              <>
                سنة {value.simple.year}
                {value.simple.month && ` - شهر ${value.simple.month}`}
                {value.simple.day && ` - يوم ${value.simple.day}`}
              </>
            )}
            {value.type === "range" && value.range && (
              <>
                من {new Date(value.range.startDate).toLocaleString("ar-IQ")} إلى{" "}
                {new Date(value.range.endDate).toLocaleString("ar-IQ")}
              </>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
