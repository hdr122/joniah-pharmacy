import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Package, ShoppingCart, Check, Calendar } from 'lucide-react';

export default function Store() {
  const [activationCode, setActivationCode] = useState('');
  const [showActivation, setShowActivation] = useState(false);

  const { data: products = [] } = trpc.store.list.useQuery();
  const { data: purchases = [] } = trpc.store.myPurchases.useQuery();
  const { data: subscriptions = [] } = trpc.store.mySubscriptions.useQuery();

  const purchaseMutation = trpc.store.purchase.useMutation({
    onSuccess: (data) => {
      toast.success(`تم الشراء بنجاح! كود التفعيل: ${data?.activationCode || ''}`);
    },
  });

  const activateMutation = trpc.store.activate.useMutation({
    onSuccess: () => {
      toast.success('تم تفعيل الاشتراك بنجاح!');
      setShowActivation(false);
      setActivationCode('');
    },
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">المتجر</h1>
          <p className="text-muted-foreground">المنتجات والاشتراكات المتاحة</p>
        </div>
        <Button onClick={() => setShowActivation(true)}>
          <Check className="ml-2 h-4 w-4" />
          تفعيل اشتراك
        </Button>
      </div>

      {subscriptions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>الاشتراكات الفعالة</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {subscriptions.map((sub: any) => (
                <div key={sub.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">{sub.product?.name}</p>
                    <p className="text-sm text-muted-foreground">
                      ينتهي في: {new Date(sub.expiresAt).toLocaleDateString('ar-IQ')}
                    </p>
                  </div>
                  <Badge className="bg-green-100 text-green-700">فعّال</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {products.map((product: any) => (
          <Card key={product.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <Package className="h-8 w-8 text-primary" />
                <Badge variant={product.type === 'subscription' ? 'default' : 'secondary'}>
                  {product.type === 'subscription' ? 'اشتراك' : 'منتج'}
                </Badge>
              </div>
              <CardTitle className="mt-4">{product.name}</CardTitle>
              <CardDescription>{product.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold">{product.price} د.ع</span>
                  {product.type === 'subscription' && (
                    <span className="text-sm text-muted-foreground">
                      <Calendar className="inline h-4 w-4 ml-1" />
                      {product.durationMonths} شهر
                    </span>
                  )}
                </div>
                <Button className="w-full" onClick={() => purchaseMutation.mutate({ productId: product.id, price: product.price })}>
                  <ShoppingCart className="ml-2 h-4 w-4" />
                  شراء الآن
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {purchases.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>مشترياتي</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {purchases.map((purchase: any) => (
                <div key={purchase.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">{purchase.product?.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(purchase.purchasedAt).toLocaleDateString('ar-IQ')}
                    </p>
                  </div>
                  <div className="text-left">
                    <p className="font-mono text-sm">{purchase.activationCode}</p>
                    <Badge variant={purchase.isUsed ? 'secondary' : 'default'}>
                      {purchase.isUsed ? 'مستخدم' : 'غير مستخدم'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={showActivation} onOpenChange={setShowActivation}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تفعيل اشتراك</DialogTitle>
            <DialogDescription>أدخل كود التفعيل الذي حصلت عليه بعد الشراء</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="أدخل كود التفعيل"
              value={activationCode}
              onChange={(e) => setActivationCode(e.target.value)}
            />
            <div className="flex gap-2">
              <Button className="flex-1" onClick={() => activateMutation.mutate({ activationCode })}>
                تفعيل
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => setShowActivation(false)}>
                إلغاء
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
