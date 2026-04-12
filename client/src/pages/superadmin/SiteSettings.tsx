import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Settings, Upload, Image as ImageIcon } from "lucide-react";

export default function SiteSettings() {
  const [siteName, setSiteName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [uploading, setUploading] = useState(false);

  const utils = trpc.useUtils();
  const { data: settingsList, isLoading } = trpc.siteSettings.list.useQuery();

  const updateMutation = trpc.siteSettings.update.useMutation({
    onSuccess: () => {
      toast.success("تم حفظ الإعدادات بنجاح");
      utils.siteSettings.list.invalidate();
    },
    onError: (error: any) => {
      toast.error(`فشل حفظ الإعدادات: ${error.message}`);
    },
  });

  useEffect(() => {
    if (settingsList) {
      const nameSettings = settingsList.find(s => s.settingKey === "siteName");
      const logoSettings = settingsList.find(s => s.settingKey === "logoUrl");
      setSiteName(nameSettings?.settingValue || "");
      setLogoUrl(logoSettings?.settingValue || "");
    }
  }, [settingsList]);

  const handleSaveName = () => {
    if (!siteName.trim()) {
      toast.error("يرجى إدخال اسم الموقع");
      return;
    }
    updateMutation.mutate({ key: "siteName", value: siteName });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // التحقق من نوع الملف
    if (!file.type.startsWith("image/")) {
      toast.error("يرجى اختيار ملف صورة");
      return;
    }

    // التحقق من حجم الملف (أقل من 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("حجم الصورة يجب أن يكون أقل من 5 ميجابايت");
      return;
    }

    setUploading(true);
    try {
      // تحويل الملف إلى base64
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target?.result as string;
        
        // حفظ الرابط في قاعدة البيانات
        // في الواقع، يجب رفع الصورة إلى S3 أولاً، لكن للتبسيط سنحفظ base64
        updateMutation.mutate(
          { key: "logoUrl", value: base64 },
          {
            onSuccess: () => {
              setLogoUrl(base64);
              toast.success("تم رفع الشعار بنجاح");
            },
          }
        );
      };
      reader.readAsDataURL(file);
    } catch (error) {
      toast.error("فشل رفع الشعار");
    } finally {
      setUploading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Settings className="w-8 h-8" />
          <h1 className="text-3xl font-bold">إعدادات الموقع</h1>
        </div>
        <p className="text-muted-foreground">إدارة اسم الموقع والشعار</p>
      </div>

      <div className="grid gap-6 max-w-2xl">
        {/* اسم الموقع */}
        <Card>
          <CardHeader>
            <CardTitle>اسم الموقع</CardTitle>
            <CardDescription>اسم الموقع الذي سيظهر في جميع الصفحات</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="siteName">اسم الموقع</Label>
              <Input
                id="siteName"
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
                placeholder="مثال: صيدلية جونيا"
              />
            </div>
            <Button onClick={handleSaveName} disabled={updateMutation.isPending}>
              {updateMutation.isPending && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
              حفظ الاسم
            </Button>
          </CardContent>
        </Card>

        {/* شعار الموقع */}
        <Card>
          <CardHeader>
            <CardTitle>شعار الموقع (Logo)</CardTitle>
            <CardDescription>الشعار الذي سيظهر في أعلى الصفحات</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {logoUrl && (
              <div className="flex items-center justify-center p-4 border rounded-lg bg-muted/30">
                <img
                  src={logoUrl}
                  alt="Site Logo"
                  className="max-h-32 object-contain"
                />
              </div>
            )}
            {!logoUrl && (
              <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg bg-muted/30">
                <ImageIcon className="w-12 h-12 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">لم يتم رفع شعار بعد</p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="logo">رفع شعار جديد</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="logo"
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  disabled={uploading}
                  className="cursor-pointer"
                />
                {uploading && <Loader2 className="w-4 h-4 animate-spin" />}
              </div>
              <p className="text-xs text-muted-foreground">
                الصيغ المدعومة: JPG, PNG, GIF (أقل من 5 ميجابايت)
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
