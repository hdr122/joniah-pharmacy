import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Package } from 'lucide-react';

export default function SuperAdminStore() {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    type: 'product' as 'product' | 'subscription',
    durationMonths: 1,
  });

  const { data: products = [], refetch } = trpc.store.list.useQuery();
  const createMutation = trpc.store.create.useMutation({
    onSuccess: () => {
      toast.success('تم إضافة المنتج بنجاح');
      setShowForm(false);
      setFormData({ name: '', description: '', price: '', type: 'product', durationMonths: 1 });
      refetch();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">إدارة المتجر</h1>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="ml-2 h-4 w-4" />
          إضافة منتج
        </Button>
      </div>

      {showForm && (
        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              placeholder="اسم المنتج"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
            <Textarea
              placeholder="الوصف"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
            <Input
              type="number"
              placeholder="السعر"
              value={formData.price}
              onChange={(e) => setFormData({ ...formData, price: e.target.value })}
              required
            />
            <Select value={formData.type} onValueChange={(v: any) => setFormData({ ...formData, type: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="product">منتج</SelectItem>
                <SelectItem value="subscription">اشتراك</SelectItem>
              </SelectContent>
            </Select>
            {formData.type === 'subscription' && (
              <Input
                type="number"
                placeholder="مدة الاشتراك (بالأشهر)"
                value={formData.durationMonths}
                onChange={(e) => setFormData({ ...formData, durationMonths: parseInt(e.target.value) })}
              />
            )}
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'جاري الحفظ...' : 'حفظ'}
            </Button>
          </form>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {products.map((product: any) => (
          <Card key={product.id} className="p-4">
            <div className="flex items-start gap-3">
              <Package className="h-8 w-8 text-primary" />
              <div className="flex-1">
                <h3 className="font-bold">{product.name}</h3>
                <p className="text-sm text-muted-foreground">{product.description}</p>
                <p className="text-lg font-bold mt-2">{product.price} د.ع</p>
                {product.type === 'subscription' && (
                  <p className="text-sm text-muted-foreground">مدة: {product.durationMonths} شهر</p>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
