import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Trash2, RotateCcw, User, Calendar, DollarSign } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { formatIraqDateEN } from "@/lib/dateUtils";

export default function DeletedOrders() {
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [orderToRestore, setOrderToRestore] = useState<any>(null);

  const { data: deletedOrders, isLoading } = trpc.orders.listDeleted.useQuery();
  const { data: users } = trpc.users.list.useQuery();
  const utils = trpc.useUtils();
  
  const restoreOrderMutation = trpc.orders.restoreOrder.useMutation({
    onSuccess: () => {
      toast.success("تم استعادة الطلب بنجاح");
      setRestoreDialogOpen(false);
      setOrderToRestore(null);
      utils.orders.listDeleted.invalidate();
      utils.orders.list.invalidate();
    },
    onError: (error: any) => {
      toast.error(error.message || "فشل استعادة الطلب");
    },
  });
  
  const handleRestoreClick = (order: any) => {
    setOrderToRestore(order);
    setRestoreDialogOpen(true);
  };
  
  const confirmRestore = () => {
    if (orderToRestore) {
      restoreOrderMutation.mutate({ orderId: orderToRestore.id });
    }
  };

  const getUserName = (userId: number) => {
    const user = users?.find((u: any) => u.id === userId);
    return user?.name || "غير معروف";
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return "غير محدد";
    return formatIraqDateEN(date, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 0,
    }).format(price) + " د.ع";
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">سجل الطلبات المحذوفة</h1>
          <p className="text-gray-600 mt-2">عرض جميع الطلبات المحذوفة مع إمكانية الاستعادة</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-red-600" />
            الطلبات المحذوفة ({deletedOrders?.length || 0})
          </CardTitle>
          <CardDescription>
            هذه الطلبات لا تظهر في الإحصائيات ويمكن استعادتها في أي وقت
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!deletedOrders || deletedOrders.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Trash2 className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>لا توجد طلبات محذوفة</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>رقم الطلب</TableHead>
                  <TableHead>المندوب</TableHead>
                  <TableHead>السعر</TableHead>
                  <TableHead>الحالة الأخيرة</TableHead>
                  <TableHead>تاريخ الحذف</TableHead>
                  <TableHead>حذف بواسطة</TableHead>
                  <TableHead>إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deletedOrders.map((order: any) => (
                  <TableRow key={order.id} className="bg-red-50/30">
                    <TableCell className="font-medium">#{order.id}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-gray-500" />
                        {getUserName(order.deliveryPersonId)}
                      </div>
                    </TableCell>
                    <TableCell>{formatPrice(order.price)}</TableCell>
                    <TableCell>
                      {order.status === "delivered" && (
                        <Badge className="bg-green-100 text-green-700">مسلمة</Badge>
                      )}
                      {order.status === "pending" && (
                        <Badge className="bg-blue-100 text-blue-700">قيد الانتظار</Badge>
                      )}
                      {order.status === "postponed" && (
                        <Badge className="bg-orange-100 text-orange-700">مؤجلة</Badge>
                      )}
                      {order.status === "returned" && (
                        <Badge className="bg-purple-100 text-purple-700">مرجوعة</Badge>
                      )}
                      {order.status === "cancelled" && (
                        <Badge className="bg-red-100 text-red-700">ملغاة</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-500" />
                        {formatDate(order.deletedAt)}
                      </div>
                    </TableCell>
                    <TableCell>
                      {order.deletedBy ? getUserName(order.deletedBy) : "غير معروف"}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRestoreClick(order)}
                        className="gap-2 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                      >
                        <RotateCcw className="w-4 h-4" />
                        استعادة
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog تأكيد الاستعادة */}
      <Dialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تأكيد الاستعادة</DialogTitle>
            <DialogDescription>
              هل أنت متأكد من استعادة الطلب #{orderToRestore?.id}؟ سيتم إرجاعه إلى قائمة الطلبات النشطة.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setRestoreDialogOpen(false)}
              disabled={restoreOrderMutation.isPending}
            >
              إلغاء
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={confirmRestore}
              disabled={restoreOrderMutation.isPending}
            >
              {restoreOrderMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                  جاري الاستعادة...
                </>
              ) : (
                <>
                  <RotateCcw className="w-4 h-4 ml-2" />
                  استعادة
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
