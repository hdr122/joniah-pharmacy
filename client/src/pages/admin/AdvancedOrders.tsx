import { useState } from "react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Loader2, Package, CheckCircle, Clock, XCircle, MapPin, User, Calendar, DollarSign, Image as ImageIcon, Trash2, Eye, RotateCcw, ChevronLeft, ChevronRight } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { formatIraqDateTime, formatIraqDateEN } from "@/lib/utils";

const ORDERS_PER_PAGE = 50;

export default function AdvancedOrders() {
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<any>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [orderDetails, setOrderDetails] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const handleExportExcel = () => {
    if (!orders || orders.length === 0) {
      toast.error("لا توجد طلبات لتصديرها");
      return;
    }

    const worksheetData = [
      ["صيدلية جونيا - تقرير الطلبات"],
      ["التاريخ: " + new Date().toLocaleDateString("ar-IQ")],
      [],
      ["رقم الطلب", "العميل", "المندوب", "المبلغ", "الحالة", "التاريخ"],
    ];

    orders.forEach((order: any) => {
      const statusMap: any = {
        pending: "قيد الانتظار",
        delivered: "تم التسليم",
        postponed: "مؤجل",
        returned: "مرجوع",
        cancelled: "ملغي",
      };

      worksheetData.push([
        order.id,
        order.customerName,
        getUserName(order.deliveryPersonId),
        order.amount + " دينار",
        statusMap[order.status] || order.status,
        formatIraqDateEN(order.createdAt),
      ]);
    });

    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "الطلبات");

    XLSX.writeFile(workbook, `تقرير_الطلبات_${new Date().getTime()}.xlsx`);
    toast.success("تم تصدير Excel بنجاح");
  };

  const offset = (currentPage - 1) * ORDERS_PER_PAGE;
  const { data: orders, isLoading } = trpc.orders.list.useQuery({
    limit: ORDERS_PER_PAGE,
    offset: offset,
  });
  const { data: users } = trpc.users.list.useQuery();
  const utils = trpc.useUtils();
  
  const deleteOrderMutation = trpc.orders.deleteOrder.useMutation({
    onSuccess: () => {
      toast.success("تم حذف الطلب بنجاح");
      setDeleteDialogOpen(false);
      setOrderToDelete(null);
      utils.orders.list.invalidate();
    },
    onError: (error: any) => {
      toast.error(error.message || "فشل حذف الطلب");
    },
  });
  
  const reactivateOrderMutation = trpc.orders.reactivatePostponedOrder.useMutation({
    onSuccess: () => {
      toast.success("تم استعادة الطلب بنجاح - الطلب في انتظار قبول المندوب");
      utils.orders.list.invalidate();
    },
    onError: (error: any) => {
      toast.error(error.message || "فشل استعادة الطلب");
    },
  });
  
  const handleDeleteClick = (order: any) => {
    setOrderToDelete(order);
    setDeleteDialogOpen(true);
  };
  
  const confirmDelete = () => {
    if (orderToDelete) {
      deleteOrderMutation.mutate({ orderId: orderToDelete.id });
    }
  };
  
  const handleReactivateOrder = (orderId: number) => {
    reactivateOrderMutation.mutate({ orderId });
  };
  
  const handleViewDetails = (order: any) => {
    setOrderDetails(order);
    setDetailsDialogOpen(true);
  };

  const deliveredOrders = orders?.filter((o: any) => o.status === "delivered") || [];
  const postponedOrders = orders?.filter((o: any) => o.status === "postponed") || [];
  const returnedOrders = orders?.filter((o: any) => o.status === "returned") || [];
  const cancelledOrders = orders?.filter((o: any) => o.status === "cancelled") || [];
  const pendingOrders = orders?.filter((o: any) => o.status === "pending") || [];

  const getUserName = (userId: number) => {
    const user = users?.find((u: any) => u.id === userId);
    return user?.name || "غير معروف";
  };

  const formatDate = (date: Date | string) => {
    return formatIraqDateTime(date, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("ar-IQ", {
      style: "currency",
      currency: "IQD",
      minimumFractionDigits: 0,
    }).format(price);
  };

  const viewImage = (order: any) => {
    setSelectedOrder(order);
    setImageDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  // حساب عدد الصفحات بناءً على عدد الطلبات المسترجعة
  const hasMoreOrders = orders && orders.length === ORDERS_PER_PAGE;

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">الطلبات المتقدمة</h1>
          <p className="text-gray-600 mt-2">عرض تفصيلي لجميع الطلبات حسب حالتها</p>
        </div>
        <Button
          className="bg-blue-600 hover:bg-blue-700"
          onClick={handleExportExcel}
          disabled={!orders || orders.length === 0}
        >
          <Package className="w-4 h-4 ml-2" />
          تصدير Excel
        </Button>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="all" className="gap-2">
            <Package className="w-4 h-4" />
            الطلبات (صفحة {currentPage})
          </TabsTrigger>
          <TabsTrigger value="pending" className="gap-2">
            <Clock className="w-4 h-4" />
            قيد الانتظار ({pendingOrders.length})
          </TabsTrigger>
          <TabsTrigger value="delivered" className="gap-2">
            <CheckCircle className="w-4 h-4" />
            الطلبات المسلمة ({deliveredOrders.length})
          </TabsTrigger>
          <TabsTrigger value="postponed" className="gap-2">
            <Clock className="w-4 h-4" />
            الطلبات المؤجلة ({postponedOrders.length})
          </TabsTrigger>
          <TabsTrigger value="returned" className="gap-2">
            <XCircle className="w-4 h-4" />
            الطلبات المرجوعة ({returnedOrders.length})
          </TabsTrigger>
          <TabsTrigger value="cancelled" className="gap-2">
            <XCircle className="w-4 h-4" />
            الطلبات الملغية ({cancelledOrders.length})
          </TabsTrigger>
        </TabsList>

        {/* جميع الطلبات */}
        <TabsContent value="all">
          <Card>
            <CardHeader>
              <CardTitle>جميع الطلبات</CardTitle>
              <CardDescription>عرض جميع الطلبات بجميع الحالات (50 طلب في الصفحة)</CardDescription>
            </CardHeader>
            <CardContent>
              {!orders || orders.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Package className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p>لا توجد طلبات</p>
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>رقم الطلب</TableHead>
                        <TableHead>المندوب</TableHead>
                        <TableHead>السعر</TableHead>
                        <TableHead>الحالة</TableHead>
                        <TableHead>التاريخ</TableHead>
                        <TableHead>الصورة</TableHead>
                        <TableHead>الإجراءات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orders.map((order: any) => (
                        <TableRow key={order.id}>
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
                              {formatDate(order.createdAt)}
                            </div>
                          </TableCell>
                          <TableCell>
                            {order.deliveryImage ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => viewImage(order)}
                                className="gap-2"
                              >
                                <ImageIcon className="w-4 h-4" />
                                عرض الصورة
                              </Button>
                            ) : (
                              <span className="text-gray-400">لا توجد صورة</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleViewDetails(order)}
                                className="gap-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                              >
                                <Eye className="w-4 h-4" />
                                تفاصيل
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDeleteClick(order)}
                                className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="w-4 h-4" />
                                حذف
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {/* Pagination Controls */}
                  <div className="flex justify-center items-center gap-2 mt-6">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronRight className="w-4 h-4" />
                      السابق
                    </Button>

                    <span className="text-sm text-gray-600 px-4">
                      صفحة {currentPage}
                    </span>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(currentPage + 1)}
                      disabled={!hasMoreOrders}
                    >
                      التالي
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* الطلبات المعلقة */}
        <TabsContent value="pending">
          <Card>
            <CardHeader>
              <CardTitle>الطلبات المعلقة</CardTitle>
              <CardDescription>الطلبات في انتظار قبول المندوب</CardDescription>
            </CardHeader>
            <CardContent>
              {pendingOrders.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Clock className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p>لا توجد طلبات معلقة</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>رقم الطلب</TableHead>
                      <TableHead>المندوب</TableHead>
                      <TableHead>السعر</TableHead>
                      <TableHead>التاريخ</TableHead>
                      <TableHead>الإجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingOrders.map((order: any) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-medium">#{order.id}</TableCell>
                        <TableCell>{getUserName(order.deliveryPersonId)}</TableCell>
                        <TableCell>{formatPrice(order.price)}</TableCell>
                        <TableCell>{formatDate(order.createdAt)}</TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewDetails(order)}
                            className="gap-2 text-blue-600"
                          >
                            <Eye className="w-4 h-4" />
                            تفاصيل
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* الطلبات المسلمة */}
        <TabsContent value="delivered">
          <Card>
            <CardHeader>
              <CardTitle>الطلبات المسلمة</CardTitle>
              <CardDescription>الطلبات التي تم تسليمها بنجاح</CardDescription>
            </CardHeader>
            <CardContent>
              {deliveredOrders.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <CheckCircle className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p>لا توجد طلبات مسلمة</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>رقم الطلب</TableHead>
                      <TableHead>المندوب</TableHead>
                      <TableHead>السعر</TableHead>
                      <TableHead>التاريخ</TableHead>
                      <TableHead>الإجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deliveredOrders.map((order: any) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-medium">#{order.id}</TableCell>
                        <TableCell>{getUserName(order.deliveryPersonId)}</TableCell>
                        <TableCell>{formatPrice(order.price)}</TableCell>
                        <TableCell>{formatDate(order.createdAt)}</TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewDetails(order)}
                            className="gap-2 text-blue-600"
                          >
                            <Eye className="w-4 h-4" />
                            تفاصيل
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* الطلبات المؤجلة */}
        <TabsContent value="postponed">
          <Card>
            <CardHeader>
              <CardTitle>الطلبات المؤجلة</CardTitle>
              <CardDescription>الطلبات التي تم تأجيلها</CardDescription>
            </CardHeader>
            <CardContent>
              {postponedOrders.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Clock className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p>لا توجد طلبات مؤجلة</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>رقم الطلب</TableHead>
                      <TableHead>المندوب</TableHead>
                      <TableHead>السعر</TableHead>
                      <TableHead>السبب</TableHead>
                      <TableHead>التاريخ</TableHead>
                      <TableHead>الإجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {postponedOrders.map((order: any) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-medium">#{order.id}</TableCell>
                        <TableCell>{getUserName(order.deliveryPersonId)}</TableCell>
                        <TableCell>{formatPrice(order.price)}</TableCell>
                        <TableCell>{order.postponeReason || "—"}</TableCell>
                        <TableCell>{formatDate(order.createdAt)}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleReactivateOrder(order.id)}
                              className="gap-2 text-green-600"
                            >
                              <RotateCcw className="w-4 h-4" />
                              استعادة
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewDetails(order)}
                              className="gap-2 text-blue-600"
                            >
                              <Eye className="w-4 h-4" />
                              تفاصيل
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* الطلبات المرجوعة */}
        <TabsContent value="returned">
          <Card>
            <CardHeader>
              <CardTitle>الطلبات المرجوعة</CardTitle>
              <CardDescription>الطلبات التي تم إرجاعها</CardDescription>
            </CardHeader>
            <CardContent>
              {returnedOrders.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <XCircle className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p>لا توجد طلبات مرجوعة</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>رقم الطلب</TableHead>
                      <TableHead>المندوب</TableHead>
                      <TableHead>السعر</TableHead>
                      <TableHead>السبب</TableHead>
                      <TableHead>التاريخ</TableHead>
                      <TableHead>الإجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {returnedOrders.map((order: any) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-medium">#{order.id}</TableCell>
                        <TableCell>{getUserName(order.deliveryPersonId)}</TableCell>
                        <TableCell>{formatPrice(order.price)}</TableCell>
                        <TableCell>{order.returnReason || "—"}</TableCell>
                        <TableCell>{formatDate(order.createdAt)}</TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewDetails(order)}
                            className="gap-2 text-blue-600"
                          >
                            <Eye className="w-4 h-4" />
                            تفاصيل
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* الطلبات الملغية */}
        <TabsContent value="cancelled">
          <Card>
            <CardHeader>
              <CardTitle>الطلبات الملغية</CardTitle>
              <CardDescription>الطلبات التي تم إلغاؤها</CardDescription>
            </CardHeader>
            <CardContent>
              {cancelledOrders.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <XCircle className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p>لا توجد طلبات ملغية</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>رقم الطلب</TableHead>
                      <TableHead>المندوب</TableHead>
                      <TableHead>السعر</TableHead>
                      <TableHead>التاريخ</TableHead>
                      <TableHead>الإجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cancelledOrders.map((order: any) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-medium">#{order.id}</TableCell>
                        <TableCell>{getUserName(order.deliveryPersonId)}</TableCell>
                        <TableCell>{formatPrice(order.price)}</TableCell>
                        <TableCell>{formatDate(order.createdAt)}</TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewDetails(order)}
                            className="gap-2 text-blue-600"
                          >
                            <Eye className="w-4 h-4" />
                            تفاصيل
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Image Dialog */}
      <Dialog open={imageDialogOpen} onOpenChange={setImageDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>صورة التسليم - الطلب #{selectedOrder?.id}</DialogTitle>
          </DialogHeader>
          {selectedOrder?.deliveryImage && (
            <img
              src={selectedOrder.deliveryImage}
              alt="صورة التسليم"
              className="w-full h-auto rounded-lg"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تأكيد الحذف</DialogTitle>
            <DialogDescription>
              هل أنت متأكد من حذف الطلب #{orderToDelete?.id}؟ لا يمكن التراجع عن هذا الإجراء.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              إلغاء
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteOrderMutation.isPending}
            >
              {deleteOrderMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                  جاري الحذف...
                </>
              ) : (
                "حذف"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Order Details Dialog */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>تفاصيل الطلب #{orderDetails?.id}</DialogTitle>
          </DialogHeader>
          {orderDetails && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">رقم الطلب</p>
                  <p className="font-semibold">#{orderDetails.id}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">الحالة</p>
                  <Badge className={
                    orderDetails.status === "delivered" ? "bg-green-100 text-green-700" :
                    orderDetails.status === "pending" ? "bg-blue-100 text-blue-700" :
                    orderDetails.status === "postponed" ? "bg-orange-100 text-orange-700" :
                    orderDetails.status === "returned" ? "bg-purple-100 text-purple-700" :
                    "bg-red-100 text-red-700"
                  }>
                    {orderDetails.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-gray-600">المندوب</p>
                  <p className="font-semibold">{getUserName(orderDetails.deliveryPersonId)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">المبلغ</p>
                  <p className="font-semibold">{formatPrice(orderDetails.price)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">المنطقة</p>
                  <p className="font-semibold">{orderDetails.regionName || "—"}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">التاريخ</p>
                  <p className="font-semibold">{formatDate(orderDetails.createdAt)}</p>
                </div>
              </div>
              {orderDetails.note && (
                <div>
                  <p className="text-sm text-gray-600">ملاحظات</p>
                  <p className="font-semibold">{orderDetails.note}</p>
                </div>
              )}
              {orderDetails.postponeReason && (
                <div>
                  <p className="text-sm text-gray-600">سبب التأجيل</p>
                  <p className="font-semibold">{orderDetails.postponeReason}</p>
                </div>
              )}
              {orderDetails.returnReason && (
                <div>
                  <p className="text-sm text-gray-600">سبب الإرجاع</p>
                  <p className="font-semibold">{orderDetails.returnReason}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
