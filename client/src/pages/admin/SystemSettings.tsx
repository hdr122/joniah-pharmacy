import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Settings, Clock, Save, Database } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function SystemSettings() {
  const [dayStartHour, setDayStartHour] = useState<number>(5);
  const [isSaving, setIsSaving] = useState(false);
  
  const utils = trpc.useUtils();
  
  const { data: currentSettings, isLoading } = trpc.settings.getAll.useQuery();
  const updateSettingMutation = trpc.settings.update.useMutation({
    onSuccess: () => {
      utils.settings.getAll.invalidate();
      toast.success("تم حفظ الإعدادات", {
        description: "تم تحديث إعدادات النظام بنجاح",
      });
    },
    onError: (error) => {
      toast.error("خطأ في حفظ الإعدادات", {
        description: error.message,
      });
    },
  });
  
  useEffect(() => {
    if (currentSettings) {
      const daySetting = currentSettings.find((s: any) => s.key === 'day_start_hour');
      if (daySetting) {
        setDayStartHour(parseInt(daySetting.value));
      }
    }
  }, [currentSettings]);
  
  const handleSave = async () => {
    if (dayStartHour < 0 || dayStartHour > 23) {
      toast.error("قيمة غير صحيحة", {
        description: "يجب أن تكون الساعة بين 0 و 23",
      });
      return;
    }
    
    setIsSaving(true);
    try {
      await updateSettingMutation.mutateAsync({
        key: 'day_start_hour',
        value: dayStartHour.toString(),
      });
    } finally {
      setIsSaving(false);
    }
  };
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }
  
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">إعدادات النظام</h1>
        <p className="text-gray-600 mt-2">إدارة إعدادات النظام العامة</p>
      </div>

      {/* Day Start Hour Setting */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-emerald-600" />
            وقت بدء اليوم الجديد
          </CardTitle>
          <CardDescription>
            حدد الساعة التي يبدأ فيها اليوم الجديد في النظام (0-23)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Database className="w-4 h-4" />
            <AlertDescription>
              <strong>ملاحظة مهمة:</strong> تغيير وقت بدء اليوم سيؤثر على جميع الإحصائيات والتقارير اليومية.
              يتم حساب "اليوم" من الساعة المحددة حتى نفس الساعة في اليوم التالي.
              <br />
              <strong>القيمة الحالية:</strong> {dayStartHour}:00 (الساعة {dayStartHour} صباحاً)
            </AlertDescription>
          </Alert>
          
          <div className="space-y-2">
            <Label htmlFor="dayStartHour">ساعة بدء اليوم الجديد</Label>
            <div className="flex gap-4 items-center">
              <Input
                id="dayStartHour"
                type="number"
                min={0}
                max={23}
                value={dayStartHour}
                onChange={(e) => setDayStartHour(parseInt(e.target.value) || 0)}
                className="max-w-xs"
              />
              <span className="text-sm text-gray-600">
                (من 0 إلى 23)
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              مثال: إذا اخترت 5، سيبدأ اليوم الجديد من الساعة 5:00 صباحاً
            </p>
          </div>
          
          <div className="flex gap-2">
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="bg-emerald-600 hover:bg-emerald-700 gap-2"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  جاري الحفظ...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  حفظ الإعدادات
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Backup Settings Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5 text-emerald-600" />
            النسخ الاحتياطي التلقائي
          </CardTitle>
          <CardDescription>
            معلومات حول النسخ الاحتياطي التلقائي للبيانات
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <Database className="w-4 h-4" />
            <AlertDescription>
              <strong>النسخ الاحتياطي التلقائي:</strong> يتم إنشاء نسخة احتياطية من البيانات تلقائياً كل 24 ساعة.
              <br />
              <strong>المحتوى:</strong> جميع الطلبات، الإحصائيات اليومية، سجل النشاطات، والمواقع.
              <br />
              <strong>التخزين:</strong> يتم حفظ النسخ الاحتياطية في GitHub تلقائياً.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}
