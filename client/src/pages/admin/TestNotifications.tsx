import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Bell, Send } from 'lucide-react';

export default function TestNotifications() {
  const [branchId, setBranchId] = useState<number | null>(null);
  const [userId, setUserId] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  const { data: branches } = trpc.branches.list.useQuery();
  const { data: users } = trpc.users.list.useQuery(
    undefined,
    { enabled: branchId !== null }
  );
  
  const testNotificationMutation = trpc.notificationSettings.testNotification.useMutation({
    onSuccess: () => {
      toast.success('تم إرسال الإشعار التجريبي بنجاح');
      setTitle('');
      setMessage('');
      setIsSending(false);
    },
    onError: (error) => {
      toast.error(`فشل إرسال الإشعار: ${error.message}`);
      setIsSending(false);
    },
  });

  const handleSendNotification = () => {
    if (!branchId || !userId || !title || !message) {
      toast.error('الرجاء ملء جميع الحقول');
      return;
    }

    setIsSending(true);
    testNotificationMutation.mutate({
      branchId,
      userId,
      title,
      message,
    });
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <Bell className="h-8 w-8 text-blue-600" />
        <h1 className="text-3xl font-bold">اختبار الإشعارات</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>إرسال إشعار تجريبي</CardTitle>
          <CardDescription>
            اختبر نظام الإشعارات عن طريق إرسال إشعار تجريبي لأي مندوب في أي فرع
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Branch Selection */}
          <div className="space-y-2">
            <Label htmlFor="branch">الفرع</Label>
            <Select
              value={branchId?.toString() || ''}
              onValueChange={(value) => {
                setBranchId(Number(value));
                setUserId(null); // Reset user when branch changes
              }}
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

          {/* User Selection */}
          <div className="space-y-2">
            <Label htmlFor="user">المندوب</Label>
            <Select
              value={userId?.toString() || ''}
              onValueChange={(value) => setUserId(Number(value))}
              disabled={!branchId}
            >
              <SelectTrigger id="user">
                <SelectValue placeholder={branchId ? 'اختر المندوب' : 'اختر الفرع أولاً'} />
              </SelectTrigger>
              <SelectContent>
                {users
                  ?.filter((user) => user.role === 'delivery')
                  .map((user) => (
                    <SelectItem key={user.id} value={user.id.toString()}>
                      {user.name} ({user.username})
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">عنوان الإشعار</Label>
            <Input
              id="title"
              placeholder="مثال: طلب جديد"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* Message */}
          <div className="space-y-2">
            <Label htmlFor="message">نص الإشعار</Label>
            <Textarea
              id="message"
              placeholder="مثال: لديك طلب جديد #123 في منطقة الكرادة"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
            />
          </div>

          {/* Send Button */}
          <Button
            onClick={handleSendNotification}
            disabled={isSending || !branchId || !userId || !title || !message}
            className="w-full"
            size="lg"
          >
            <Send className="ml-2 h-5 w-5" />
            {isSending ? 'جاري الإرسال...' : 'إرسال الإشعار'}
          </Button>

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
            <p className="text-sm text-blue-800">
              <strong>ملاحظة:</strong> سيتم إرسال الإشعار فقط إذا كان المندوب المحدد قد سجل دخوله إلى النظام
              وسمح بإرسال الإشعارات في متصفحه. تأكد من تفعيل إعدادات OneSignal للفرع المحدد.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
