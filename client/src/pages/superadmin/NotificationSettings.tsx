import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Loader2, Bell, Save, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function NotificationSettings() {
  const { data: settings, isLoading, refetch } = trpc.notificationSettings.list.useQuery();
  const { data: branches } = trpc.branches.list.useQuery();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">إعدادات الإشعارات</h1>
          <p className="text-gray-600 mt-2">إدارة إعدادات OneSignal لكل فرع</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-emerald-600 hover:bg-emerald-700">
              <Plus className="w-4 h-4 ml-2" />
              إضافة إعدادات فرع
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>إضافة إعدادات إشعارات لفرع</DialogTitle>
              <DialogDescription>
                قم بإضافة إعدادات OneSignal لفرع جديد
              </DialogDescription>
            </DialogHeader>
            <CreateSettingsForm
              branches={branches || []}
              existingSettings={settings || []}
              onSuccess={() => {
                refetch();
                setIsDialogOpen(false);
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6">
        {settings && settings.length > 0 ? (
          settings.map((setting) => (
            <SettingCard key={setting.id} setting={setting} branches={branches || []} onUpdate={refetch} />
          ))
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Bell className="w-16 h-16 text-gray-300 mb-4" />
              <p className="text-gray-500 text-lg">لا توجد إعدادات إشعارات حتى الآن</p>
              <p className="text-gray-400 text-sm mt-2">قم بإضافة إعدادات OneSignal لكل فرع</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function SettingCard({
  setting,
  branches,
  onUpdate,
}: {
  setting: any;
  branches: any[];
  onUpdate: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    oneSignalAppId: setting.oneSignalAppId || "",
    oneSignalRestApiKey: setting.oneSignalRestApiKey || "",
    notifyOnNewOrder: setting.notifyOnNewOrder === 1,
    notifyOnMessage: setting.notifyOnMessage === 1,
    isEnabled: setting.isEnabled === 1,
  });

  const updateMutation = trpc.notificationSettings.update.useMutation({
    onSuccess: () => {
      toast.success("تم تحديث الإعدادات بنجاح");
      setIsEditing(false);
      onUpdate();
    },
    onError: (error) => {
      toast.error(`فشل التحديث: ${error.message}`);
    },
  });

  const branch = branches.find((b) => b.id === setting.branchId);

  const handleSave = () => {
    updateMutation.mutate({
      branchId: setting.branchId,
      ...formData,
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl">{branch?.name || `فرع #${setting.branchId}`}</CardTitle>
            <CardDescription>
              {branch?.code || "غير معروف"} • {formData.isEnabled ? "مفعّل" : "معطّل"}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={isEditing ? "default" : "outline"}
              size="sm"
              onClick={() => setIsEditing(!isEditing)}
            >
              {isEditing ? "إلغاء" : "تعديل"}
            </Button>
            {isEditing && (
              <Button
                size="sm"
                onClick={handleSave}
                disabled={updateMutation.isPending}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {updateMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Save className="w-4 h-4 ml-2" />
                    حفظ
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor={`appId-${setting.id}`}>OneSignal App ID</Label>
            <Input
              id={`appId-${setting.id}`}
              value={formData.oneSignalAppId}
              onChange={(e) => setFormData({ ...formData, oneSignalAppId: e.target.value })}
              disabled={!isEditing}
              placeholder="a87dbf01-e95d-4978-acad-c587b377f642"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`apiKey-${setting.id}`}>REST API Key</Label>
            <Input
              id={`apiKey-${setting.id}`}
              value={formData.oneSignalRestApiKey}
              onChange={(e) => setFormData({ ...formData, oneSignalRestApiKey: e.target.value })}
              disabled={!isEditing}
              type="password"
              placeholder="os_v2_app_..."
            />
          </div>
        </div>

        <div className="space-y-4 pt-4 border-t">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor={`newOrder-${setting.id}`}>إشعار عند طلب جديد</Label>
              <p className="text-sm text-gray-500">إرسال إشعار للمندوب عند تعيين طلب جديد له</p>
            </div>
            <Switch
              id={`newOrder-${setting.id}`}
              checked={formData.notifyOnNewOrder}
              onCheckedChange={(checked) => setFormData({ ...formData, notifyOnNewOrder: checked })}
              disabled={!isEditing}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor={`message-${setting.id}`}>إشعار عند رسالة جديدة</Label>
              <p className="text-sm text-gray-500">إرسال إشعار للمندوب عند استلام رسالة</p>
            </div>
            <Switch
              id={`message-${setting.id}`}
              checked={formData.notifyOnMessage}
              onCheckedChange={(checked) => setFormData({ ...formData, notifyOnMessage: checked })}
              disabled={!isEditing}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor={`enabled-${setting.id}`}>تفعيل الإشعارات</Label>
              <p className="text-sm text-gray-500">تفعيل أو تعطيل جميع الإشعارات لهذا الفرع</p>
            </div>
            <Switch
              id={`enabled-${setting.id}`}
              checked={formData.isEnabled}
              onCheckedChange={(checked) => setFormData({ ...formData, isEnabled: checked })}
              disabled={!isEditing}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CreateSettingsForm({
  branches,
  existingSettings,
  onSuccess,
}: {
  branches: any[];
  existingSettings: any[];
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState({
    branchId: 0,
    oneSignalAppId: "a87dbf01-e95d-4978-acad-c587b377f642",
    oneSignalRestApiKey: "os_v2_app_vb636apjlvexrlfnywd3g57wijax36eamujuxxvgrsmuieutnul72hvrjzemkwecx234nst6p5zbs7amlakfy5rhpdkbabfdelod2ly",
    notifyOnNewOrder: true,
    notifyOnMessage: true,
    isEnabled: true,
  });

  const createMutation = trpc.notificationSettings.create.useMutation({
    onSuccess: () => {
      toast.success("تم إضافة الإعدادات بنجاح");
      onSuccess();
    },
    onError: (error) => {
      toast.error(`فشل الإضافة: ${error.message}`);
    },
  });

  const availableBranches = branches.filter(
    (branch) => !existingSettings.some((setting) => setting.branchId === branch.id)
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.branchId === 0) {
      toast.error("الرجاء اختيار فرع");
      return;
    }
    createMutation.mutate(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="branch">الفرع</Label>
        <Select
          value={formData.branchId.toString()}
          onValueChange={(value) => setFormData({ ...formData, branchId: parseInt(value) })}
        >
          <SelectTrigger>
            <SelectValue placeholder="اختر فرع" />
          </SelectTrigger>
          <SelectContent>
            {availableBranches.map((branch) => (
              <SelectItem key={branch.id} value={branch.id.toString()}>
                {branch.name} ({branch.code})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="appId">OneSignal App ID</Label>
        <Input
          id="appId"
          value={formData.oneSignalAppId}
          onChange={(e) => setFormData({ ...formData, oneSignalAppId: e.target.value })}
          placeholder="a87dbf01-e95d-4978-acad-c587b377f642"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="apiKey">REST API Key</Label>
        <Input
          id="apiKey"
          value={formData.oneSignalRestApiKey}
          onChange={(e) => setFormData({ ...formData, oneSignalRestApiKey: e.target.value })}
          type="password"
          placeholder="os_v2_app_..."
          required
        />
      </div>

      <div className="space-y-4 pt-4 border-t">
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="newOrder">إشعار عند طلب جديد</Label>
            <p className="text-sm text-gray-500">إرسال إشعار للمندوب عند تعيين طلب جديد له</p>
          </div>
          <Switch
            id="newOrder"
            checked={formData.notifyOnNewOrder}
            onCheckedChange={(checked) => setFormData({ ...formData, notifyOnNewOrder: checked })}
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="message">إشعار عند رسالة جديدة</Label>
            <p className="text-sm text-gray-500">إرسال إشعار للمندوب عند استلام رسالة</p>
          </div>
          <Switch
            id="message"
            checked={formData.notifyOnMessage}
            onCheckedChange={(checked) => setFormData({ ...formData, notifyOnMessage: checked })}
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="enabled">تفعيل الإشعارات</Label>
            <p className="text-sm text-gray-500">تفعيل أو تعطيل جميع الإشعارات لهذا الفرع</p>
          </div>
          <Switch
            id="enabled"
            checked={formData.isEnabled}
            onCheckedChange={(checked) => setFormData({ ...formData, isEnabled: checked })}
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="submit" disabled={createMutation.isPending} className="bg-emerald-600 hover:bg-emerald-700">
          {createMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <Plus className="w-4 h-4 ml-2" />
              إضافة
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
