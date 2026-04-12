import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Activity, Users, MapPin, Clock, TrendingUp } from "lucide-react";

export default function TraccarStats() {
  const { data: stats, isLoading } = trpc.gps.getTraccarStats.useQuery();

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-64"></div>
          <div className="grid gap-4 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const activeDeliveries = stats?.deliveries.filter(d => d.isOnline) || [];
  const inactiveDeliveries = stats?.deliveries.filter(d => !d.isOnline) || [];

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">إحصائيات Traccar</h1>
        <p className="text-muted-foreground mt-2">
          معلومات مباشرة عن حالة تتبع المندوبين
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">المندوبين المتصلين</CardTitle>
            <Activity className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {activeDeliveries.length}
            </div>
            <p className="text-xs text-muted-foreground">
              من إجمالي {stats?.totalDeliveries || 0} مندوب
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">المندوبين غير المتصلين</CardTitle>
            <Users className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {inactiveDeliveries.length}
            </div>
            <p className="text-xs text-muted-foreground">
              لم يرسلوا موقعهم مؤخراً
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">إجمالي المسافة اليوم</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {stats?.totalDistanceToday?.toFixed(1) || 0} كم
            </div>
            <p className="text-xs text-muted-foreground">
              المسافة المقطوعة لجميع المندوبين
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Active Deliveries Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-green-600" />
            المندوبين المتصلين ({activeDeliveries.length})
          </CardTitle>
          <CardDescription>
            المندوبين الذين أرسلوا موقعهم خلال آخر 5 دقائق
          </CardDescription>
        </CardHeader>
        <CardContent>
          {activeDeliveries.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>المندوب</TableHead>
                  <TableHead>آخر تحديث</TableHead>
                  <TableHead>الموقع</TableHead>
                  <TableHead>السرعة</TableHead>
                  <TableHead>المسافة اليوم</TableHead>
                  <TableHead>الحالة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeDeliveries.map((delivery) => (
                  <TableRow key={delivery.userId}>
                    <TableCell className="font-medium">{delivery.username}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        {delivery.lastUpdate}
                      </div>
                    </TableCell>
                    <TableCell>
                      {delivery.latitude && delivery.longitude ? (
                        <a
                          href={`https://www.google.com/maps?q=${delivery.latitude},${delivery.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-blue-600 hover:underline"
                        >
                          <MapPin className="h-4 w-4" />
                          عرض على الخريطة
                        </a>
                      ) : (
                        <span className="text-muted-foreground">غير متوفر</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {delivery.speed ? `${delivery.speed} كم/س` : "-"}
                    </TableCell>
                    <TableCell>
                      {delivery.distanceToday ? `${delivery.distanceToday.toFixed(1)} كم` : "-"}
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-green-500">متصل</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              لا يوجد مندوبين متصلين حالياً
            </div>
          )}
        </CardContent>
      </Card>

      {/* Inactive Deliveries Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-orange-600" />
            المندوبين غير المتصلين ({inactiveDeliveries.length})
          </CardTitle>
          <CardDescription>
            المندوبين الذين لم يرسلوا موقعهم خلال آخر 5 دقائق
          </CardDescription>
        </CardHeader>
        <CardContent>
          {inactiveDeliveries.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>المندوب</TableHead>
                  <TableHead>آخر تحديث</TableHead>
                  <TableHead>الحالة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inactiveDeliveries.map((delivery) => (
                  <TableRow key={delivery.userId}>
                    <TableCell className="font-medium">{delivery.username}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        {delivery.lastUpdate || "لم يرسل أبداً"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="border-orange-500 text-orange-700">
                        غير متصل
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              جميع المندوبين متصلين
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
