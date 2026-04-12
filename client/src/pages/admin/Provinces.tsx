import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Globe, Plus, Pencil, Trash2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function Provinces() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedProvince, setSelectedProvince] = useState<any>(null);
  const [provinceName, setProvinceName] = useState("");
  const [selectedRegionId, setSelectedRegionId] = useState<string>("");

  const utils = trpc.useUtils();
  const { data: provinces, isLoading } = trpc.provinces.list.useQuery();
  const { data: regions } = trpc.regions.list.useQuery();

  const createMutation = trpc.provinces.create.useMutation({
    onSuccess: () => {
      toast.success("تم إضافة المحافظة بنجاح");
      setIsAddDialogOpen(false);
      setProvinceName("");
      setSelectedRegionId("");
      utils.provinces.list.invalidate();
    },
    onError: (error: any) => {
      toast.error(error.message || "فشل إضافة المحافظة");
    },
  });

  const updateMutation = trpc.provinces.update.useMutation({
    onSuccess: () => {
      toast.success("تم تحديث المحافظة بنجاح");
      setIsEditDialogOpen(false);
      setSelectedProvince(null);
      setProvinceName("");
      setSelectedRegionId("");
      utils.provinces.list.invalidate();
    },
    onError: (error: any) => {
      toast.error(error.message || "فشل تحديث المحافظة");
    },
  });

  const deleteMutation = trpc.provinces.delete.useMutation({
    onSuccess: () => {
      toast.success("تم حذف المحافظة بنجاح");
      utils.provinces.list.invalidate();
    },
    onError: (error: any) => {
      toast.error(error.message || "فشل حذف المحافظة");
    },
  });

  const handleAdd = () => {
    if (!provinceName.trim()) {
      toast.error("الرجاء إدخال اسم المحافظة");
      return;
    }
    if (!selectedRegionId) {
      toast.error("الرجاء اختيار المنطقة");
      return;
    }
    createMutation.mutate({
      name: provinceName,
    });
  };

  const handleEdit = () => {
    if (!provinceName.trim()) {
      toast.error("الرجاء إدخال اسم المحافظة");
      return;
    }
    if (!selectedRegionId) {
      toast.error("الرجاء اختيار المنطقة");
      return;
    }
    if (!selectedProvince) return;
    updateMutation.mutate({
      id: selectedProvince.id,
      name: provinceName,
    });
  };

  const handleDelete = (id: number, name: string) => {
    if (window.confirm(`هل أنت متأكد من حذف المحافظة "${name}"؟`)) {
      deleteMutation.mutate({ id });
    }
  };

  const openEditDialog = (province: any) => {
    setSelectedProvince(province);
    setProvinceName(province.name);
    setSelectedRegionId(province.regionId.toString());
    setIsEditDialogOpen(true);
  };

  const getRegionName = (regionId: number) => {
    const region = regions?.find((r: any) => r.id === regionId);
    return region?.name || "غير معروف";
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">إدارة المحافظات</h1>
          <p className="text-gray-600 mt-2">إضافة وتعديل وحذف المحافظات</p>
        </div>
        <Button
          onClick={() => setIsAddDialogOpen(true)}
          className="bg-gradient-to-r from-emerald-600 to-teal-600"
        >
          <Plus className="w-4 h-4 ml-2" />
          إضافة محافظة جديدة
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>قائمة المحافظات</CardTitle>
          <CardDescription>جميع المحافظات المسجلة في النظام</CardDescription>
        </CardHeader>
        <CardContent>
          {provinces && provinces.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">#</TableHead>
                  <TableHead className="text-right">اسم المحافظة</TableHead>
                  <TableHead className="text-right">المنطقة</TableHead>
                  <TableHead className="text-right">تاريخ الإضافة</TableHead>
                  <TableHead className="text-right">الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {provinces.map((province: any, index: number) => (
                  <TableRow key={province.id}>
                    <TableCell className="font-medium">{index + 1}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Globe className="w-4 h-4 text-emerald-600" />
                        <span className="font-medium">{province.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-sm">
                        {getRegionName(province.regionId)}
                      </span>
                    </TableCell>
                    <TableCell className="text-gray-600">
                      {new Date(province.createdAt).toLocaleDateString("ar-IQ")}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEditDialog(province)}
                          className="border-blue-300 text-blue-700 hover:bg-blue-50"
                        >
                          <Pencil className="w-3 h-3 ml-1" />
                          تعديل
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDelete(province.id, province.name)}
                          className="border-red-300 text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-3 h-3 ml-1" />
                          حذف
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12">
              <Globe className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">لا توجد محافظات مسجلة</p>
              <Button
                onClick={() => setIsAddDialogOpen(true)}
                variant="outline"
                className="mt-4"
              >
                إضافة محافظة جديدة
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-[500px]" dir="rtl">
          <DialogHeader>
            <DialogTitle>إضافة محافظة جديدة</DialogTitle>
            <DialogDescription>أدخل بيانات المحافظة الجديدة</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="province-name">اسم المحافظة *</Label>
              <Input
                id="province-name"
                value={provinceName}
                onChange={(e) => setProvinceName(e.target.value)}
                placeholder="مثال: الكرخ، الرصافة، إلخ..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="region">المنطقة *</Label>
              <Select value={selectedRegionId} onValueChange={setSelectedRegionId}>
                <SelectTrigger id="region">
                  <SelectValue placeholder="اختر المنطقة" />
                </SelectTrigger>
                <SelectContent>
                  {regions?.map((region: any) => (
                    <SelectItem key={region.id} value={region.id.toString()}>
                      {region.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-3">
              <Button
                className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600"
                onClick={handleAdd}
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                    جاري الإضافة...
                  </>
                ) : (
                  "إضافة"
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setIsAddDialogOpen(false);
                  setProvinceName("");
                  setSelectedRegionId("");
                }}
              >
                إلغاء
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]" dir="rtl">
          <DialogHeader>
            <DialogTitle>تعديل المحافظة</DialogTitle>
            <DialogDescription>قم بتعديل بيانات المحافظة</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-province-name">اسم المحافظة *</Label>
              <Input
                id="edit-province-name"
                value={provinceName}
                onChange={(e) => setProvinceName(e.target.value)}
                placeholder="مثال: الكرخ، الرصافة، إلخ..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-region">المنطقة *</Label>
              <Select value={selectedRegionId} onValueChange={setSelectedRegionId}>
                <SelectTrigger id="edit-region">
                  <SelectValue placeholder="اختر المنطقة" />
                </SelectTrigger>
                <SelectContent>
                  {regions?.map((region: any) => (
                    <SelectItem key={region.id} value={region.id.toString()}>
                      {region.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-3">
              <Button
                className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700"
                onClick={handleEdit}
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                    جاري التحديث...
                  </>
                ) : (
                  "حفظ التعديلات"
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setIsEditDialogOpen(false);
                  setSelectedProvince(null);
                  setProvinceName("");
                  setSelectedRegionId("");
                }}
              >
                إلغاء
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
