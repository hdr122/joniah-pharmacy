import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { User, Lock, Image as ImageIcon, LogOut, Loader2, Camera } from "lucide-react";

export default function DeliveryProfile() {
  const { data: user } = trpc.auth.me.useQuery();
  const utils = trpc.useUtils();
  
  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      window.location.href = "/";
    },
  });

  // State for name change
  const [newName, setNewName] = useState(user?.name || "");
  const [isEditingName, setIsEditingName] = useState(false);

  // State for password change
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // State for image upload
  const [uploading, setUploading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Update user mutation
  const updateUserMutation = trpc.users.update.useMutation({
    onSuccess: () => {
      toast.success("تم تحديث الملف الشخصي بنجاح");
      utils.auth.me.invalidate();
      setIsEditingName(false);
    },
    onError: (error) => {
      toast.error(error.message || "فشل تحديث الملف الشخصي");
    },
  });

  // Change password mutation
  const changePasswordMutation = trpc.users.changePassword.useMutation({
    onSuccess: () => {
      toast.success("تم تغيير كلمة السر بنجاح");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (error) => {
      toast.error(error.message || "فشل تغيير كلمة السر");
    },
  });

  // Upload profile image mutation
  const uploadImageMutation = trpc.users.uploadProfileImage.useMutation({
    onSuccess: () => {
      toast.success("تم تحديث الصورة الشخصية بنجاح");
      utils.auth.me.invalidate();
      setSelectedImage(null);
      setPreviewUrl(null);
    },
    onError: (error) => {
      toast.error(error.message || "فشل تحديث الصورة");
    },
  });

  const handleNameUpdate = () => {
    if (!newName.trim()) {
      toast.error("الرجاء إدخال الاسم");
      return;
    }

    updateUserMutation.mutate({
      id: user!.id,
      name: newName,
    });
  };

  const handlePasswordChange = () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error("الرجاء ملء جميع الحقول");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("كلمة السر الجديدة غير متطابقة");
      return;
    }

    if (newPassword.length < 6) {
      toast.error("كلمة السر يجب أن تكون 6 أحرف على الأقل");
      return;
    }

    changePasswordMutation.mutate({
      currentPassword,
      newPassword,
    });
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("الرجاء اختيار صورة");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("حجم الصورة يجب أن يكون أقل من 5 ميجابايت");
      return;
    }

    setSelectedImage(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleImageUpload = async () => {
    if (!selectedImage) {
      toast.error("الرجاء اختيار صورة");
      return;
    }

    setUploading(true);
    try {
      const buffer = await selectedImage.arrayBuffer();
      const uint8Array = new Uint8Array(buffer);
      
      // Convert to base64 for sending to server
      const base64 = btoa(
        uint8Array.reduce((data, byte) => data + String.fromCharCode(byte), '')
      );

      uploadImageMutation.mutate({
        imageData: base64,
        mimeType: selectedImage.type,
      });
    } catch (error) {
      toast.error("فشل رفع الصورة");
    } finally {
      setUploading(false);
    }
  };

  const handleLogout = () => {
    if (confirm("هل أنت متأكد من تسجيل الخروج؟")) {
      logoutMutation.mutate();
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-50 p-4" dir="rtl">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">الملف الشخصي</h1>
          <p className="text-gray-600">إدارة معلوماتك الشخصية وإعداداتك</p>
        </div>

        {/* Profile Picture Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Camera className="w-5 h-5" />
              الصورة الشخصية
            </CardTitle>
            <CardDescription>قم بتحديث صورتك الشخصية</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-6">
              <Avatar className="w-24 h-24">
                <AvatarImage src={previewUrl || user.profileImage || ""} />
                <AvatarFallback className="text-2xl bg-emerald-100 text-emerald-700">
                  {user.name?.charAt(0) || "م"}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1 space-y-3">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  disabled={uploading}
                  className="cursor-pointer"
                />
                {selectedImage && (
                  <Button
                    onClick={handleImageUpload}
                    disabled={uploading}
                    className="w-full bg-emerald-600 hover:bg-emerald-700"
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        جاري الرفع...
                      </>
                    ) : (
                      <>
                        <ImageIcon className="w-4 h-4 mr-2" />
                        رفع الصورة
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Name Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              الاسم
            </CardTitle>
            <CardDescription>قم بتحديث اسمك</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">الاسم الكامل</Label>
              <Input
                id="name"
                value={newName}
                onChange={(e) => {
                  setNewName(e.target.value);
                  setIsEditingName(true);
                }}
                placeholder="أدخل اسمك الكامل"
              />
            </div>
            {isEditingName && (
              <div className="flex gap-2">
                <Button
                  onClick={handleNameUpdate}
                  disabled={updateUserMutation.isPending}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                >
                  {updateUserMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      جاري الحفظ...
                    </>
                  ) : (
                    "حفظ التغييرات"
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setNewName(user.name || "");
                    setIsEditingName(false);
                  }}
                  className="flex-1"
                >
                  إلغاء
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Password Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5" />
              تغيير كلمة السر
            </CardTitle>
            <CardDescription>قم بتحديث كلمة السر الخاصة بك</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">كلمة السر الحالية</Label>
              <Input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="أدخل كلمة السر الحالية"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">كلمة السر الجديدة</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="أدخل كلمة السر الجديدة (6 أحرف على الأقل)"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">تأكيد كلمة السر الجديدة</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="أعد إدخال كلمة السر الجديدة"
              />
            </div>
            <Button
              onClick={handlePasswordChange}
              disabled={changePasswordMutation.isPending}
              className="w-full bg-emerald-600 hover:bg-emerald-700"
            >
              {changePasswordMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  جاري التغيير...
                </>
              ) : (
                "تغيير كلمة السر"
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Logout Card */}
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <LogOut className="w-5 h-5" />
              تسجيل الخروج
            </CardTitle>
            <CardDescription>قم بتسجيل الخروج من حسابك</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={handleLogout}
              variant="destructive"
              className="w-full"
            >
              <LogOut className="w-4 h-4 mr-2" />
              تسجيل الخروج
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
