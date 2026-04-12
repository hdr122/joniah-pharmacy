import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { UserPlus, Trash2, Edit, Shield, Eye, Package, Users, MapPin, Settings, BarChart3, UserCog, ChevronDown, ChevronUp } from "lucide-react";

// قائمة الصلاحيات المتاحة مقسمة حسب الفئة
const PERMISSION_CATEGORIES = [
  {
    name: "الطلبات",
    permissions: [
      { id: "view_orders", label: "عرض الطلبات", icon: Eye },
      { id: "add_orders", label: "إضافة الطلبات", icon: Package },
      { id: "edit_orders", label: "تعديل الطلبات", icon: Edit },
      { id: "delete_orders", label: "حذف الطلبات", icon: Trash2 },
    ],
  },
  {
    name: "المندوبين",
    permissions: [
      { id: "view_deliveries", label: "عرض المندوبين", icon: Users },
      { id: "manage_deliveries", label: "إدارة المندوبين", icon: Users },
    ],
  },
  {
    name: "الزبائن",
    permissions: [
      { id: "view_customers", label: "عرض الزبائن", icon: Users },
      { id: "manage_customers", label: "إدارة الزبائن", icon: Users },
    ],
  },
  {
    name: "الإعدادات",
    permissions: [
      { id: "view_settings", label: "عرض الإعدادات", icon: Settings },
      { id: "manage_settings", label: "إدارة الإعدادات", icon: Settings },
    ],
  },
  {
    name: "المستخدمين",
    permissions: [
      { id: "view_users", label: "عرض المستخدمين", icon: UserCog },
      { id: "manage_users", label: "إدارة المستخدمين", icon: UserCog },
    ],
  },
  {
    name: "الإحصائيات",
    permissions: [
      { id: "view_statistics", label: "عرض الإحصائيات", icon: BarChart3 },
    ],
  },
  {
    name: "الخرائط",
    permissions: [
      { id: "view_maps", label: "عرض الخرائط", icon: MapPin },
    ],
  },
];

// قائمة مسطحة للصلاحيات للاستخدام في البحث
const ALL_PERMISSIONS = PERMISSION_CATEGORIES.flatMap(cat => cat.permissions);

