import { useRoute, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, User, Phone, Mail, MapPin, ExternalLink, Package, DollarSign, Calendar, ArrowRight } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatIraqDateEN } from "@/lib/dateUtils";

export default function CustomerDetails() {
  const [, params] = useRoute("/admin/customers/:id");
  const [, setLocation] = useLocation();
  const customerId = params?.id ? parseInt(params.id) : 0;
  
  const { data: customer, isLoading: customerLoading } = trpc.customers.getById.useQuery(
    { id: customerId },
    { enabled: customerId > 0 }
  );
  
  const { data: orders, isLoading: ordersLoading } = trpc.customers.getOrders.useQuery(
    { customerId },
    { enabled: customerId > 0 }
  );
  
  const { data: stats } = trpc.customers.getStats.useQuery(
    { customerId },
    { enabled: customerId > 0 }
  );
  
  const formatDate = (date: Date | string | null) => {
    if (!date) return "غير محدد";
    return formatIraqDateEN(date, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };
  
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 0,
    }).format(price) + " د.ع";
  };
  
  const handleGoBack = () => {
    setLocation("/admin/customers");
  };
  
  if (customerLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }
  
  if (!customer) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="text-center py-12">
            <p className="text-gray-500">الزبون غير موجود</p>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">سجل الزبون</h1>
          <p className="text-gray-600 mt-2">تفاصيل الزبون وسجل طلباته</p>
        </div>
        <Button
          variant="outline"
          onClick={handleGoBack}
          className="gap-2"
        >
          <ArrowRight className="w-4 h-4" />
          رجوع
        </Button>
      </div>

      {/* Customer Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5 text-emerald-600" />
            معلومات الزبون
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">الاسم</p>
              <p className="font-medium">{customer.name || "غير محدد"}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">رقم الهاتف</p>
              <p className="font-medium flex items-center gap-2">
                {customer.phone ? (
                  <>
                    <Phone className="w-4 h-4 text-gray-500" />
                    {customer.phone}
                  </>
                ) : (
                  "غير محدد"
                )}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">البريد الإلكتروني</p>
              <p className="font-medium flex items-center gap-2">
                {customer.email ? (
                  <>
                    <Mail className="w-4 h-4 text-gray-500" />
                    {customer.email}
                  </>
                ) : (
                  "غير محدد"
                )}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">تاريخ التسجيل</p>
              <p className="font-medium flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-500" />
                {formatDate(customer.createdAt)}
              </p>
            </div>
          </div>
          
          {customer.address1 && (
            <div>
              <p className="text-sm text-gray-600">العنوان الأول</p>
              <p className="font-medium flex items-center gap-2">
                <MapPin className="w-4 h-4 text-gray-500" />
                {customer.address1}
              </p>
            </div>
          )}
          
          {customer.address2 && (
            <div>
              <p className="text-sm text-gray-600">العنوان الثاني</p>
              <p className="font-medium flex items-center gap-2">
                <MapPin className="w-4 h-4 text-gray-500" />
                {customer.address2}
              </p>
            </div>
          )}
          
          {customer.locationUrl1 && (
            <div>
              <p className="text-sm text-gray-600">رابط الموقع الأول</p>
              <a
                href={customer.locationUrl1}
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-600 hover:underline flex items-center gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                فتح الموقع
              </a>
            </div>
          )}
          
          {customer.locationUrl2 && (
            <div>
              <p className="text-sm text-gray-600">رابط الموقع الثاني</p>
              <a
                href={customer.locationUrl2}
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-600 hover:underline flex items-center gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                فتح الموقع
              </a>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Statistics */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Package className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">إجمالي الطلبات</p>
                  <p className="text-2xl font-bold">{stats.totalOrders}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <Package className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">الطلبات المسلمة</p>
                  <p className="text-2xl font-bold">{stats.deliveredOrders}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                  <Package className="w-6 h-6 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">الطلبات المؤجلة</p>
                  <p className="text-2xl font-bold">{stats.postponedOrders}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">إجمالي الإنفاق</p>
                  <p className="text-xl font-bold">{formatPrice(stats.totalSpent)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Orders History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-emerald-600" />
            سجل الطلبات ({orders?.length || 0})
          </CardTitle>
          <CardDescription>جميع طلبات الزبون</CardDescription>
        </CardHeader>
        <CardContent>
          {ordersLoading ? (
            <div className="text-center py-8">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-emerald-600" />
            </div>
          ) : !orders || orders.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Package className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>لا توجد طلبات</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>رقم الطلب</TableHead>
                  <TableHead>السعر</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>المندوب</TableHead>
                  <TableHead>التاريخ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order: any) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">#{order.id}</TableCell>
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
                      {order.status === "cancelled" && (
                        <Badge className="bg-red-100 text-red-700">ملغاة</Badge>
                      )}
                      {order.status === "returned" && (
                        <Badge className="bg-purple-100 text-purple-700">مرجوعة</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {order.deliveryPersonName ? (
                        <span className="text-sm font-medium">{order.deliveryPersonName}</span>
                      ) : (
                        <span className="text-sm text-gray-400">غير محدد</span>
                      )}
                    </TableCell>
                    <TableCell>{formatDate(order.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
