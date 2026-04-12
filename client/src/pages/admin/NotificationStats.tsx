import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { BarChart3, TrendingUp, CheckCircle2, XCircle, Loader2, Bell } from 'lucide-react';

export default function NotificationStats() {
  const [branchId, setBranchId] = useState<number | null>(null);

  const { data: branches } = trpc.branches.list.useQuery();
  const { data: stats, isLoading: statsLoading } = trpc.notificationSettings.getStats.useQuery(
    { branchId: branchId! },
    { enabled: branchId !== null }
  );
  const { data: logs, isLoading: logsLoading } = trpc.notificationSettings.getLogs.useQuery(
    { branchId: branchId!, limit: 50 },
    { enabled: branchId !== null }
  );

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex items-center gap-3 mb-6">
        <BarChart3 className="h-8 w-8 text-blue-600" />
        <h1 className="text-3xl font-bold">إحصائيات الإشعارات</h1>
      </div>

      {/* Branch Selection */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>اختر الفرع</CardTitle>
          <CardDescription>عرض إحصائيات الإشعارات لفرع معين</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="branch">الفرع</Label>
            <Select
              value={branchId?.toString() || ''}
              onValueChange={(value) => setBranchId(Number(value))}
            >
              <SelectTrigger id="branch">
                <SelectValue placeholder="اختر الفرع" />
              </SelectTrigger>
              <SelectContent>
                {branches?.map((branch) => (
                  <SelectItem key={branch.id} value={branch.id.toString()}>
                    {branch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      {branchId && (
        <>
          {statsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : stats ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">إجمالي الإرسالات</CardTitle>
                    <Bell className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.totalSent}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      إشعار تم إرساله
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">الإرسالات الناجحة</CardTitle>
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">{stats.successCount}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      نجح في الإرسال
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">الإرسالات الفاشلة</CardTitle>
                    <XCircle className="h-4 w-4 text-red-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-red-600">{stats.failedCount}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      فشل في الإرسال
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">معدل النجاح</CardTitle>
                    <TrendingUp className="h-4 w-4 text-blue-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-600">{stats.successRate}%</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      من إجمالي الإرسالات
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Logs Table */}
              <Card>
                <CardHeader>
                  <CardTitle>سجل الإشعارات</CardTitle>
                  <CardDescription>آخر 50 إشعار تم إرساله</CardDescription>
                </CardHeader>
                <CardContent>
                  {logsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                    </div>
                  ) : logs && logs.length > 0 ? (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>التاريخ</TableHead>
                            <TableHead>العنوان</TableHead>
                            <TableHead>الرسالة</TableHead>
                            <TableHead>المستقبلين</TableHead>
                            <TableHead>الحالة</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {logs.map((log) => (
                            <TableRow key={log.id}>
                              <TableCell className="whitespace-nowrap">
                                {new Date(log.createdAt).toLocaleString('ar-IQ', { hour12: false, timeZone: 'Asia/Baghdad' })}
                              </TableCell>
                              <TableCell className="font-semibold">{log.title}</TableCell>
                              <TableCell className="max-w-xs truncate">{log.message}</TableCell>
                              <TableCell>{log.recipientCount}</TableCell>
                              <TableCell>
                                {log.status === 'success' ? (
                                  <Badge variant="default" className="bg-green-600">
                                    <CheckCircle2 className="h-3 w-3 ml-1" />
                                    نجح
                                  </Badge>
                                ) : (
                                  <Badge variant="destructive">
                                    <XCircle className="h-3 w-3 ml-1" />
                                    فشل
                                  </Badge>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      لا توجد سجلات إشعارات حتى الآن
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          ) : null}
        </>
      )}
    </div>
  );
}
