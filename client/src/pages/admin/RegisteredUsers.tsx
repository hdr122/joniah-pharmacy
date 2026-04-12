import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Users, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

export default function RegisteredUsers() {
  const [branchId, setBranchId] = useState<number | null>(null);

  const { data: branches } = trpc.branches.list.useQuery();
  const { data: users, isLoading } = trpc.users.list.useQuery(
    undefined,
    { enabled: branchId !== null }
  );

  // Filter delivery users only
  const deliveryUsers = users?.filter(u => u.role === 'delivery') || [];

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="flex items-center gap-3 mb-6">
        <Users className="h-8 w-8 text-blue-600" />
        <h1 className="text-3xl font-bold">المستخدمون المسجلون في OneSignal</h1>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>فحص تسجيل المندوبين</CardTitle>
          <CardDescription>
            تحقق من المندوبين الذين فعّلوا الإشعارات وسجلوا أنفسهم في OneSignal
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Branch Selection */}
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

            {/* Users Table */}
            {branchId && (
              <div className="mt-6">
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                  </div>
                ) : deliveryUsers.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    لا يوجد مندوبون في هذا الفرع
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>المعرف</TableHead>
                        <TableHead>الاسم</TableHead>
                        <TableHead>البريد الإلكتروني</TableHead>
                        <TableHead>الحالة</TableHead>
                        <TableHead>ملاحظات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {deliveryUsers.map((user) => {
                        // Check if user is registered (this is a placeholder - actual check would query OneSignal API)
                        const isRegistered = false; // TODO: Implement actual check
                        
                        return (
                          <TableRow key={user.id}>
                            <TableCell className="font-mono">{user.id}</TableCell>
                            <TableCell className="font-semibold">{user.name}</TableCell>
                            <TableCell>{user.email || '-'}</TableCell>
                            <TableCell>
                              {isRegistered ? (
                                <Badge variant="default" className="bg-green-600">
                                  <CheckCircle2 className="h-4 w-4 ml-1" />
                                  مسجل
                                </Badge>
                              ) : (
                                <Badge variant="secondary">
                                  <XCircle className="h-4 w-4 ml-1" />
                                  غير مسجل
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-gray-600">
                              {isRegistered 
                                ? 'المستخدم فعّل الإشعارات بنجاح'
                                : 'لم يقم المستخدم بتفعيل الإشعارات بعد'
                              }
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>كيفية تفعيل الإشعارات</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <p className="font-semibold">على المندوب اتباع الخطوات التالية:</p>
            <ol className="list-decimal list-inside space-y-2 mr-4">
              <li>فتح لوحة التحكم الخاصة به</li>
              <li>الضغط على زر "تفعيل الإشعارات" في النافذة المنبثقة</li>
              <li>منح إذن الإشعارات من المتصفح</li>
              <li>سيتم تسجيله تلقائياً في OneSignal</li>
            </ol>
            <p className="text-gray-600 mt-4">
              <strong>ملاحظة:</strong> يجب على المندوب تفعيل الإشعارات لكي يستقبل إشعارات الطلبات الجديدة والرسائل.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
