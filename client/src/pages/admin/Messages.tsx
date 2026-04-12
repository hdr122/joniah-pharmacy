import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Send, Users, User, Loader2 } from "lucide-react";

export default function Messages() {
  const [receiverId, setReceiverId] = useState<number | undefined>(undefined);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: deliveryPersons, isLoading: loadingDelivery } = trpc.users.getDeliveryPersons.useQuery();
  const utils = trpc.useUtils();

  const sendMutation = trpc.messages.send.useMutation({
    onSuccess: () => {
      toast.success("تم إرسال الرسالة بنجاح");
      setTitle("");
      setContent("");
      setReceiverId(undefined);
      setDialogOpen(false);
    },
    onError: (error) => {
      toast.error("فشل إرسال الرسالة: " + error.message);
    },
  });

  const handleSend = () => {
    if (!title.trim() || !content.trim()) {
      toast.error("الرجاء ملء جميع الحقول");
      return;
    }

    sendMutation.mutate({
      receiverId,
      title,
      content,
    });
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">الرسائل</h1>
          <p className="text-gray-600 mt-2">إرسال رسائل إلى المندوبين</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-emerald-600 hover:bg-emerald-700">
              <Send className="w-4 h-4 ml-2" />
              رسالة جديدة
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]" dir="rtl">
            <DialogHeader>
              <DialogTitle>إرسال رسالة جديدة</DialogTitle>
              <DialogDescription>
                اختر المستلم واكتب رسالتك
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>المستلم</Label>
                <Select
                  value={receiverId?.toString() || "all"}
                  onValueChange={(value) => setReceiverId(value === "all" ? undefined : parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="اختر المستلم" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        جميع المندوبين
                      </div>
                    </SelectItem>
                    {deliveryPersons?.map((person: any) => (
                      <SelectItem key={person.id} value={person.id.toString()}>
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4" />
                          {person.name || person.username}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="title">عنوان الرسالة *</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="مثال: تحديث مهم، إجازة، إلخ..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="content">محتوى الرسالة *</Label>
                <Textarea
                  id="content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="اكتب رسالتك هنا..."
                  rows={6}
                />
              </div>

              <div className="flex gap-3">
                <Button
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                  onClick={handleSend}
                  disabled={sendMutation.isPending}
                >
                  {sendMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                      جاري الإرسال...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 ml-2" />
                      إرسال الرسالة
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  إلغاء
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>نصائح لإرسال الرسائل</CardTitle>
          <CardDescription>
            كيفية استخدام نظام الرسائل بفعالية
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
              <Users className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">إرسال لجميع المندوبين</h3>
              <p className="text-sm text-gray-600">
                اختر "جميع المندوبين" لإرسال رسالة جماعية لكل المندوبين النشطين
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
              <User className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">إرسال لمندوب محدد</h3>
              <p className="text-sm text-gray-600">
                اختر مندوباً محدداً لإرسال رسالة خاصة له فقط
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
              <Send className="w-4 h-4 text-purple-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">الإشعارات التلقائية</h3>
              <p className="text-sm text-gray-600">
                سيتلقى المندوبون إشعاراً فورياً عند إرسال رسالة جديدة
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
