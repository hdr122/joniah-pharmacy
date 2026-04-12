import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, MapPin, Plus, Pencil, Trash2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function Regions() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState<any>(null);
  const [regionName, setRegionName] = useState("");
  const [selectedProvinceId, setSelectedProvinceId] = useState<number>(1);

  const utils = trpc.useUtils();
  const { data: regions, isLoading } = trpc.regions.list.useQuery();
  const { data: provinces } = trpc.provinces.list.useQuery();

  const createMutation = trpc.regions.create.useMutation({
    onSuccess: () => {
      toast.success("تم إضافة المنطقة بنجاح");
      setIsAddDialogOpen(false);
      setRegionName("");
      utils.regions.list.invalidate();
    },
    onError: (error: any) => {
      toast.error(error.message || "فشل إضافة المنطقة");
    },
  });

  const updateMutation = trpc.regions.update.useMutation({
    onSuccess: () => {
      toast.success("تم تحديث المنطقة بنجاح");
      setIsEditDialogOpen(false);
      setSelectedRegion(null);
      setRegionName("");
      utils.regions.list.invalidate();
    },
    onError: (error: any) => {
      toast.error(error.message || "فشل تحديث المنطقة");
    },
  });

  const deleteMutation = trpc.regions.delete.useMutation({
    onSuccess: () => {
      toast.success("تم حذف المنطقة بنجاح");
      utils.regions.list.invalidate();
    },
    onError: (error: any) => {
      toast.error(error.message || "فشل حذف المنطقة");
    },
  });

  const handleAdd = () => {
    if (!regionName.trim()) {
      toast.error("الرجاء إدخال اسم المنطقة");
      return;
    }
    createMutation.mutate({ name: regionName, provinceId: selectedProvinceId });
  };

  const handleEdit = () => {
    if (!regionName.trim()) {
      toast.error("الرجاء إدخال اسم المنطقة");
      return;
    }
    if (!selectedRegion) return;
    updateMutation.mutate({ id: selectedRegion.id, name: regionName, provinceId: selectedProvinceId });
  };

  const handleDelete = (id: number, name: string) => {
    if (window.confirm(`هل أنت متأكد من حذف المنطقة "${name}"؟`)) {
      deleteMutation.mutate({ id });
    }
  };

  const openEditDialog = (region: any) => {
    setSelectedRegion(region);
    setRegionName(region.name);
    setIsEditDialogOpen(true);
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
          <h1 className="text-3xl font-bold text-gray-900">إدارة المناطق</h1>
          <p className="text-gray-600 mt-2">إضافة وتعديل وحذف المناطق</p>
        </div>
        <Button
          onClick={() => setIsAddDialogOpen(true)}
          className="bg-gradient-to-r from-emerald-600 to-teal-600"
        >
          <Plus className="w-4 h-4 ml-2" />
          إضافة منطقة جديدة
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>قائمة المناطق</CardTitle>
          <CardDescription>جميع المناطق المسجلة في النظام</CardDescription>
        </CardHeader>
        <CardContent>
          {regions && regions.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">#</TableHead>
                  <TableHead className="text-right">اسم المنطقة</TableHead>
                  <TableHead className="text-right">تاريخ الإضافة</TableHead>
                  <TableHead className="text-right">الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {regions.map((region: any, index: number) => (
                  <TableRow key={region.id}>
                    <TableCell className="font-medium">{index + 1}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-emerald-600" />
                        <span className="font-medium">{region.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-gray-600">
                      {new Date(region.createdAt).toLocaleDateString("ar-IQ")}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEditDialog(region)}
                          className="border-blue-300 text-blue-700 hover:bg-blue-50"
                        >
                          <Pencil className="w-3 h-3 ml-1" />
                          تعديل
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDelete(region.id, region.name)}
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
              <MapPin className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">لا توجد مناطق مسجلة</p>
              <Button
                onClick={() => setIsAddDialogOpen(true)}
                variant="outline"
                className="mt-4"
              >
                إضافة منطقة جديدة
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-[500px]" dir="rtl">
          <DialogHeader>
            <DialogTitle>إضافة منطقة جديدة</DialogTitle>
            <DialogDescription>أدخل اسم المنطقة الجديدة</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="region-name">اسم المنطقة *</Label>
              <Input
                id="region-name"
                value={regionName}
                onChange={(e) => setRegionName(e.target.value)}
                placeholder="مثال: بغداد، البصرة، إلخ..."
              />
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
                  setRegionName("");
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
            <DialogTitle>تعديل المنطقة</DialogTitle>
            <DialogDescription>قم بتعديل اسم المنطقة</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-region-name">اسم المنطقة *</Label>
              <Input
                id="edit-region-name"
                value={regionName}
                onChange={(e) => setRegionName(e.target.value)}
                placeholder="مثال: بغداد، البصرة، إلخ..."
              />
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
                  setSelectedRegion(null);
                  setRegionName("");
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