export default function UserManagement() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [editName, setEditName] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [giveAllPermissions, setGiveAllPermissions] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<string[]>(PERMISSION_CATEGORIES.map(c => c.name));

  const { data: users, isLoading, refetch } = trpc.users.list.useQuery();
  const createUser = trpc.users.createAdmin.useMutation({
    onSuccess: () => {
      toast.success("تم إنشاء المستخدم بنجاح");
      setIsCreateOpen(false);
      resetForm();
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "فشل إنشاء المستخدم");
    },
  });

  const updateUser = trpc.users.updatePermissions.useMutation({
    onSuccess: () => {
      toast.success("تم تحديث الصلاحيات بنجاح");
      setIsEditOpen(false);
      setEditingUser(null);
      resetForm();
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "فشل تحديث الصلاحيات");
    },
  });

  const deleteUser = trpc.users.delete.useMutation({
    onSuccess: () => {
      toast.success("تم حذف المستخدم بنجاح");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "فشل حذف المستخدم");
    },
  });

  const resetForm = () => {
    setName("");
    setUsername("");
    setPassword("");
    setSelectedPermissions([]);
    setEditName("");
    setEditUsername("");
    setEditPassword("");
    setGiveAllPermissions(false);
    setExpandedCategories(PERMISSION_CATEGORIES.map(c => c.name));
  };

  const handleCreate = () => {
    if (!name || !username || !password) {
      toast.error("يرجى ملء جميع الحقول");
      return;
    }

    const permissions = giveAllPermissions ? ["all"] : selectedPermissions;
    
    createUser.mutate({
      name,
      username,
      password,
      permissions,
    });
  };

  const handleEdit = (user: any) => {
    setEditingUser(user);
    setEditName(user.name || "");
    setEditUsername(user.username || "");
    setEditPassword("");
    const userPerms = user.permissions ? JSON.parse(user.permissions) : [];
    if (userPerms.includes("all")) {
      setGiveAllPermissions(true);
      setSelectedPermissions([]);
    } else {
      setGiveAllPermissions(false);
      setSelectedPermissions(userPerms);
    }
    setExpandedCategories(PERMISSION_CATEGORIES.map(c => c.name));
    setIsEditOpen(true);
  };

  const handleUpdate = () => {
    if (!editingUser) return;

    const permissions = giveAllPermissions ? ["all"] : selectedPermissions;
    
    updateUser.mutate({
      id: editingUser.id,
      name: editName || undefined,
      username: editUsername || undefined,
      password: editPassword || undefined,
      permissions,
    });
  };

  const handleDelete = (userId: number) => {
    if (confirm("هل أنت متأكد من حذف هذا المستخدم؟")) {
      deleteUser.mutate({ id: userId });
    }
  };

  const togglePermission = (permissionId: string) => {
    setSelectedPermissions((prev) =>
      prev.includes(permissionId)
        ? prev.filter((p) => p !== permissionId)
        : [...prev, permissionId]
    );
  };

  const toggleAllPermissions = (checked: boolean) => {
    setGiveAllPermissions(checked);
    if (checked) {
      setSelectedPermissions([]);
    }
  };

  const toggleCategory = (categoryName: string) => {
    setExpandedCategories(prev => 
      prev.includes(categoryName) 
        ? prev.filter(c => c !== categoryName)
        : [...prev, categoryName]
    );
  };

  const selectAllInCategory = (categoryName: string) => {
    const category = PERMISSION_CATEGORIES.find(c => c.name === categoryName);
    if (!category) return;
    
    const categoryPermIds = category.permissions.map(p => p.id);
    const allSelected = categoryPermIds.every(id => selectedPermissions.includes(id));
    
    if (allSelected) {
      setSelectedPermissions(prev => prev.filter(id => !categoryPermIds.includes(id)));
    } else {
      setSelectedPermissions(prev => Array.from(new Set([...prev, ...categoryPermIds])));
    }
  };

  const getUserPermissions = (user: any) => {
    if (!user.permissions) return [];
    try {
      return JSON.parse(user.permissions);
    } catch {
      return [];
    }
  };

  const adminUsers = users?.filter((u: any) => u.role === "admin") || [];

  // مكون عرض الصلاحيات
  const PermissionsSelector = () => (
    <div className="space-y-3">
      {/* خيار جميع الصلاحيات */}
      <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
        <div className="flex items-center gap-2">
          <Checkbox
            id="all-permissions"
            checked={giveAllPermissions}
            onCheckedChange={(checked) => toggleAllPermissions(checked as boolean)}
          />
          <Label
            htmlFor="all-permissions"
            className="flex items-center gap-2 cursor-pointer font-semibold text-amber-700 dark:text-amber-400"
          >
            <Shield className="w-5 h-5" />
            إعطاء جميع الصلاحيات (وصول كامل)
          </Label>
        </div>
      </div>

      {/* الصلاحيات المفصلة */}
      {!giveAllPermissions && (
        <div className="space-y-2 max-h-[50vh] overflow-y-auto">
          {PERMISSION_CATEGORIES.map((category) => {
            const isExpanded = expandedCategories.includes(category.name);
            const categoryPermIds = category.permissions.map(p => p.id);
            const selectedCount = categoryPermIds.filter(id => selectedPermissions.includes(id)).length;
            const allSelected = selectedCount === categoryPermIds.length;
            
            return (
              <div key={category.name} className="border rounded-lg overflow-hidden">
                {/* رأس الفئة */}
                <div 
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                  onClick={() => toggleCategory(category.name)}
                >
                  <div className="flex items-center gap-2">
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    <span className="font-semibold text-gray-700 dark:text-gray-300">{category.name}</span>
                    <Badge variant="secondary" className="text-xs">
                      {selectedCount}/{categoryPermIds.length}
                    </Badge>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-xs h-7"
                    onClick={(e) => {
                      e.stopPropagation();
                      selectAllInCategory(category.name);
                    }}
                  >
                    {allSelected ? "إلغاء الكل" : "تحديد الكل"}
                  </Button>
                </div>
                
                {/* محتوى الفئة */}
                {isExpanded && (
                  <div className="p-3 space-y-2 bg-white dark:bg-gray-900">
                    {category.permissions.map((permission) => {
                      const Icon = permission.icon;
                      return (
                        <div 
                          key={permission.id} 
                          className="flex items-center gap-2 p-2 rounded border hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors"
                        >
                          <Checkbox
                            id={`perm-${permission.id}`}
                            checked={selectedPermissions.includes(permission.id)}
                            onCheckedChange={() => togglePermission(permission.id)}
                          />
                          <Label
                            htmlFor={`perm-${permission.id}`}
                            className="flex items-center gap-2 cursor-pointer text-sm flex-1"
                          >
                            <Icon className="w-4 h-4 text-gray-500" />
                            {permission.label}
                          </Label>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ملخص الصلاحيات المختارة */}
      <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded text-sm text-blue-700 dark:text-blue-400">
        {giveAllPermissions ? (
          <span className="font-medium">✓ سيتم منح جميع الصلاحيات</span>
        ) : selectedPermissions.length === 0 ? (
          <span className="text-gray-500">لم يتم اختيار أي صلاحية</span>
        ) : (
          <span>تم اختيار {selectedPermissions.length} صلاحية</span>
        )}
      </div>
    </div>
  );

  return (
    <div className="p-4 sm:p-6 space-y-6" dir="rtl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">إدارة المستخدمين</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1 text-sm sm:text-base">إضافة وتعديل مستخدمي لوحة الإدارة</p>
        </div>
        
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700 w-full sm:w-auto">
              <UserPlus className="w-4 h-4" />
              إضافة مستخدم جديد
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
            <DialogHeader>
              <DialogTitle>إضافة مستخدم جديد</DialogTitle>
              <DialogDescription>
                أدخل بيانات المستخدم وحدد الصلاحيات المطلوبة
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">الاسم الكامل</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="أدخل الاسم الكامل"
                />
              </div>
              
              <div>
                <Label htmlFor="username">اسم المستخدم</Label>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="أدخل اسم المستخدم"
                />
              </div>
              
              <div>
                <Label htmlFor="password">كلمة المرور</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="أدخل كلمة المرور"
                />
              </div>
              
              <div>
                <Label className="mb-3 block font-semibold">الصلاحيات</Label>
                <PermissionsSelector />
              </div>
              
              <div className="flex gap-2 pt-4">
                <Button
                  onClick={handleCreate}
                  disabled={createUser.isPending}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                >
                  {createUser.isPending ? "جاري الإنشاء..." : "إنشاء المستخدم"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsCreateOpen(false);
                    resetForm();
                  }}
                  className="flex-1"
                >
                  إلغاء
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>قائمة المستخدمين</CardTitle>
          <CardDescription>جميع مستخدمي لوحة الإدارة وصلاحياتهم</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-gray-500">جاري التحميل...</div>
          ) : adminUsers.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>لا يوجد مستخدمون</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الاسم</TableHead>
                    <TableHead className="hidden sm:table-cell">اسم المستخدم</TableHead>
                    <TableHead className="hidden md:table-cell">الصلاحيات</TableHead>
                    <TableHead className="hidden sm:table-cell">الحالة</TableHead>
                    <TableHead>الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {adminUsers.map((user: any) => {
                    const permissions = getUserPermissions(user);
                    const hasAllPermissions = permissions.includes("all");
                    return (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div>
                            <span className="font-medium">{user.name}</span>
                            <span className="block sm:hidden text-xs text-gray-500">{user.username}</span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">{user.username}</TableCell>
                        <TableCell className="hidden md:table-cell">
                          <div className="flex flex-wrap gap-1">
                            {permissions.length === 0 ? (
                              <Badge variant="secondary">لا توجد صلاحيات</Badge>
                            ) : hasAllPermissions ? (
                              <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                <Shield className="w-3 h-3 ml-1" />
                                وصول كامل
                              </Badge>
                            ) : (
                              <>
                                {permissions.slice(0, 2).map((permId: string) => {
                                  const perm = ALL_PERMISSIONS.find((p) => p.id === permId);
                                  return perm ? (
                                    <Badge
                                      key={permId}
                                      className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                                    >
                                      {perm.label}
                                    </Badge>
                                  ) : null;
                                })}
                                {permissions.length > 2 && (
                                  <Badge variant="secondary">
                                    +{permissions.length - 2}
                                  </Badge>
                                )}
                              </>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          {user.isActive ? (
                            <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">نشط</Badge>
                          ) : (
                            <Badge variant="secondary">غير نشط</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 sm:gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEdit(user)}
                              className="gap-1 text-xs sm:text-sm"
                            >
                              <Edit className="w-3 h-3" />
                              <span className="hidden xs:inline">تعديل</span>
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDelete(user.id)}
                              className="gap-1 text-red-600 hover:text-red-700 hover:bg-red-50 text-xs sm:text-sm"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span className="hidden xs:inline">حذف</span>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>تعديل المستخدم</DialogTitle>
            <DialogDescription>
              تعديل بيانات وصلاحيات المستخدم
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* بيانات المستخدم */}
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-4">
              <h4 className="font-semibold text-gray-700 dark:text-gray-300">بيانات المستخدم</h4>
              
              <div>
                <Label htmlFor="editName">الاسم الكامل</Label>
                <Input
                  id="editName"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="أدخل الاسم الكامل"
                />
              </div>
              
              <div>
                <Label htmlFor="editUsername">اسم المستخدم</Label>
                <Input
                  id="editUsername"
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  placeholder="أدخل اسم المستخدم"
                />
              </div>
              
              <div>
                <Label htmlFor="editPassword">كلمة المرور الجديدة</Label>
                <Input
                  id="editPassword"
                  type="password"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  placeholder="اتركه فارغاً للإبقاء على كلمة المرور الحالية"
                />
                <p className="text-xs text-gray-500 mt-1">اترك هذا الحقل فارغاً إذا لم ترد تغيير كلمة المرور</p>
              </div>
            </div>

            {/* الصلاحيات */}
            <div>
              <Label className="mb-3 block font-semibold">الصلاحيات</Label>
              <PermissionsSelector />
            </div>
            
            <div className="flex gap-2 pt-4">
              <Button
                onClick={handleUpdate}
                disabled={updateUser.isPending}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
              >
                {updateUser.isPending ? "جاري التحديث..." : "حفظ التغييرات"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setIsEditOpen(false);
                  setEditingUser(null);
                  resetForm();
                }}
                className="flex-1"
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
