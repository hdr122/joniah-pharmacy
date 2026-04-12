import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Building2, Plus, Users, Package, TrendingUp, Calendar, Edit, LogIn, Settings, AlertTriangle, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function SuperAdminDashboard() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [branchToDelete, setBranchToDelete] = useState<any>(null);
  const [maintenanceDialogOpen, setMaintenanceDialogOpen] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<any>(null);
  const [maintenanceData, setMaintenanceData] = useState({
    isEnabled: false,
    message: 'الموقع تحت الصيانة حالياً. سنعود قريباً!',
    estimatedEndTime: '',
  });
  const [newBranch, setNewBranch] = useState({
    name: "",
    code: "",
    address: "",
    phone: "",
    subscriptionStartDate: "",
    subscriptionEndDate: "",
    adminUsername: "",
    adminPassword: "",
    adminName: "",
  });
  const [editBranch, setEditBranch] = useState({
    id: 0,
    name: "",
    address: "",
    phone: "",
    subscriptionStartDate: "",
    subscriptionEndDate: "",
  });

  const { data: branchesStats, isLoading, refetch } = trpc.branches.getStats.useQuery();
  const { data: maintenanceStatus, refetch: refetchMaintenance } = trpc.maintenance.getStatus.useQuery();
  
  // تحديث بيانات الصيانة عند تحميلها
  useState(() => {
    if (maintenanceStatus) {
      setMaintenanceData({
        isEnabled: maintenanceStatus.isEnabled === 1,
        message: maintenanceStatus.message || 'الموقع تحت الصيانة حالياً. سنعود قريباً!',
        estimatedEndTime: maintenanceStatus.estimatedEndTime || '',
      });
    }
  });
  const createBranchMutation = trpc.branches.create.useMutation({
    onSuccess: () => {
      toast.success("تم إنشاء الفرع بنجاح");
      setCreateDialogOpen(false);
      refetch();
      resetForm();
    },
    onError: (error) => {
      toast.error(error.message || "فشل إنشاء الفرع");
    },
  });
  
  const loginToBranchMutation = trpc.branches.loginToBranch.useMutation({
    onSuccess: (data) => {
      toast.success(`تم الدخول إلى فرع ${data.branchName}`);
      // التوجيه إلى لوحة تحكم الفرع
      setTimeout(() => {
        window.location.href = "/admin";
      }, 500);
    },
    onError: (error) => {
      toast.error(error.message || "فشل الدخول إلى الفرع");
    },
  });
  
  const updateBranchMutation = trpc.branches.update.useMutation({
    onSuccess: () => {
      toast.success("تم تحديث الفرع بنجاح");
      setEditDialogOpen(false);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "فشل تحديث الفرع");
    },
  });

  const deleteBranchMutation = trpc.branches.softDelete.useMutation({
    onSuccess: () => {
      toast.success("تم حذف الفرع بنجاح. يمكن استعادته خلال 30 يوم");
      setDeleteDialogOpen(false);
      setBranchToDelete(null);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "فشل حذف الفرع");
    },
  });
  
  const updateMaintenanceMutation = trpc.maintenance.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("تم تحديث وضع الصيانة بنجاح");
      setMaintenanceDialogOpen(false);
      refetchMaintenance();
    },
    onError: (error) => {
      toast.error(error.message || "فشل تحديث وضع الصيانة");
    },
  });

  const resetForm = () => {
    setNewBranch({
      name: "",
      code: "",
      address: "",
      phone: "",
      subscriptionStartDate: "",
      subscriptionEndDate: "",
      adminUsername: "",
      adminPassword: "",
      adminName: "",
    });
  };

  const handleCreateBranch = () => {
    if (!newBranch.name || !newBranch.code || !newBranch.adminUsername || !newBranch.adminPassword || !newBranch.adminName) {
      toast.error("يرجى ملء جميع الحقول المطلوبة");
      return;
    }

    createBranchMutation.mutate(newBranch);
  };
  
  const handleEditBranch = (branch: any) => {
    setSelectedBranch(branch);
    setEditBranch({
      id: branch.id,
      name: branch.name,
      address: branch.address || "",
      phone: branch.phone || "",
      subscriptionStartDate: branch.subscriptionStartDate || "",
      subscriptionEndDate: branch.subscriptionEndDate || "",
    });
    setEditDialogOpen(true);
  };
  
  const handleUpdateBranch = () => {
    if (!editBranch.name) {
      toast.error("يرجى إدخال اسم الفرع");
      return;
    }
    updateBranchMutation.mutate(editBranch);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
            إدارة الفروع
          </h1>
          <p className="text-muted-foreground mt-2">
            إدارة جميع فروع صيدلية جونيا والاشتراكات
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={() => setMaintenanceDialogOpen(true)} 
            variant={maintenanceStatus?.isEnabled ? "destructive" : "outline"}
            className={maintenanceStatus?.isEnabled ? "" : ""}
          >
            {maintenanceStatus?.isEnabled ? (
              <>
                <AlertTriangle className="ml-2 h-4 w-4" />
                وضع الصيانة مفعّل
              </>
            ) : (
              <>
                <Settings className="ml-2 h-4 w-4" />
                إدارة الصيانة
              </>
            )}
          </Button>
          <Button onClick={() => setCreateDialogOpen(true)} className="bg-gradient-to-r from-emerald-600 to-teal-600">
            <Plus className="ml-2 h-4 w-4" />
            إضافة فرع جديد
          </Button>
        </div>
      </div>

      {/* إحصائيات عامة */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">إجمالي الفروع</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{branchesStats?.length || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">إجمالي الطلبات</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {branchesStats?.reduce((sum: number, b: any) => sum + (b.stats?.totalOrders || 0), 0) || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">إجمالي المندوبين</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {branchesStats?.reduce((sum: number, b: any) => sum + (b.stats?.deliveryPersons || 0), 0) || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">إجمالي الإيرادات</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {branchesStats?.reduce((sum: number, b: any) => sum + (b.stats?.revenue || 0), 0).toLocaleString()} د.ع
            </div>
          </CardContent>
        </Card>
      </div>

      {/* قائمة الفروع */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {branchesStats?.map((branch: any) => (
          <Card key={branch.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl">{branch.name}</CardTitle>
                <Badge variant={branch.isActive ? "default" : "secondary"}>
                  {branch.isActive ? "نشط" : "غير نشط"}
                </Badge>
              </div>
              <CardDescription>كود: {branch.code}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* معلومات الاتصال */}
              {branch.phone && (
                <div className="text-sm text-muted-foreground">
                  📞 {branch.phone}
                </div>
              )}
              {branch.address && (
                <div className="text-sm text-muted-foreground line-clamp-2">
                  📍 {branch.address}
                </div>
              )}

              {/* معلومات الاشتراك */}
              {(branch.subscriptionStartDate || branch.subscriptionEndDate) && (
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    {branch.subscriptionStartDate && (
                      <div>من: {new Date(branch.subscriptionStartDate).toLocaleDateString('ar-IQ')}</div>
                    )}
                    {branch.subscriptionEndDate && (
                      <div>إلى: {new Date(branch.subscriptionEndDate).toLocaleDateString('ar-IQ')}</div>
                    )}
                  </div>
                </div>
              )}

              {/* الإحصائيات */}
              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                <div>
                  <div className="text-2xl font-bold text-emerald-600">{branch.stats?.totalOrders || 0}</div>
                  <div className="text-xs text-muted-foreground">إجمالي الطلبات</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-blue-600">{branch.stats?.deliveredOrders || 0}</div>
                  <div className="text-xs text-muted-foreground">تم التوصيل</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-purple-600">{branch.stats?.deliveryPersons || 0}</div>
                  <div className="text-xs text-muted-foreground">المندوبين</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-orange-600">{branch.stats?.customers || 0}</div>
                  <div className="text-xs text-muted-foreground">العملاء</div>
                </div>
              </div>

              <div className="pt-2 border-t">
                <div className="text-lg font-bold text-green-600">
                  {(branch.stats?.revenue || 0).toLocaleString()} د.ع
                </div>
                <div className="text-xs text-muted-foreground">إجمالي الإيرادات</div>
              </div>
              
              {/* أزرار الإجراءات */}
              <div className="flex gap-2 mt-4">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex-1"
                  onClick={() => handleEditBranch(branch)}
                >
                  <Edit className="w-4 h-4 ml-2" />
                  تعديل
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex-1"
                  onClick={() => loginToBranchMutation.mutate({ branchId: branch.id })}
                  disabled={loginToBranchMutation.isPending}
                >
                  <LogIn className="w-4 h-4 ml-2" />
                  {loginToBranchMutation.isPending ? "جاري الدخول..." : "دخول"}
                </Button>
                <Button 
                  variant="destructive" 
                  size="sm" 
                  onClick={() => {
                    setBranchToDelete(branch);
                    setDeleteDialogOpen(true);
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Dialog لإنشاء فرع جديد */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>إضافة فرع جديد</DialogTitle>
            <DialogDescription>
              أدخل معلومات الفرع الجديد ومعلومات المدير
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">اسم الفرع *</Label>
                <Input
                  id="name"
                  value={newBranch.name}
                  onChange={(e) => setNewBranch({ ...newBranch, name: e.target.value })}
                  placeholder="مثال: فرع السيدية"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="code">كود الفرع *</Label>
                <Input
                  id="code"
                  value={newBranch.code}
                  onChange={(e) => setNewBranch({ ...newBranch, code: e.target.value })}
                  placeholder="مثال: SED"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">العنوان</Label>
              <Input
                id="address"
                value={newBranch.address}
                onChange={(e) => setNewBranch({ ...newBranch, address: e.target.value })}
                placeholder="عنوان الفرع"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">رقم الهاتف</Label>
              <Input
                id="phone"
                value={newBranch.phone}
                onChange={(e) => setNewBranch({ ...newBranch, phone: e.target.value })}
                placeholder="01XXXXXXXXX"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">تاريخ بداية الاشتراك</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={newBranch.subscriptionStartDate}
                  onChange={(e) => setNewBranch({ ...newBranch, subscriptionStartDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">تاريخ انتهاء الاشتراك</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={newBranch.subscriptionEndDate}
                  onChange={(e) => setNewBranch({ ...newBranch, subscriptionEndDate: e.target.value })}
                />
              </div>
            </div>

            <div className="border-t pt-4 mt-4">
              <h3 className="font-semibold mb-4">معلومات مدير الفرع</h3>
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="adminName">اسم المدير *</Label>
                  <Input
                    id="adminName"
                    value={newBranch.adminName}
                    onChange={(e) => setNewBranch({ ...newBranch, adminName: e.target.value })}
                    placeholder="الاسم الكامل"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="adminUsername">اسم المستخدم *</Label>
                  <Input
                    id="adminUsername"
                    value={newBranch.adminUsername}
                    onChange={(e) => setNewBranch({ ...newBranch, adminUsername: e.target.value })}
                    placeholder="username"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="adminPassword">كلمة المرور *</Label>
                  <Input
                    id="adminPassword"
                    type="password"
                    value={newBranch.adminPassword}
                    onChange={(e) => setNewBranch({ ...newBranch, adminPassword: e.target.value })}
                    placeholder="••••••••"
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              إلغاء
            </Button>
            <Button 
              onClick={handleCreateBranch}
              disabled={createBranchMutation.isPending}
              className="bg-gradient-to-r from-emerald-600 to-teal-600"
            >
              {createBranchMutation.isPending ? "جاري الإنشاء..." : "إنشاء الفرع"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Dialog لتعديل الفرع */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>تعديل معلومات الفرع</DialogTitle>
            <DialogDescription>
              تحديث معلومات الفرع والاشتراك
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="editName">اسم الفرع *</Label>
              <Input
                id="editName"
                value={editBranch.name}
                onChange={(e) => setEditBranch({ ...editBranch, name: e.target.value })}
                placeholder="مثال: فرع السيدية"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="editAddress">العنوان</Label>
              <Input
                id="editAddress"
                value={editBranch.address}
                onChange={(e) => setEditBranch({ ...editBranch, address: e.target.value })}
                placeholder="عنوان الفرع"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="editPhone">رقم الهاتف</Label>
              <Input
                id="editPhone"
                value={editBranch.phone}
                onChange={(e) => setEditBranch({ ...editBranch, phone: e.target.value })}
                placeholder="01XXXXXXXXX"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="editStartDate">تاريخ بداية الاشتراك</Label>
                <Input
                  id="editStartDate"
                  type="date"
                  value={editBranch.subscriptionStartDate}
                  onChange={(e) => setEditBranch({ ...editBranch, subscriptionStartDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editEndDate">تاريخ انتهاء الاشتراك</Label>
                <Input
                  id="editEndDate"
                  type="date"
                  value={editBranch.subscriptionEndDate}
                  onChange={(e) => setEditBranch({ ...editBranch, subscriptionEndDate: e.target.value })}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              إلغاء
            </Button>
            <Button 
              onClick={handleUpdateBranch}
              disabled={updateBranchMutation.isPending}
              className="bg-gradient-to-r from-emerald-600 to-teal-600"
            >
              {updateBranchMutation.isPending ? "جاري التحديث..." : "تحديث الفرع"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Dialog لحذف الفرع */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>حذف الفرع</DialogTitle>
            <DialogDescription>
              هل أنت متأكد من حذف الفرع "{branchToDelete?.name}"?
            </DialogDescription>
          </DialogHeader>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm text-yellow-800">
              ⚠️ سيتم حذف الفرع مؤقتاً ويمكن استعادته خلال 30 يوم. بعد ذلك، سيتم حذفه نهائياً.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              إلغاء
            </Button>
            <Button 
              variant="destructive"
              onClick={() => deleteBranchMutation.mutate({ id: branchToDelete?.id })}
              disabled={deleteBranchMutation.isPending}
            >
              {deleteBranchMutation.isPending ? "جاري الحذف..." : "حذف الفرع"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Dialog لإدارة وضع الصيانة */}
      <Dialog open={maintenanceDialogOpen} onOpenChange={setMaintenanceDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>إدارة وضع الصيانة</DialogTitle>
            <DialogDescription>
              تفعيل أو إلغاء وضع الصيانة للموقع
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="maintenanceEnabled">تفعيل وضع الصيانة</Label>
              <input
                id="maintenanceEnabled"
                type="checkbox"
                checked={maintenanceData.isEnabled}
                onChange={(e) => setMaintenanceData({ ...maintenanceData, isEnabled: e.target.checked })}
                className="h-5 w-5 rounded border-gray-300"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="maintenanceMessage">رسالة الصيانة</Label>
              <Input
                id="maintenanceMessage"
                value={maintenanceData.message}
                onChange={(e) => setMaintenanceData({ ...maintenanceData, message: e.target.value })}
                placeholder="الموقع تحت الصيانة حالياً. سنعود قريباً!"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="estimatedEndTime">وقت انتهاء الصيانة المتوقع (اختياري)</Label>
              <Input
                id="estimatedEndTime"
                type="datetime-local"
                value={maintenanceData.estimatedEndTime}
                onChange={(e) => setMaintenanceData({ ...maintenanceData, estimatedEndTime: e.target.value })}
              />
            </div>
            
            {maintenanceData.isEnabled && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                  <div className="text-sm text-yellow-800">
                    <p className="font-semibold">تنبيه:</p>
                    <p>عند تفعيل وضع الصيانة، لن يتمكن المستخدمون من الوصول إلى الموقع. فقط Super Admin يمكنه الدخول.</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setMaintenanceDialogOpen(false)}>
              إلغاء
            </Button>
            <Button 
              onClick={() => {
                updateMaintenanceMutation.mutate({
                  isEnabled: maintenanceData.isEnabled,
                  message: maintenanceData.message,
                  estimatedEndTime: maintenanceData.estimatedEndTime || null,
                });
              }}
              disabled={updateMaintenanceMutation.isPending}
              className={maintenanceData.isEnabled ? "bg-red-600 hover:bg-red-700" : "bg-gradient-to-r from-emerald-600 to-teal-600"}
            >
              {updateMaintenanceMutation.isPending ? "جاري التحديث..." : "حفظ التغييرات"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
