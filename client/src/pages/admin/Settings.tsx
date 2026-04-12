import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Lock, User, Save } from "lucide-react";

export default function Settings() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [newUsername, setNewUsername] = useState("");

  const { data: user, isLoading } = trpc.auth.me.useQuery();

  const changePasswordMutation = trpc.users.changePassword.useMutation({
    onSuccess: () => {
      toast.success("تم تغيير كلمة المرور بنجاح");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (error: any) => {
      toast.error(error.message || "فشل تغيير كلمة المرور");
    },
  });

  const changeUsernameMutation = trpc.users.changeUsername.useMutation({
    onSuccess: () => {
      toast.success("تم تغيير اسم المستخدم بنجاح");
      setNewUsername("");
    },
    onError: (error: any) => {
      toast.error(error.message || "فشل تغيير اسم المستخدم");
    },
  });

  const handleChangePassword = () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error("الرجاء ملء جميع الحقول");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("كلمة المرور الجديدة وتأكيد كلمة المرور غير متطابقتين");
      return;
    }

    if (newPassword.length < 6) {
      toast.error("كلمة المرور يجب أن تكون 6 أحرف على الأقل");
      return;
    }

    changePasswordMutation.mutate({
      currentPassword,
      newPassword,
    });
  };

  const handleChangeUsername = () => {
    if (!newUsername.trim()) {
      toast.error("الرجاء إدخال اسم المستخدم الجديد");
      return;
    }

    if (newUsername.length < 3) {
      toast.error("اسم المستخدم يجب أن يكون 3 أحرف على الأقل");
      return;
    }

    changeUsernameMutation.mutate({
      newUsername,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">الإعدادات</h1>
        <p className="text-gray-600 mt-2">إدارة إعدادات حسابك</p>
      </div>

      {/* معلومات الحساب */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            معلومات الحساب
          </CardTitle>
          <CardDescription>معلومات حسابك الحالية</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>اسم المستخدم الحالي</Label>
            <Input
              value={user?.username || ""}
              disabled
              className="mt-2 bg-gray-50"
            />
          </div>
          <div>
            <Label>الاسم</Label>
            <Input
              value={user?.name || ""}
              disabled
              className="mt-2 bg-gray-50"
            />
          </div>
          <div>
            <Label>الدور</Label>
            <Input
              value={user?.role === "admin" ? "مدير" : "مندوب"}
              disabled
              className="mt-2 bg-gray-50"
            />
          </div>
        </CardContent>
      </Card>

      {/* تغيير اسم المستخدم */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            تغيير اسم المستخدم
          </CardTitle>
          <CardDescription>قم بتغيير اسم المستخدم الخاص بك</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="newUsername">اسم المستخدم الجديد</Label>
            <Input
              id="newUsername"
              type="text"
              placeholder="أدخل اسم المستخدم الجديد"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              className="mt-2"
            />
          </div>
          <Button
            onClick={handleChangeUsername}
            disabled={changeUsernameMutation.isPending}
            className="w-full sm:w-auto"
          >
            {changeUsernameMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                جاري التغيير...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                حفظ اسم المستخدم
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* تغيير كلمة المرور */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="w-5 h-5" />
            تغيير كلمة المرور
          </CardTitle>
          <CardDescription>قم بتحديث كلمة المرور الخاصة بك</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="currentPassword">كلمة المرور الحالية</Label>
            <Input
              id="currentPassword"
              type="password"
              placeholder="أدخل كلمة المرور الحالية"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="mt-2"
            />
          </div>
          <div>
            <Label htmlFor="newPassword">كلمة المرور الجديدة</Label>
            <Input
              id="newPassword"
              type="password"
              placeholder="أدخل كلمة المرور الجديدة"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="mt-2"
            />
          </div>
          <div>
            <Label htmlFor="confirmPassword">تأكيد كلمة المرور الجديدة</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="أعد إدخال كلمة المرور الجديدة"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-2"
            />
          </div>
          <Button
            onClick={handleChangePassword}
            disabled={changePasswordMutation.isPending}
            className="w-full sm:w-auto"
          >
            {changePasswordMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                جاري التغيير...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                حفظ كلمة المرور
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
