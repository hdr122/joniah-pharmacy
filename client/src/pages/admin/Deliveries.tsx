import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Edit, Trash2, Loader2, Upload, User, Eye } from "lucide-react";
import { useLocation } from "wouter";
import { storagePut } from "@/lib/storage";

export default function Deliveries() {
  const [, setLocation] = useLocation();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [deletingUser, setDeletingUser] = useState<any>(null);
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    name: "",
    phone: "",
    imageFile: null as File | null,
  });
  const [uploading, setUploading] = useState(false);

  const utils = trpc.useUtils();
  const { data: deliveries, isLoading } = trpc.users.getDeliveryPersons.useQuery();

  const createMutation = trpc.users.create.useMutation({
    onSuccess: () => {
      toast.success("تم إضافة المندوب بنجاح");
      setIsAddOpen(false);
      resetForm();
      utils.users.getDeliveryPersons.invalidate();
    },
    onError: (error: any) => {
      toast.error(error.message || "فشل إضافة المندوب");
    },
  });

  const updateMutation = trpc.users.update.useMutation({
    onSuccess: () => {
      toast.success("تم تحديث المندوب بنجاح");
      setEditingUser(null);
      resetForm();
      utils.users.getDeliveryPersons.invalidate();
    },
    onError: (error: any) => {
      toast.error(error.message || "فشل تحديث المندوب");
    },
  });

  const updatePasswordMutation = trpc.users.updatePassword.useMutation({
    onSuccess: () => {
      toast.success("تم تحديث كلمة السر بنجاح");
    },
    onError: (error: any) => {
      toast.error(error.message || "فشل تحديث كلمة السر");
    },
  });

  const updateUsernameMutation = trpc.users.updateUsername.useMutation({
    onSuccess: () => {
      toast.success("تم تحديث اسم المستخدم بنجاح");
    },
    onError: (error: any) => {
      toast.error(error.message || "فشل تحديث اسم المستخدم");
    },
  });

  const toggleActiveMutation = trpc.users.update.useMutation({
    onSuccess: () => {
      toast.success("تم تحديث حالة المندوب");
      utils.users.getDeliveryPersons.invalidate();
    },
  });

  const deleteMutation = trpc.users.delete.useMutation({
    onSuccess: () => {
      toast.success("تم حذف المندوب نهائياً");
      setDeletingUser(null);
      utils.users.getDeliveryPersons.invalidate();
    },
    onError: (error: any) => {
      toast.error(error.message || "فشل حذف المندوب");
    },
  });

  const resetForm = () => {
    setFormData({
      username: "",
      password: "",
      name: "",
      phone: "",
      imageFile: null,
    });
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFormData({ ...formData, imageFile: e.target.files[0] });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.username || !formData.name) {
      toast.error("الرجاء إدخال اسم المستخدم والاسم");
      return;
    }

    if (!editingUser && !formData.password) {
      toast.error("الرجاء إدخال كلمة المرور");
      return;
    }

    let imageUrl = editingUser?.profileImage || null;

    // Upload image if selected
    if (formData.imageFile) {
      setUploading(true);
      try {
        const buffer = await formData.imageFile.arrayBuffer();
        const uint8Array = new Uint8Array(buffer);
        const result = await storagePut(
          `delivery-images/${Date.now()}-${formData.imageFile.name}`,
          uint8Array,
          formData.imageFile.type
        );
        imageUrl = result.url;
      } catch (error) {
        toast.error("فشل رفع الصورة");
        setUploading(false);
        return;
      }
      setUploading(false);
    }

    if (editingUser) {
      // Update username if changed
      if (formData.username !== editingUser.username) {
        updateUsernameMutation.mutate({
          id: editingUser.id,
          newUsername: formData.username,
        });
      }
      
      // Update user info
      updateMutation.mutate({
        id: editingUser.id,
        name: formData.name,
        phone: formData.phone || undefined,
        profileImage: imageUrl || undefined,
      });
      
      // Update password if provided
      if (formData.password && formData.password.trim() !== "") {
        updatePasswordMutation.mutate({
          id: editingUser.id,
          newPassword: formData.password,
        });
      }
    } else {
      createMutation.mutate({
        username: formData.username,
        password: formData.password,
        name: formData.name,
        role: "delivery" as const,
        phone: formData.phone || undefined,
        profileImage: imageUrl || undefined,
      });
    }
  };

  const openEdit = (user: any) => {
    setEditingUser(user);
    setFormData({
      username: user.username,
      password: "",
      name: user.name || "",
      phone: user.phone || "",
      imageFile: null,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">إدارة المندوبين</h1>
          <p className="text-gray-600 mt-2">إضافة وتعديل وحذف المندوبين</p>
        </div>
        <Dialog open={isAddOpen || !!editingUser} onOpenChange={(open) => {
          if (!open) {
            setIsAddOpen(false);
            setEditingUser(null);
            resetForm();
          }
        }}>
          <DialogTrigger asChild>
            <Button
              className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700"
              onClick={() => setIsAddOpen(true)}
            >
              <Plus className="w-5 h-5 ml-2" />
              إضافة مندوب جديد
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]" dir="rtl">
            <DialogHeader>
              <DialogTitle>{editingUser ? "تعديل المندوب" : "إضافة مندوب جديد"}</DialogTitle>
              <DialogDescription>
                {editingUser ? "تعديل بيانات المندوب" : "إضافة مندوب جديد إلى النظام"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">اسم المستخدم *</Label>
                <Input
                  id="username"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  placeholder="أدخل اسم المستخدم"
                  required
                />
                {editingUser && (
                  <p className="text-xs text-gray-500">يمكنك تعديل اسم المستخدم</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">كلمة المرور {!editingUser && "*"}</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder={editingUser ? "اتركه فارغاً لعدم التغيير" : "أدخل كلمة المرور"}
                  required={!editingUser}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">الاسم الكامل *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="أدخل الاسم الكامل"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">رقم الهاتف</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="أدخل رقم الهاتف"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="image">صورة المندوب</Label>
                <div className="flex items-center gap-3">
                  <Input
                    id="image"
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="flex-1"
                  />
                  {formData.imageFile && (
                    <Badge variant="secondary">
                      <Upload className="w-3 h-3 ml-1" />
                      تم الاختيار
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <Button
                  type="submit"
                  className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600"
                  disabled={createMutation.isPending || updateMutation.isPending || uploading}
                >
                  {(createMutation.isPending || updateMutation.isPending || uploading) ? (
                    <>
                      <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                      جاري الحفظ...
                    </>
                  ) : (
                    editingUser ? "تحديث" : "إضافة"
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsAddOpen(false);
                    setEditingUser(null);
                    resetForm();
                  }}
                >
                  إلغاء
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>قائمة المندوبين</CardTitle>
          <CardDescription>جميع المندوبين المسجلين في النظام</CardDescription>
        </CardHeader>
        <CardContent>
          {deliveries && deliveries.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">الصورة</TableHead>
                  <TableHead className="text-right">الاسم</TableHead>
                  <TableHead className="text-right">اسم المستخدم</TableHead>
                  <TableHead className="text-right">رقم الهاتف</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                  <TableHead className="text-right">الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deliveries.map((delivery: any) => (
                  <TableRow key={delivery.id}>
                    <TableCell>
                      {delivery.profileImage ? (
                        <img
                          src={delivery.profileImage}
                          alt={delivery.name}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                          <User className="w-5 h-5 text-gray-500" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{delivery.name}</TableCell>
                    <TableCell className="text-gray-600">{delivery.username}</TableCell>
                    <TableCell className="text-gray-600">{delivery.phone || "-"}</TableCell>
                    <TableCell>
                      <Badge
                        variant={delivery.isActive ? "default" : "secondary"}
                        className={delivery.isActive ? "bg-green-600" : ""}
                      >
                        {delivery.isActive ? "نشط" : "معطل"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setLocation(`/admin/deliveries/${delivery.id}`)}
                        >
                          <Eye className="w-4 h-4 ml-1" />
                          عرض
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEdit(delivery)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant={delivery.isActive ? "destructive" : "default"}
                          onClick={() => toggleActiveMutation.mutate({ id: delivery.id, isActive: !delivery.isActive })}
                        >
                          {delivery.isActive ? "تعطيل" : "تفعيل"}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => setDeletingUser(delivery)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12">
              <User className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">لا يوجد مندوبين حالياً</p>
              <p className="text-sm text-gray-400 mt-1">ابدأ بإضافة مندوب جديد</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingUser} onOpenChange={(open) => !open && setDeletingUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف النهائي</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف المندوب <strong>{deletingUser?.name}</strong> نهائياً؟
              <br />
              <span className="text-red-600 font-semibold">تحذير: لا يمكن التراجع عن هذا الإجراء!</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingUser && deleteMutation.mutate({ id: deletingUser.id })}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                  جاري الحذف...
                </>
              ) : (
                "حذف نهائياً"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
