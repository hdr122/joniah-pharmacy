import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatNumberWithCommas, removeCommas } from "@/lib/dateUtils";

import { toast } from "sonner";
import { useLocation } from "wouter";
import { Loader2, User, MapPin, Phone, Link as LinkIcon } from "lucide-react";

export default function CreateOrder() {
  const [, setLocation] = useLocation();
  const [phoneSearch, setPhoneSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  
  const [formData, setFormData] = useState({
    // Customer data
    customerId: undefined as number | undefined,
    customerPhone: "",
    customerName: "",
    customerEmail: "",
    customerAddress1: "",
    customerAddress2: "",
    customerLocationUrl1: "",
    customerLocationUrl2: "",

    
    // Order data
    deliveryPersonId: "",
    regionId: "",
    provinceId: "",
    price: "",
    notes: "",
  });

  const utils = trpc.useUtils();
  const { data: deliveries } = trpc.activeDeliveryPersons.list.useQuery();
  const { data: regions } = trpc.regions.list.useQuery();
  const { data: provinces } = trpc.provinces.list.useQuery();
  
  // Search for customer by phone
  const { data: customerSuggestions } = trpc.customers.search.useQuery(
    { query: phoneSearch },
    { enabled: phoneSearch.length >= 3 }
  );

  // تأخير التوجيه للسماح بتحديث البيانات بشكل كامل
  useEffect(() => {
    if (isRedirecting) {
      const timer = setTimeout(() => {
        setLocation("/admin/orders");
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isRedirecting, setLocation]);

  const createMutation = trpc.orders.create.useMutation({
    onSuccess: () => {
      toast.success("تم إضافة الطلب بنجاح");
      // تحديث قائمة الطلبات فوراً لعرض الطلب الجديد في الأعلى
      utils.orders.list.invalidate().then(() => {
        utils.orders.count.invalidate();
        setIsRedirecting(true);
      });
    },
    onError: (error: any) => {
      toast.error(error.message || "فشل إضافة الطلب");
    },
  });

  // Update phoneSearch when customerPhone changes
  useEffect(() => {
    setPhoneSearch(formData.customerPhone);
    if (formData.customerPhone.length >= 3) {
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  }, [formData.customerPhone]);

  // Filter regions by selected province
  const filteredRegions = regions?.filter(
    (r: any) => formData.provinceId && r.provinceId === parseInt(formData.provinceId)
  );

  const handleSelectCustomer = (customer: any) => {
    setSelectedCustomer(customer);
    setFormData({
      ...formData,
      customerId: customer.id,
      customerPhone: customer.phone || "",
      customerName: customer.name || "",
      customerEmail: customer.email || "",
      customerAddress1: customer.address1 || "",
      customerAddress2: customer.address2 || "",
      customerLocationUrl1: customer.locationUrl1 || "",
      customerLocationUrl2: customer.locationUrl2 || "",
      // تعيين المنطقة المفضلة للزبون إذا كانت موجودة
      regionId: customer.regionId ? customer.regionId.toString() : formData.regionId,
    });
    setShowSuggestions(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.deliveryPersonId || !formData.regionId || !formData.price) {
      toast.error("الرجاء إدخال جميع الحقول المطلوبة");
      return;
    }

    createMutation.mutate({
      deliveryPersonId: parseInt(formData.deliveryPersonId),
      regionId: parseInt(formData.regionId),
      price: parseInt(formData.price),
      note: formData.notes || undefined,
      locationLink: formData.customerLocationUrl1 || undefined, // رابط الموقع للطلب
      hidePhoneFromDelivery: 0,
      
      // Customer data
      customerData: {
        phone: formData.customerPhone || undefined,
        name: formData.customerName || undefined,
        email: formData.customerEmail || undefined,
        address1: formData.customerAddress1 || undefined,
        address2: formData.customerAddress2 || undefined,
        locationUrl1: formData.customerLocationUrl1 || undefined,
        locationUrl2: formData.customerLocationUrl2 || undefined,
        // حفظ المنطقة مع بيانات الزبون
        regionId: formData.regionId ? parseInt(formData.regionId) : undefined,
      },
    });
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">إضافة طلب جديد</h1>
        <p className="text-gray-600 mt-2">أدخل تفاصيل الطلب والزبون</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Customer Phone Search - First Priority */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="w-5 h-5 text-emerald-600" />
              رقم هاتف الزبون
            </CardTitle>
            <CardDescription>
              أدخل رقم الهاتف للبحث عن زبون موجود أو إضافة زبون جديد
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Phone Number with Suggestions */}
            <div className="relative">
              <Label htmlFor="customerPhone">
                <Phone className="w-4 h-4 inline ml-2" />
                رقم الهاتف *
              </Label>
              <Input
                id="customerPhone"
                type="tel"
                placeholder="07XXXXXXXXX"
                value={formData.customerPhone}
                onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                className="mt-1 text-lg font-medium"
              />
              
              {/* Customer Suggestions Dropdown */}
              {showSuggestions && customerSuggestions && customerSuggestions.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {customerSuggestions.map((customer: any) => (
                    <button
                      key={customer.id}
                      type="button"
                      onClick={() => handleSelectCustomer(customer)}
                      className="w-full text-right p-3 hover:bg-gray-50 border-b border-gray-100 last:border-0"
                    >
                      <div className="font-medium text-gray-900">{customer.name || "بدون اسم"}</div>
                      <div className="text-sm text-gray-600">{customer.phone}</div>
                      {customer.address1 && (
                        <div className="text-xs text-gray-500 mt-1">{customer.address1}</div>
                      )}
                      {customer.regionName && (
                        <div className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {customer.regionName}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* عرض آخر موقع تسليم للزبون */}
            {selectedCustomer?.lastDeliveryLocation && (
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg border border-emerald-200 dark:border-emerald-800">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
                      <MapPin className="w-4 h-4 inline ml-2" />
                      آخر موقع تسليم لهذا الزبون
                    </p>
                    {selectedCustomer.lastDeliveryAt && (
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                        تاريخ آخر تسليم: {new Date(selectedCustomer.lastDeliveryAt).toLocaleDateString('ar-IQ')}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="default"
                      size="sm"
                      className="bg-blue-600 hover:bg-blue-700"
                      onClick={() => {
                        setFormData(prev => ({
                          ...prev,
                          customerLocationUrl1: selectedCustomer.lastDeliveryLocation || ""
                        }));
                        toast.success("تم إضافة الموقع إلى الطلب");
                      }}
                    >
                      <MapPin className="w-4 h-4 ml-1" />
                      إضافة للطلب
                    </Button>
                    <a
                      href={selectedCustomer.lastDeliveryLocation}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm"
                    >
                      <LinkIcon className="w-4 h-4" />
                      فتح الموقع
                    </a>
                  </div>
                </div>
                {formData.customerLocationUrl1 === selectedCustomer.lastDeliveryLocation && (
                  <p className="text-xs text-blue-600 mt-2 flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    تم إضافة الموقع إلى الطلب
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Order Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-emerald-600" />
              تفاصيل الطلب
            </CardTitle>
            <CardDescription>
              حدد تفاصيل الطلب والمندوب المسؤول
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="regionId">المنطقة *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between mt-1"
                  >
                    {formData.regionId
                      ? regions?.find((r: any) => r.id.toString() === formData.regionId)?.name
                      : "ابحث عن المنطقة..."}
                    <ChevronsUpDown className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0">
                  <Command>
                    <CommandInput placeholder="ابحث عن منطقة..." />
                    <CommandEmpty>لا توجد منطقة بهذا الاسم</CommandEmpty>
                    <CommandGroup className="max-h-64 overflow-auto">
                      {regions?.map((region: any) => (
                        <CommandItem
                          key={region.id}
                          value={region.name}
                          onSelect={() => {
                            setFormData({ ...formData, regionId: region.id.toString() });
                          }}
                        >
                          <Check
                            className={cn(
                              "ml-2 h-4 w-4",
                              formData.regionId === region.id.toString() ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {region.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="deliveryPersonId">المندوب *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between mt-1"
                    >
                      {formData.deliveryPersonId
                        ? deliveries?.find((d: any) => d.id.toString() === formData.deliveryPersonId)?.name
                        : "ابحث عن المندوب..."}
                      <ChevronsUpDown className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0">
                    <Command>
                      <CommandInput placeholder="ابحث عن مندوب..." />
                      <CommandEmpty>لا يوجد مندوب بهذا الاسم</CommandEmpty>
                      <CommandGroup className="max-h-64 overflow-auto">
                        {deliveries?.map((delivery: any) => (
                          <CommandItem
                            key={delivery.id}
                            value={delivery.name}
                            onSelect={() => {
                              setFormData({ ...formData, deliveryPersonId: delivery.id.toString() });
                            }}
                          >
                            <Check
                              className={cn(
                                "ml-2 h-4 w-4",
                                formData.deliveryPersonId === delivery.id.toString() ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {delivery.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div>
                <Label htmlFor="price">السعر (دينار) *</Label>
                <div className="relative mt-1">
                  <Input
                    id="price"
                    type="text"
                    placeholder="250000"
                    value={formatNumberWithCommas(formData.price)}
                    onChange={(e) => {
                      const value = removeCommas(e.target.value);
                      setFormData({ ...formData, price: value });
                    }}
                    className="mt-1 text-lg font-medium"
                  />
                  {formData.price && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 pointer-events-none">
                      د.ع
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="notes">ملاحظات (اختياري)</Label>
              <Textarea
                id="notes"
                placeholder="أي ملاحظات إضافية..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="mt-1"
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Customer Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5 text-emerald-600" />
              معلومات الزبون الإضافية
            </CardTitle>
            <CardDescription>
              بيانات اختيارية للزبون
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="customerName">اسم الزبون (اختياري)</Label>
                <Input
                  id="customerName"
                  placeholder="محمد أحمد"
                  value={formData.customerName}
                  onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="customerEmail">البريد الإلكتروني (اختياري)</Label>
                <Input
                  id="customerEmail"
                  type="email"
                  placeholder="customer@example.com"
                  value={formData.customerEmail}
                  onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="customerAddress1">
                <MapPin className="w-4 h-4 inline ml-2" />
                العنوان الأول (اختياري)
              </Label>
              <Textarea
                id="customerAddress1"
                placeholder="بغداد، الكرادة، شارع..."
                value={formData.customerAddress1}
                onChange={(e) => setFormData({ ...formData, customerAddress1: e.target.value })}
                className="mt-1"
                rows={2}
              />
            </div>

            <div>
              <Label htmlFor="customerAddress2">العنوان الثاني (اختياري)</Label>
              <Textarea
                id="customerAddress2"
                placeholder="عنوان بديل..."
                value={formData.customerAddress2}
                onChange={(e) => setFormData({ ...formData, customerAddress2: e.target.value })}
                className="mt-1"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="locationUrl1">
                  <LinkIcon className="w-4 h-4 inline ml-2" />
                  رابط الموقع الأول (اختياري)
                </Label>
                <Input
                  id="locationUrl1"
                  type="url"
                  placeholder="https://maps.google.com/..."
                  value={formData.customerLocationUrl1}
                  onChange={(e) => setFormData({ ...formData, customerLocationUrl1: e.target.value })}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="locationUrl2">رابط الموقع الثاني (اختياري)</Label>
                <Input
                  id="locationUrl2"
                  type="url"
                  placeholder="https://maps.google.com/..."
                  value={formData.customerLocationUrl2}
                  onChange={(e) => setFormData({ ...formData, customerLocationUrl2: e.target.value })}
                  className="mt-1"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex gap-3 justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => setLocation("/admin/orders")}
          >
            إلغاء
          </Button>
          <Button
            type="submit"
            disabled={createMutation.isPending}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {createMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                جاري الإضافة...
              </>
            ) : (
              "إضافة الطلب"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
