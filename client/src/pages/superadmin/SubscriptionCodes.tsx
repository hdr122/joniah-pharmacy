import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Copy, DollarSign } from "lucide-react";

export default function SubscriptionCodes() {
  const [durationType, setDurationType] = useState<'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom'>('monthly');
  const [customDays, setCustomDays] = useState<string>('');
  const [expiresAt, setExpiresAt] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showPriceDialog, setShowPriceDialog] = useState(false);
  const [newPrice, setNewPrice] = useState<string>('');

  const { data: codes, refetch } = trpc.subscriptions.list.useQuery();
  const { data: priceData } = trpc.subscriptions.getPrice.useQuery();
  const generateCode = trpc.subscriptions.generateCode.useMutation();
  const deleteCode = trpc.subscriptions.delete.useMutation();
  const updatePrice = trpc.subscriptions.updatePrice.useMutation();

  const handleGenerate = async () => {
    try {
      setIsGenerating(true);
      const result = await generateCode.mutateAsync({
        durationType,
        customDays: durationType === 'custom' ? parseInt(customDays) : undefined,
        expiresAt: expiresAt || undefined,
      });

      toast.success(`تم توليد الكود بنجاح: ${result.code}`);
      refetch();
      
      // Reset form
      setDurationType('monthly');
      setCustomDays('');
      setExpiresAt('');
    } catch (error: any) {
      toast.error(error.message || 'فشل في توليد الكود');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('هل أنت متأكد من حذف هذا الكود؟')) return;

    try {
      await deleteCode.mutateAsync({ id });
      toast.success('تم حذف الكود بنجاح');
      refetch();
    } catch (error: any) {
      toast.error(error.message || 'فشل في حذف الكود');
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('تم نسخ الكود');
  };

  const handleUpdatePrice = async () => {
    try {
      const price = parseFloat(newPrice);
      if (isNaN(price) || price < 0) {
        toast.error('الرجاء إدخال سعر صحيح');
        return;
      }

      await updatePrice.mutateAsync({ price });
      toast.success('تم تحديث سعر الاشتراك بنجاح');
      setShowPriceDialog(false);
      setNewPrice('');
    } catch (error: any) {
      toast.error(error.message || 'فشل في تحديث السعر');
    }
  };

  const getDurationLabel = (type: string, days: number) => {
    const labels: Record<string, string> = {
      daily: 'يومي',
      weekly: 'أسبوعي',
      monthly: 'شهري',
      yearly: 'سنوي',
      custom: `مخصص (${days} يوم)`,
    };
    return labels[type] || type;
  };

  return (
    <div className="container py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">إدارة كودات الاشتراك</h1>
          <p className="text-muted-foreground mt-2">
            توليد وإدارة كودات تفعيل الاشتراك للصيدليات
          </p>
        </div>
        <Dialog open={showPriceDialog} onOpenChange={setShowPriceDialog}>
          <DialogTrigger asChild>
            <Button variant="outline" onClick={() => setNewPrice(priceData?.price.toString() || '3000')}>
              <DollarSign className="ml-2 h-4 w-4" />
              سعر الاشتراك: ${priceData?.price || 3000}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>تعديل سعر الاشتراك السنوي</DialogTitle>
              <DialogDescription>
                السعر الحالي: ${priceData?.price || 3000}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="price">السعر الجديد (بالدولار)</Label>
                <Input
                  id="price"
                  type="number"
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value)}
                  placeholder="3000"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowPriceDialog(false)}>
                إلغاء
              </Button>
              <Button onClick={handleUpdatePrice} disabled={updatePrice.isPending}>
                {updatePrice.isPending && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                حفظ
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>توليد كود جديد</CardTitle>
          <CardDescription>
            اختر نوع الاشتراك ومدته لتوليد كود تفعيل جديد
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="duration-type">نوع الاشتراك</Label>
              <Select value={durationType} onValueChange={(value: any) => setDurationType(value)}>
                <SelectTrigger id="duration-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">يومي (1 يوم)</SelectItem>
                  <SelectItem value="weekly">أسبوعي (7 أيام)</SelectItem>
                  <SelectItem value="monthly">شهري (30 يوم)</SelectItem>
                  <SelectItem value="yearly">سنوي (365 يوم)</SelectItem>
                  <SelectItem value="custom">مخصص</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {durationType === 'custom' && (
              <div className="space-y-2">
                <Label htmlFor="custom-days">عدد الأيام</Label>
                <Input
                  id="custom-days"
                  type="number"
                  value={customDays}
                  onChange={(e) => setCustomDays(e.target.value)}
                  placeholder="30"
                  min="1"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="expires-at">تاريخ انتهاء صلاحية الكود (اختياري)</Label>
              <Input
                id="expires-at"
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
            </div>
          </div>

          <Button onClick={handleGenerate} disabled={isGenerating || (durationType === 'custom' && !customDays)}>
            {isGenerating ? (
              <>
                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                جاري التوليد...
              </>
            ) : (
              <>
                <Plus className="ml-2 h-4 w-4" />
                توليد كود
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>الكودات المولدة</CardTitle>
          <CardDescription>
            جميع كودات الاشتراك المولدة وحالتها
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الكود</TableHead>
                  <TableHead>النوع</TableHead>
                  <TableHead>المدة</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>مستخدم من قبل</TableHead>
                  <TableHead>تاريخ الإنشاء</TableHead>
                  <TableHead>تاريخ الانتهاء</TableHead>
                  <TableHead className="text-left">الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {codes?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground">
                      لا توجد كودات مولدة بعد
                    </TableCell>
                  </TableRow>
                ) : (
                  codes?.map((code) => (
                    <TableRow key={code.id}>
                      <TableCell className="font-mono">
                        <div className="flex items-center gap-2">
                          {code.code}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCopyCode(code.code)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>{getDurationLabel(code.durationType, code.durationDays)}</TableCell>
                      <TableCell>{code.durationDays} يوم</TableCell>
                      <TableCell>
                        {code.isUsed ? (
                          <Badge variant="secondary">مستخدم</Badge>
                        ) : (
                          <Badge>متاح</Badge>
                        )}
                      </TableCell>
                      <TableCell>{code.branchName || '-'}</TableCell>
                      <TableCell>
                        {new Date(code.createdAt).toLocaleDateString('ar-IQ')}
                      </TableCell>
                      <TableCell>
                        {code.expiresAt ? new Date(code.expiresAt).toLocaleDateString('ar-IQ') : '-'}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(code.id)}
                          disabled={deleteCode.isPending}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
