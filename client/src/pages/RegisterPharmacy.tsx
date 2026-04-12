import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Building2, ArrowRight } from "lucide-react";

export default function RegisterPharmacy() {
  const [, setLocation] = useLocation();
  const [formData, setFormData] = useState({
    activationCode: '',
    pharmacyName: '',
    address: '',
    phone: '',
    ownerName: '',
    username: '',
    password: '',
    confirmPassword: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: priceData } = trpc.subscriptions.getPrice.useQuery();
  const registerMutation = trpc.pharmacy.register.useMutation();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.activationCode.trim()) {
      toast.error('الرجاء إدخال كود التفعيل');
      return;
    }

    if (!formData.pharmacyName.trim()) {
      toast.error('الرجاء إدخال اسم الصيدلية');
      return;
    }

    if (!formData.ownerName.trim()) {
      toast.error('الرجاء إدخال اسم المالك');
      return;
    }

    if (formData.username.length < 3) {
      toast.error('اسم المستخدم يجب أن يكون 3 أحرف على الأقل');
      return;
    }

    if (formData.password.length < 6) {
      toast.error('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      toast.error('كلمات المرور غير متطابقة');
      return;
    }

    try {
      setIsSubmitting(true);
      const result = await registerMutation.mutateAsync({
        activationCode: formData.activationCode,
        pharmacyName: formData.pharmacyName,
        address: formData.address,
        phone: formData.phone,
        ownerName: formData.ownerName,
        username: formData.username,
        password: formData.password,
      });

      toast.success('تم إنشاء الصيدلية بنجاح! يمكنك الآن تسجيل الدخول');
      
      // Redirect to login after 2 seconds
      setTimeout(() => {
        setLocation('/login');
      }, 2000);
    } catch (error: any) {
      toast.error(error.message || 'فشل في إنشاء الصيدلية');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center space-y-2">
          <div className="flex justify-center mb-4">
            <div className="bg-emerald-100 dark:bg-emerald-900/30 p-4 rounded-full">
              <Building2 className="h-12 w-12 text-emerald-600 dark:text-emerald-400" />
            </div>
          </div>
          <CardTitle className="text-3xl">إنشاء صيدلية جديدة</CardTitle>
          <CardDescription className="text-base">
            قم بإدخال كود التفعيل ومعلومات الصيدلية لبدء الاشتراك
          </CardDescription>
          {priceData && (
            <div className="bg-emerald-50 dark:bg-emerald-900/20 p-3 rounded-lg mt-4">
              <p className="text-sm text-emerald-700 dark:text-emerald-300">
                سعر الاشتراك السنوي: <span className="font-bold text-lg">${priceData.price}</span>
              </p>
            </div>
          )}
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* كود التفعيل */}
            <div className="space-y-2">
              <Label htmlFor="activationCode" className="text-base font-semibold">
                كود التفعيل *
              </Label>
              <Input
                id="activationCode"
                name="activationCode"
                value={formData.activationCode}
                onChange={handleChange}
                placeholder="SUB-XXXXXXXXX"
                required
                className="text-lg font-mono"
              />
              <p className="text-sm text-muted-foreground">
                الكود الذي حصلت عليه من الإدارة
              </p>
            </div>

            <div className="border-t pt-6">
              <h3 className="font-semibold text-lg mb-4">معلومات الصيدلية</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="pharmacyName">اسم الصيدلية *</Label>
                  <Input
                    id="pharmacyName"
                    name="pharmacyName"
                    value={formData.pharmacyName}
                    onChange={handleChange}
                    placeholder="صيدلية الأمل"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">العنوان</Label>
                  <Input
                    id="address"
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    placeholder="شارع الرئيسي، المدينة"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">رقم الهاتف</Label>
                  <Input
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="07XXXXXXXXX"
                  />
                </div>
              </div>
            </div>

            <div className="border-t pt-6">
              <h3 className="font-semibold text-lg mb-4">معلومات المالك وحساب الإدارة</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="ownerName">اسم المالك *</Label>
                  <Input
                    id="ownerName"
                    name="ownerName"
                    value={formData.ownerName}
                    onChange={handleChange}
                    placeholder="أحمد محمد"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="username">اسم المستخدم *</Label>
                  <Input
                    id="username"
                    name="username"
                    value={formData.username}
                    onChange={handleChange}
                    placeholder="admin_pharmacy"
                    required
                    minLength={3}
                  />
                  <p className="text-sm text-muted-foreground">
                    3 أحرف على الأقل
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">كلمة المرور *</Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="••••••••"
                    required
                    minLength={6}
                  />
                  <p className="text-sm text-muted-foreground">
                    6 أحرف على الأقل
                  </p>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="confirmPassword">تأكيد كلمة المرور *</Label>
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setLocation('/')}
                className="flex-1"
              >
                إلغاء
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="flex-1"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                    جاري الإنشاء...
                  </>
                ) : (
                  <>
                    إنشاء الصيدلية
                    <ArrowRight className="mr-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
