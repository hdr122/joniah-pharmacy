import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Info, AlertTriangle, Trash2, Clock, LogOut, Code, Download, Database, Calendar, Mail, User, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";

// Backup Section Component
function BackupSection() {
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateBackup = async () => {
    setIsCreating(true);
    try {
      // Call the API directly using fetch
      const response = await fetch('/api/trpc/backup.create', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to create backup');
      }
      
      const result = await response.json();
      const backupData = result.result?.data;
      
      if (backupData) {
        // Convert to JSON and download
        const jsonString = JSON.stringify(backupData, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const date = new Date().toISOString().split('T')[0];
        link.download = `joniah-pharmacy-backup-${date}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.success('تم إنشاء النسخة الاحتياطية وتحميلها بنجاح');
      }
    } catch (error) {
      console.error('Backup error:', error);
      toast.error('فشل في إنشاء النسخة الاحتياطية');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="p-4 border border-emerald-200 rounded-lg bg-emerald-50">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="font-medium text-emerald-800 flex items-center gap-2">
            <Database className="w-4 h-4" />
            إنشاء نسخة احتياطية كاملة
          </h3>
          <p className="text-sm text-emerald-600 mt-1">
            يتم حفظ جميع البيانات في ملف JSON يمكن تحميله وحفظه في مكان آمن.
            <br />
            <strong>يتضمن:</strong> الطلبات، الزبائن، المندوبين، المناطق، الإحصائيات اليومية، وسجل النشاطات.
          </p>
        </div>
        <Button
          className="bg-emerald-600 hover:bg-emerald-700"
          onClick={handleCreateBackup}
          disabled={isCreating}
        >
          {isCreating ? (
            <>
              <Loader2 className="w-4 h-4 ml-2 animate-spin" />
              جاري الإنشاء...
            </>
          ) : (
            <>
              <Download className="w-4 h-4 ml-2" />
              إنشاء نسخة احتياطية
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

export default function About() {
  const [, setLocation] = useLocation();
  
  // Subscription countdown
  const subscriptionEndDate = new Date("2026-11-05");
  const [timeRemaining, setTimeRemaining] = useState({
    months: 0,
    days: 0,
    hours: 0,
    minutes: 0,
  });

  useEffect(() => {
    const calculateTimeRemaining = () => {
      const now = new Date();
      const diff = subscriptionEndDate.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeRemaining({ months: 0, days: 0, hours: 0, minutes: 0 });
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const months = Math.floor(days / 30);
      const remainingDays = days % 30;
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      setTimeRemaining({
        months,
        days: remainingDays,
        hours,
        minutes,
      });
    };

    calculateTimeRemaining();
    const interval = setInterval(calculateTimeRemaining, 60000);

    return () => clearInterval(interval);
  }, []);

  const totalDaysRemaining = timeRemaining.months * 30 + timeRemaining.days;
  const isExpiringSoon = totalDaysRemaining <= 30;
  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      toast.success("تم تسجيل الخروج");
      setLocation("/");
      window.location.reload();
    },
  });
  const [showResetAllDialog, setShowResetAllDialog] = useState(false);
  const [showResetTimeDialog, setShowResetTimeDialog] = useState(false);
  const [secretCode, setSecretCode] = useState("");

  // Reset all data mutation
  const resetAllMutation = trpc.dataReset.resetAll.useMutation({
    onSuccess: () => {
      toast.success("تم إعادة تعيين جميع البيانات بنجاح");
      setShowResetAllDialog(false);
      setSecretCode("");
    },
    onError: (error) => {
      toast.error(error.message || "فشل في إعادة تعيين البيانات");
    },
  });

  // Reset delivery time data mutation
  const resetTimeMutation = trpc.dataReset.resetDeliveryTime.useMutation({
    onSuccess: () => {
      toast.success("تم إعادة تعيين بيانات وقت المندوبين بنجاح");
      setShowResetTimeDialog(false);
      setSecretCode("");
    },
    onError: (error) => {
      toast.error(error.message || "فشل في إعادة تعيين البيانات");
    },
  });

  const handleResetAll = () => {
    resetAllMutation.mutate({ secretCode });
  };

  const handleResetTime = () => {
    resetTimeMutation.mutate({ secretCode });
  };

  const handleRestoreDefaults = () => {
    // Clear all cookies
    document.cookie.split(";").forEach((c) => {
      document.cookie = c
        .replace(/^ +/, "")
        .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
    });
    
    // Clear local storage
    localStorage.clear();
    
    // Clear session storage
    sessionStorage.clear();
    
    toast.success("تم استعادة الإعدادات الافتراضية وتسجيل الخروج");
    
    // Logout and redirect
    setTimeout(() => {
      logoutMutation.mutate();
    }, 1000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">حول التطبيق</h1>
        <p className="text-gray-600 mt-2">معلومات التطبيق وأدوات الإدارة</p>
      </div>

      {/* Subscription Status */}
      <Card className="border-2 border-emerald-200 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-emerald-50 to-teal-50">
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl flex items-center gap-2">
              <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              حالة الاشتراك
            </CardTitle>
            <div className="px-3 py-1 bg-emerald-600 text-white rounded-full text-sm font-bold">نشط</div>
          </div>
          <CardDescription>معلومات اشتراكك الحالي</CardDescription>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          {/* Expiry Date */}
          <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
            <Calendar className="w-8 h-8 text-emerald-600" />
            <div>
              <p className="text-sm text-gray-600">تاريخ انتهاء الاشتراك</p>
              <p className="text-2xl font-bold text-gray-900">2026/11/05</p>
            </div>
          </div>

          {/* Countdown Timer */}
          <div className="bg-gradient-to-br from-emerald-50 to-teal-50 p-6 rounded-xl border-2 border-emerald-200">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-5 h-5 text-emerald-600" />
              <h3 className="text-lg font-bold text-emerald-800">الوقت المتبقي</h3>
            </div>
            <div className="grid grid-cols-4 gap-4">
              <div className="text-center p-4 bg-white rounded-lg shadow">
                <p className="text-3xl font-bold text-emerald-600">{timeRemaining.months}</p>
                <p className="text-sm text-gray-600 mt-1">شهر</p>
              </div>
              <div className="text-center p-4 bg-white rounded-lg shadow">
                <p className="text-3xl font-bold text-emerald-600">{timeRemaining.days}</p>
                <p className="text-sm text-gray-600 mt-1">يوم</p>
              </div>
              <div className="text-center p-4 bg-white rounded-lg shadow">
                <p className="text-3xl font-bold text-emerald-600">{timeRemaining.hours}</p>
                <p className="text-sm text-gray-600 mt-1">ساعة</p>
              </div>
              <div className="text-center p-4 bg-white rounded-lg shadow">
                <p className="text-3xl font-bold text-emerald-600">{timeRemaining.minutes}</p>
                <p className="text-sm text-gray-600 mt-1">دقيقة</p>
              </div>
            </div>
          </div>

          {/* Warning if expiring soon */}
          {isExpiringSoon && (
            <Alert variant="destructive" className="border-2">
              <AlertTriangle className="h-5 w-5" />
              <AlertTitle className="text-lg font-bold">تنبيه: اقتراب انتهاء الاشتراك</AlertTitle>
              <AlertDescription className="text-base">
                سينتهي اشتراكك خلال {totalDaysRemaining} يوم. يرجى الاتصال بالمطور لتجديد الاشتراك.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Developer Information */}
      <Card className="border-2 border-blue-200 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-cyan-50">
          <CardTitle className="text-2xl flex items-center gap-2">
            <User className="w-6 h-6 text-blue-600" />
            معلومات المطور
          </CardTitle>
          <CardDescription>للدعم الفني وتجديد الاشتراك</CardDescription>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
              <User className="w-6 h-6 text-blue-600" />
              <div>
                <p className="text-sm text-gray-600">الاسم</p>
                <p className="text-lg font-bold text-gray-900">حارث</p>
              </div>
            </div>

            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
              <User className="w-6 h-6 text-blue-600" />
              <div>
                <p className="text-sm text-gray-600">اسم المستخدم الرسمي</p>
                <p className="text-lg font-bold text-gray-900">HarthHDR</p>
                <p className="text-xs text-gray-500 mt-1">مسجل لدى شركة كوكل</p>
              </div>
            </div>

            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
              <Mail className="w-6 h-6 text-blue-600" />
              <div>
                <p className="text-sm text-gray-600">البريد الإلكتروني</p>
                <a 
                  href="mailto:HarthHDR@Support.com" 
                  className="text-lg font-bold text-blue-600 hover:underline"
                >
                  HarthHDR@Support.com
                </a>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t">
            <Button 
              className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white"
              onClick={() => window.location.href = 'mailto:HarthHDR@Support.com'}
            >
              <Mail className="w-4 h-4 ml-2" />
              التواصل مع المطور
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* App Info */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center">
              <Code className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <CardTitle>صيدلية جونيا</CardTitle>
              <CardDescription>نظام إدارة الطلبات والتوصيل</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">المطور</p>
              <p className="text-lg font-bold text-emerald-600">HarthHDR</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">الإصدار</p>
              <p className="text-lg font-bold">V2.6</p>
            </div>
          </div>
          <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
            <p className="text-center text-emerald-800 font-medium">
              جميع الحقوق محفوظة © HarthHDR 2024
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Backup Tool */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5 text-emerald-500" />
            نظام النسخ الاحتياطي
          </CardTitle>
          <CardDescription>
            قم بحفظ نسخة احتياطية من جميع بيانات الموقع (الطلبات، الزبائن، المندوبين، الإحصائيات)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BackupSection />
        </CardContent>
      </Card>

      {/* Reset Tools */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            أدوات إعادة التعيين
          </CardTitle>
          <CardDescription>
            تحذير: هذه الأدوات تقوم بحذف البيانات بشكل نهائي ولا يمكن التراجع عنها
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Reset All Data */}
          <div className="p-4 border border-red-200 rounded-lg bg-red-50">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="font-medium text-red-800 flex items-center gap-2">
                  <Trash2 className="w-4 h-4" />
                  إعادة تعيين جميع البيانات
                </h3>
                <p className="text-sm text-red-600 mt-1">
                  يقوم بحذف جميع الطلبات والزبائن والمندوبين وسجلات النشاطات والإشعارات.
                  <br />
                  <strong>تحذير:</strong> هذا الإجراء لا يمكن التراجع عنه!
                </p>
              </div>
              <Button
                variant="destructive"
                onClick={() => setShowResetAllDialog(true)}
              >
                إعادة تعيين
              </Button>
            </div>
          </div>

          {/* Reset Delivery Time Data */}
          <div className="p-4 border border-orange-200 rounded-lg bg-orange-50">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="font-medium text-orange-800 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  إعادة تعيين بيانات وقت المندوبين
                </h3>
                <p className="text-sm text-orange-600 mt-1">
                  يقوم بحذف جميع سجلات مواقع المندوبين وبيانات التتبع GPS.
                  <br />
                  مفيد لإعادة ضبط نظام التتبع دون حذف الطلبات.
                </p>
              </div>
              <Button
                variant="outline"
                className="border-orange-500 text-orange-600 hover:bg-orange-100"
                onClick={() => setShowResetTimeDialog(true)}
              >
                إعادة تعيين
              </Button>
            </div>
          </div>

          {/* Restore Defaults */}
          <div className="p-4 border border-blue-200 rounded-lg bg-blue-50">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="font-medium text-blue-800 flex items-center gap-2">
                  <LogOut className="w-4 h-4" />
                  استعادة الإعدادات الافتراضية
                </h3>
                <p className="text-sm text-blue-600 mt-1">
                  يقوم بمسح الكوكيز وبيانات التخزين المحلي لهذا الجهاز فقط وتسجيل الخروج.
                  <br />
                  لا يؤثر على البيانات في قاعدة البيانات.
                </p>
              </div>
              <Button
                variant="outline"
                className="border-blue-500 text-blue-600 hover:bg-blue-100"
                onClick={handleRestoreDefaults}
              >
                استعادة
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="w-5 h-5 text-blue-500" />
            معلومات إضافية
          </CardTitle>
        </CardHeader>
        <CardContent className="text-gray-600 space-y-2">
          <p>• للحصول على الدعم الفني، تواصل مع المطور HarthHDR</p>
          <p>• يُنصح بأخذ نسخة احتياطية قبل استخدام أدوات إعادة التعيين</p>
          <p>• الرموز السرية مطلوبة لحماية البيانات من الحذف غير المقصود</p>
        </CardContent>
      </Card>

      {/* Reset All Dialog */}
      <Dialog open={showResetAllDialog} onOpenChange={setShowResetAllDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              تأكيد إعادة تعيين جميع البيانات
            </DialogTitle>
            <DialogDescription>
              هذا الإجراء سيحذف جميع البيانات بشكل نهائي ولا يمكن التراجع عنه.
              أدخل الرمز السري للمتابعة.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>تحذير!</AlertTitle>
              <AlertDescription>
                سيتم حذف: الطلبات، الزبائن، سجلات المواقع، الإشعارات، والرسائل
              </AlertDescription>
            </Alert>
            <div>
              <Label htmlFor="secret-all">الرمز السري</Label>
              <Input
                id="secret-all"
                type="password"
                value={secretCode}
                onChange={(e) => setSecretCode(e.target.value)}
                placeholder="أدخل الرمز السري"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowResetAllDialog(false);
              setSecretCode("");
            }}>
              إلغاء
            </Button>
            <Button
              variant="destructive"
              onClick={handleResetAll}
              disabled={!secretCode || resetAllMutation.isPending}
            >
              {resetAllMutation.isPending ? (
                <Loader2 className="w-4 h-4 ml-2 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4 ml-2" />
              )}
              تأكيد الحذف
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Time Dialog */}
      <Dialog open={showResetTimeDialog} onOpenChange={setShowResetTimeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-orange-600 flex items-center gap-2">
              <Clock className="w-5 h-5" />
              تأكيد إعادة تعيين بيانات الوقت
            </DialogTitle>
            <DialogDescription>
              هذا الإجراء سيحذف جميع سجلات مواقع المندوبين.
              أدخل الرمز السري للمتابعة.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Alert className="border-orange-200 bg-orange-50">
              <Clock className="h-4 w-4 text-orange-600" />
              <AlertTitle className="text-orange-800">ملاحظة</AlertTitle>
              <AlertDescription className="text-orange-700">
                سيتم حذف سجلات GPS والمواقع فقط. الطلبات والزبائن لن يتأثروا.
              </AlertDescription>
            </Alert>
            <div>
              <Label htmlFor="secret-time">الرمز السري</Label>
              <Input
                id="secret-time"
                type="password"
                value={secretCode}
                onChange={(e) => setSecretCode(e.target.value)}
                placeholder="أدخل الرمز السري"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowResetTimeDialog(false);
              setSecretCode("");
            }}>
              إلغاء
            </Button>
            <Button
              className="bg-orange-600 hover:bg-orange-700"
              onClick={handleResetTime}
              disabled={!secretCode || resetTimeMutation.isPending}
            >
              {resetTimeMutation.isPending ? (
                <Loader2 className="w-4 h-4 ml-2 animate-spin" />
              ) : (
                <Clock className="w-4 h-4 ml-2" />
              )}
              تأكيد إعادة التعيين
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
