import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ArrowRight, Bell, Volume2 } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";

export default function NotificationSettings() {
  const [, setLocation] = useLocation();
  const [notificationSound, setNotificationSound] = useState(() => {
    return localStorage.getItem("notificationSound") !== "false";
  });

  const toggleNotificationSound = () => {
    const newValue = !notificationSound;
    setNotificationSound(newValue);
    localStorage.setItem("notificationSound", newValue.toString());
    toast.success(newValue ? "تم تفعيل صوت التنبيه" : "تم إيقاف صوت التنبيه");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation("/delivery")}
              className="rounded-full"
            >
              <ArrowRight className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">إعدادات الإشعارات</h1>
              <p className="text-sm text-gray-600">تخصيص تفضيلات الإشعارات</p>
            </div>
          </div>
        </div>

        {/* Settings Cards */}
        <div className="space-y-4">
          {/* Sound Settings */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Volume2 className="w-5 h-5 text-emerald-600" />
                <CardTitle>صوت التنبيه</CardTitle>
              </div>
              <CardDescription>
                تشغيل صوت عند وصول إشعار جديد
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <Label htmlFor="sound-toggle" className="text-base">
                  تفعيل صوت التنبيه
                </Label>
                <Switch
                  id="sound-toggle"
                  checked={notificationSound}
                  onCheckedChange={toggleNotificationSound}
                />
              </div>
            </CardContent>
          </Card>

          {/* Notification Types */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-emerald-600" />
                <CardTitle>أنواع الإشعارات</CardTitle>
              </div>
              <CardDescription>
                اختر أنواع الإشعارات التي تريد استلامها
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="new-order" className="text-base">طلبات جديدة</Label>
                  <p className="text-sm text-gray-500">إشعار عند تعيين طلب جديد لك</p>
                </div>
                <Switch id="new-order" checked disabled />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="messages" className="text-base">رسائل من المدير</Label>
                  <p className="text-sm text-gray-500">إشعار عند استلام رسالة من المدير</p>
                </div>
                <Switch id="messages" checked disabled />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="order-updates" className="text-base">تحديثات الطلبات</Label>
                  <p className="text-sm text-gray-500">إشعار عند قبول أو رفض طلب</p>
                </div>
                <Switch id="order-updates" checked disabled />
              </div>

              <p className="text-xs text-gray-500 mt-4">
                ملاحظة: جميع أنواع الإشعارات مفعلة افتراضياً لضمان عدم تفويت أي تحديث مهم
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
