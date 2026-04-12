import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Bell, Edit, Upload, X } from "lucide-react";

export default function UpdatesManagement() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [type, setType] = useState("update");
  const [imageUrl, setImageUrl] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();
  const { data: updates, isLoading } = trpc.updates.list.useQuery();

  const createMutation = trpc.updates.create.useMutation({
    onSuccess: () => {
      toast.success("تم نشر التحديث بنجاح");
      utils.updates.list.invalidate();
      resetForm();
    },
    onError: (error) => {
      toast.error(`فشل نشر التحديث: ${error.message}`);
    },
  });

  const updateMutation = trpc.updates.update.useMutation({
    onSuccess: () => {
      toast.success("تم تعديل التحديث بنجاح");
      utils.updates.list.invalidate();
      resetForm();
    },
    onError: (error) => {
      toast.error(`فشل تعديل التحديث: ${error.message}`);
    },
  });

  const deleteMutation = trpc.updates.delete.useMutation({
    onSuccess: () => {
      toast.success("تم حذف التحديث بنجاح");
      utils.updates.list.invalidate();
    },
    onError: (error) => {
      toast.error(`فشل حذف التحديث: ${error.message}`);
    },
  });

  const resetForm = () => {
    setIsDialogOpen(false);
    setIsEditMode(false);
    setEditingId(null);
    setTitle("");
    setContent("");
    setType("update");
    setImageUrl("");
    setImageFile(null);
  };

  const handleEdit = (update: any) => {
    setIsEditMode(true);
    setEditingId(update.id);
    setTitle(update.title);
    setContent(update.content);
    setType(update.type);
    setImageUrl(update.imageUrl || "");
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
        imageUrl: finalImageUrl || undefined,
      });
    } else {
      createMutation.mutate({
        title,
        content,
        type,
        imageUrl: finalImageUrl || undefined,
      });
    }
  };

  const handleDelete = (id: number) => {
    if (confirm("هل أنت متأكد من حذف هذا التحديث؟")) {
      deleteMutation.mutate({ id });
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setImageUrl("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
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
          <h1 className="text-3xl font-bold">إدارة التحديثات</h1>
          <p className="text-muted-foreground mt-2">نشر تحديثات وأخبار للفروع</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          if (!open) resetForm();
          setIsDialogOpen(open);
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 ml-2" />
              نشر تحديث جديد
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>{isEditMode ? "تعديل التحديث" : "نشر تحديث جديد"}</DialogTitle>
              <DialogDescription>
                {isEditMode ? "تعديل التحديث الحالي" : "أضف تحديث أو خبر جديد سيظهر لجميع الفروع"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="title">العنوان *</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="عنوان التحديث"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="content">المحتوى *</Label>
                <Textarea
                  id="content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="محتوى التحديث"
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
                    <SelectItem value="update">تحديث</SelectItem>
                    <SelectItem value="news">خبر</SelectItem>
                    <SelectItem value="article">مقال</SelectItem>
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
                    "نشر التحديث"
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
        {updates && updates.length > 0 ? (
          updates.map((update: any) => (
            <Card key={update.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <CardTitle>{update.title}</CardTitle>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        update.type === 'update' ? 'bg-blue-100 text-blue-700' :
                        update.type === 'news' ? 'bg-green-100 text-green-700' :
                        'bg-purple-100 text-purple-700'
                      }`}>
                        {update.type === 'update' ? 'تحديث' :
                         update.type === 'news' ? 'خبر' : 'مقال'}
                      </span>
                    </div>
                    <CardDescription>
                      {new Date(update.createdAt).toLocaleDateString('ar-IQ', {
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
                      onClick={() => handleEdit(update)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={() => handleDelete(update.id)}
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
                {update.imageUrl && (
                  <img
                    src={update.imageUrl}
                    alt={update.title}
                    className="w-full h-64 object-cover rounded-lg mb-4"
                  />
                )}
                <p className="text-muted-foreground whitespace-pre-wrap">{update.content}</p>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Bell className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-center">
                لا توجد تحديثات منشورة حالياً
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
