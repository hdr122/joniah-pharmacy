import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Megaphone, AlertCircle, CheckCircle, Info, Edit, Upload, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function AnnouncementsManagement() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [type, setType] = useState("info");
  const [isActive, setIsActive] = useState(true);
  const [imageUrl, setImageUrl] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();
  const { data: announcements, isLoading } = trpc.announcements.list.useQuery();

  const createMutation = trpc.announcements.create.useMutation({
    onSuccess: () => {
      toast.success("تم نشر الإعلان بنجاح");
      utils.announcements.list.invalidate();
      resetForm();
    },
    onError: (error) => {
      toast.error(`فشل نشر الإعلان: ${error.message}`);
    },
  });

  const updateMutation = trpc.announcements.update.useMutation({
    onSuccess: () => {
      toast.success("تم تعديل الإعلان بنجاح");
      utils.announcements.list.invalidate();
      resetForm();
    },
    onError: (error) => {
      toast.error(`فشل تعديل الإعلان: ${error.message}`);
    },
  });

  const deleteMutation = trpc.announcements.delete.useMutation({
    onSuccess: () => {
      toast.success("تم حذف الإعلان بنجاح");
      utils.announcements.list.invalidate();
    },
    onError: (error) => {
      toast.error(`فشل حذف الإعلان: ${error.message}`);
    },
  });

  const resetForm = () => {
    setIsDialogOpen(false);
    setIsEditMode(false);
    setEditingId(null);
    setTitle("");
    setContent("");
    setType("info");
    setIsActive(true);
    setImageUrl("");
    setImageFile(null);
  };

  const handleEdit = (announcement: any) => {
    setIsEditMode(true);
    setEditingId(announcement.id);
    setTitle(announcement.title);
    setContent(announcement.content);
    setType(announcement.type);
    setIsActive(announcement.isActive === 1);
    setImageUrl(announcement.imageUrl || "");
    setIsDialogOpen(true);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error("حجم الصورة يجب أن يكون أقل من 5 ميجابايت");
        return;
      }
      setImageFile(file);
    }
  };

  const uploadImage = async (): Promise<string | null> => {
    if (!imageFile) return null;

    setUploading(true);
    const formData = new FormData();
    formData.append("file", imageFile);

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("فشل رفع الصورة");
      }

      const data = await response.json();
      return data.url;
    } catch (error) {
      console.error("Error uploading image:", error);
      toast.error("فشل رفع الصورة");
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      toast.error("يرجى ملء جميع الحقول المطلوبة");
      return;
    }

    let finalImageUrl = imageUrl;

    // Upload image if a new file is selected
    if (imageFile) {
      const uploadedUrl = await uploadImage();
      if (uploadedUrl) {
        finalImageUrl = uploadedUrl;
      } else {
        return; // Stop if upload failed
      }
    }

    if (isEditMode && editingId) {
      updateMutation.mutate({
        id: editingId,
        title,
        content,
        type,
        isActive: isActive ? 1 : 0,
        imageUrl: finalImageUrl || undefined,
      });
    } else {
      createMutation.mutate({
        title,
        content,
        type,
        isActive: isActive ? 1 : 0,
        imageUrl: finalImageUrl || undefined,
      });
    }
  };

  const handleDelete = (id: number) => {
    if (confirm("هل أنت متأكد من حذف هذا الإعلان؟")) {
      deleteMutation.mutate({ id });
    }
  };

  const handleToggleActive = (announcement: any) => {
    updateMutation.mutate({
      id: announcement.id,
      isActive: announcement.isActive === 1 ? 0 : 1,
    });
  };

  const removeImage = () => {
    setImageFile(null);
    setImageUrl("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "info":
        return <Info className="w-4 h-4" />;
      case "warning":
        return <AlertCircle className="w-4 h-4" />;
      case "success":
        return <CheckCircle className="w-4 h-4" />;
      default:
        return <Info className="w-4 h-4" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "info":
        return "معلومة";
      case "warning":
        return "تحذير";
      case "success":
        return "نجاح";
      default:
        return "معلومة";
    }
  };

  const getTypeBadgeClass = (type: string) => {
    switch (type) {
      case "info":
        return "bg-blue-100 text-blue-700";
      case "warning":
        return "bg-orange-100 text-orange-700";
      case "success":
        return "bg-green-100 text-green-700";
      default:
        return "bg-blue-100 text-blue-700";
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">إدارة الإعلانات</h1>
          <p className="text-muted-foreground mt-2">نشر إعلانات مهمة تظهر لجميع المستخدمين</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          if (!open) resetForm();
          setIsDialogOpen(open);
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 ml-2" />
              نشر إعلان جديد
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>{isEditMode ? "تعديل الإعلان" : "نشر إعلان جديد"}</DialogTitle>
              <DialogDescription>
                {isEditMode ? "تعديل الإعلان الحالي" : "أضف إعلان مهم سيظهر لجميع المستخدمين"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="title">العنوان *</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="عنوان الإعلان"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="content">المحتوى *</Label>
                <Textarea
                  id="content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="محتوى الإعلان"
                  rows={6}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="type">النوع</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger id="type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="info">معلومة</SelectItem>
                    <SelectItem value="warning">تحذير</SelectItem>
                    <SelectItem value="success">نجاح</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="image">الصورة (اختياري)</Label>
                <div className="space-y-3">
                  {(imageUrl || imageFile) && (
                    <div className="relative">
                      <img
                        src={imageFile ? URL.createObjectURL(imageFile) : imageUrl}
                        alt="Preview"
                        className="w-full h-48 object-cover rounded-lg"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2"
                        onClick={removeImage}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                  
                  {!imageUrl && !imageFile && (
                    <div className="flex items-center gap-2">
                      <Input
                        ref={fileInputRef}
                        id="image"
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                        className="hidden"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full"
                      >
                        <Upload className="w-4 h-4 ml-2" />
                        رفع صورة من الجهاز
                      </Button>
                    </div>
                  )}

                  <div className="text-xs text-muted-foreground">
                    الحد الأقصى لحجم الصورة: 5 ميجابايت
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div className="space-y-0.5">
                  <Label htmlFor="active">تفعيل الإعلان</Label>
                  <p className="text-sm text-muted-foreground">
                    سيظهر الإعلان للمستخدمين فوراً عند التفعيل
                  </p>
                </div>
                <Switch
                  id="active"
                  checked={isActive}
                  onCheckedChange={setIsActive}
                />
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending || uploading}
                  className="flex-1"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                      جاري رفع الصورة...
                    </>
                  ) : createMutation.isPending || updateMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                      جاري الحفظ...
                    </>
                  ) : isEditMode ? (
                    "حفظ التعديلات"
                  ) : (
                    "نشر الإعلان"
                  )}
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>
                  إلغاء
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {announcements && announcements.length > 0 ? (
          announcements.map((announcement: any) => (
            <Card key={announcement.id} className={announcement.isActive === 0 ? "opacity-60" : ""}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <CardTitle className="flex items-center gap-2">
                        {getTypeIcon(announcement.type)}
                        {announcement.title}
                      </CardTitle>
                      <Badge className={getTypeBadgeClass(announcement.type)}>
                        {getTypeLabel(announcement.type)}
                      </Badge>
                      {announcement.isActive === 1 ? (
                        <Badge className="bg-green-100 text-green-700">نشط</Badge>
                      ) : (
                        <Badge variant="secondary">غير نشط</Badge>
                      )}
                    </div>
                    <CardDescription>
                      {new Date(announcement.createdAt).toLocaleDateString('ar-IQ', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleToggleActive(announcement)}
                      disabled={updateMutation.isPending}
                      title={announcement.isActive === 1 ? "إيقاف التفعيل" : "تفعيل"}
                    >
                      {updateMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : announcement.isActive === 1 ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-gray-400" />
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleEdit(announcement)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={() => handleDelete(announcement.id)}
                      disabled={deleteMutation.isPending}
                    >
                      {deleteMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {announcement.imageUrl && (
                  <img
                    src={announcement.imageUrl}
                    alt={announcement.title}
                    className="w-full h-64 object-cover rounded-lg mb-4"
                  />
                )}
                <p className="text-muted-foreground whitespace-pre-wrap">{announcement.content}</p>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Megaphone className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-center">
                لا توجد إعلانات منشورة حالياً
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
