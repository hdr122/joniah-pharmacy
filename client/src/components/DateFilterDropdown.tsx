import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Calendar, ChevronDown } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export interface DateFilterValue {
  type: 'today' | 'yesterday' | 'thisWeek' | 'thisMonth' | 'custom';
  startDate?: string;
  endDate?: string;
  label: string;
}

interface DateFilterDropdownProps {
  value: DateFilterValue;
  onChange: (value: DateFilterValue) => void;
}

// ثوابت بداية ونهاية اليوم - الساعة 5 فجراً
const DAY_START_HOUR = 5;
const DAY_END_HOUR = 4;
const DAY_END_MINUTE = 59;

export function DateFilterDropdown({ value, onChange }: DateFilterDropdownProps) {
  const [customDialogOpen, setCustomDialogOpen] = useState(false);
  const [customStartDate, setCustomStartDate] = useState("");
  const [customStartTime, setCustomStartTime] = useState("05:00");
  const [customEndDate, setCustomEndDate] = useState("");
  const [customEndTime, setCustomEndTime] = useState("04:59");

  // الحصول على حدود اليوم الحالي (من 5 فجراً إلى 4:59 فجراً اليوم التالي)
  const getTodayBounds = () => {
    const now = new Date();
    const start = new Date(now);
    
    // إذا كان الوقت الحالي قبل 5 فجراً، فاليوم يبدأ من أمس الساعة 5 فجراً
    if (now.getHours() < DAY_START_HOUR) {
      start.setDate(start.getDate() - 1);
    }
    start.setHours(DAY_START_HOUR, 0, 0, 0);
    
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    end.setHours(DAY_END_HOUR, DAY_END_MINUTE, 59, 999);
    
    return { start, end };
  };

  // الحصول على حدود يوم أمس
  const getYesterdayBounds = () => {
    const now = new Date();
    const start = new Date(now);
    
    // إذا كان الوقت الحالي قبل 5 فجراً، فأمس يبدأ من قبل أمس
    if (now.getHours() < DAY_START_HOUR) {
      start.setDate(start.getDate() - 2);
    } else {
      start.setDate(start.getDate() - 1);
    }
    start.setHours(DAY_START_HOUR, 0, 0, 0);
    
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    end.setHours(DAY_END_HOUR, DAY_END_MINUTE, 59, 999);
    
    return { start, end };
  };

  // الحصول على حدود هذا الأسبوع
  const getThisWeekBounds = () => {
    const now = new Date();
    const start = new Date(now);
    
    // إذا كان الوقت الحالي قبل 5 فجراً، نعتبر أننا في اليوم السابق
    if (now.getHours() < DAY_START_HOUR) {
      start.setDate(start.getDate() - 1);
    }
    
    const dayOfWeek = start.getDay();
    const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Monday = 0
    start.setDate(start.getDate() - diff);
    start.setHours(DAY_START_HOUR, 0, 0, 0);
    
    const end = new Date(now);
    if (now.getHours() < DAY_START_HOUR) {
      end.setHours(DAY_END_HOUR, DAY_END_MINUTE, 59, 999);
    } else {
      end.setDate(end.getDate() + 1);
      end.setHours(DAY_END_HOUR, DAY_END_MINUTE, 59, 999);
    }
    
    return { start, end };
  };

  // الحصول على حدود هذا الشهر
  const getThisMonthBounds = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    start.setHours(DAY_START_HOUR, 0, 0, 0);
    
    const end = new Date(now);
    if (now.getHours() < DAY_START_HOUR) {
      end.setHours(DAY_END_HOUR, DAY_END_MINUTE, 59, 999);
    } else {
      end.setDate(end.getDate() + 1);
      end.setHours(DAY_END_HOUR, DAY_END_MINUTE, 59, 999);
    }
    
    return { start, end };
  };

  const handleQuickFilter = (type: 'today' | 'yesterday' | 'thisWeek' | 'thisMonth') => {
    let bounds;
    let label;
    
    switch (type) {
      case 'today':
        bounds = getTodayBounds();
        label = 'اليوم';
        break;
      case 'yesterday':
        bounds = getYesterdayBounds();
        label = 'أمس';
        break;
      case 'thisWeek':
        bounds = getThisWeekBounds();
        label = 'هذا الأسبوع';
        break;
      case 'thisMonth':
        bounds = getThisMonthBounds();
        label = 'هذا الشهر';
        break;
    }
    
    onChange({
      type,
      startDate: bounds.start.toISOString(),
      endDate: bounds.end.toISOString(),
      label
    });
  };

  const handleCustomFilter = () => {
    if (!customStartDate || !customEndDate) {
      return;
    }
    
    const [startHour, startMinute] = customStartTime.split(':').map(Number);
    const [endHour, endMinute] = customEndTime.split(':').map(Number);
    
    const start = new Date(customStartDate);
    start.setHours(startHour, startMinute, 0, 0);
    
    let end = new Date(customEndDate);
    
    // إذا كان نفس التاريخ، نضيف يوم واحد للنهاية ليشمل اليوم كاملاً
    const isSameDay = customStartDate === customEndDate;
    if (isSameDay) {
      end = new Date(customEndDate);
      end.setDate(end.getDate() + 1);
      end.setHours(DAY_END_HOUR, DAY_END_MINUTE, 59, 999);
    } else {
      end.setHours(endHour, endMinute, 59, 999);
    }
    
    // تنسيق التاريخ للعرض
    const formatDate = (date: Date) => {
      return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
    };
    
    const label = isSameDay 
      ? formatDate(start)
      : `${formatDate(start)} - ${formatDate(new Date(customEndDate))}`;
    
    onChange({
      type: 'custom',
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      label
    });
    
    setCustomDialogOpen(false);
  };

  // عند اختيار نفس التاريخ من/إلى، نضبط الوقت تلقائياً ليشمل اليوم كاملاً
  const handleSameDaySelection = () => {
    if (customStartDate && customEndDate && customStartDate === customEndDate) {
      setCustomStartTime("05:00");
      setCustomEndTime("04:59");
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="gap-2 min-w-[180px] justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <span>{value.label}</span>
            </div>
            <ChevronDown className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel>فلتر التاريخ</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => handleQuickFilter('today')}>
            اليوم (5 ص - 5 ص)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleQuickFilter('yesterday')}>
            أمس
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleQuickFilter('thisWeek')}>
            هذا الأسبوع
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleQuickFilter('thisMonth')}>
            هذا الشهر
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setCustomDialogOpen(true)}>
            فترة مخصصة...
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={customDialogOpen} onOpenChange={setCustomDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>فلتر تاريخ مخصص</DialogTitle>
            <DialogDescription>
              اختر الفترة الزمنية المطلوبة (اليوم يبدأ من الساعة 5 فجراً)
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>من تاريخ</Label>
                <Input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => {
                    setCustomStartDate(e.target.value);
                    // إذا تم اختيار نفس التاريخ، نضبط الوقت تلقائياً
                    if (e.target.value === customEndDate) {
                      setCustomStartTime("05:00");
                      setCustomEndTime("04:59");
                    }
                  }}
                  className="mt-2"
                />
              </div>
              <div>
                <Label>الوقت</Label>
                <Input
                  type="time"
                  value={customStartTime}
                  onChange={(e) => setCustomStartTime(e.target.value)}
                  className="mt-2"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>إلى تاريخ</Label>
                <Input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => {
                    setCustomEndDate(e.target.value);
                    // إذا تم اختيار نفس التاريخ، نضبط الوقت ليشمل اليوم كاملاً
                    if (e.target.value === customStartDate) {
                      setCustomStartTime("05:00");
                      setCustomEndTime("04:59");
                    }
                  }}
                  className="mt-2"
                />
              </div>
              <div>
                <Label>الوقت</Label>
                <Input
                  type="time"
                  value={customEndTime}
                  onChange={(e) => setCustomEndTime(e.target.value)}
                  className="mt-2"
                />
              </div>
            </div>
            
            <p className="text-sm text-muted-foreground">
              ملاحظة: عند اختيار يوم واحد، سيتم تحديد الفترة من 5:00 ص إلى 4:59 ص اليوم التالي تلقائياً
            </p>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setCustomDialogOpen(false)}>
              إلغاء
            </Button>
            <Button onClick={handleCustomFilter}>
              تطبيق
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
