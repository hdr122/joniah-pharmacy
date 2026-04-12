import { useState, useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Search, Check, ChevronsUpDown, MapPin, User } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface SimpleOrderFormProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function SimpleOrderForm({ open, onClose, onSuccess }: SimpleOrderFormProps) {
  const [phone, setPhone] = useState("");
  const [regionId, setRegionId] = useState<number | null>(null);
  const [address, setAddress] = useState("");
  const [price, setPrice] = useState("");
  const [locationLink, setLocationLink] = useState("");
  const [deliveryPersonId, setDeliveryPersonId] = useState<number | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [foundCustomer, setFoundCustomer] = useState<any>(null);
  const [phoneSuggestions, setPhoneSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  // حالات البحث في المناطق والمندوبين
  const [regionOpen, setRegionOpen] = useState(false);
  const [regionSearch, setRegionSearch] = useState("");
  const [deliveryOpen, setDeliveryOpen] = useState(false);
  const [deliverySearch, setDeliverySearch] = useState("");

  // تحميل البيانات فقط عند فتح النافذة - لتحسين السرعة
  const { data: regions } = trpc.regions.list.useQuery(undefined, { enabled: open });
  const { data: deliveryPersons } = trpc.users.getDeliveryPersons.useQuery(undefined, { enabled: open });
  const utils = trpc.useUtils();

  // فلترة المناطق حسب البحث
  const filteredRegions = useMemo(() => {
    if (!regions) return [];
    if (!regionSearch) return regions;
    return regions.filter((region: any) => 
      region.name.toLowerCase().includes(regionSearch.toLowerCase())
    );
  }, [regions, regionSearch]);

  // فلترة المندوبين حسب البحث
  const filteredDeliveryPersons = useMemo(() => {
    if (!deliveryPersons) return [];
    if (!deliverySearch) return deliveryPersons;
    return deliveryPersons.filter((person: any) => {
      const name = person.name || person.username || "";
      return name.toLowerCase().includes(deliverySearch.toLowerCase());
    });
  }, [deliveryPersons, deliverySearch]);

  // الحصول على اسم المنطقة المختارة
  const selectedRegionName = useMemo(() => {
    if (!regionId || !regions) return "";
    const region = regions.find((r: any) => r.id === regionId);
    return region?.name || "";
  }, [regionId, regions]);

  // الحصول على اسم المندوب المختار
  const selectedDeliveryName = useMemo(() => {
    if (!deliveryPersonId || !deliveryPersons) return "";
    const person = deliveryPersons.find((p: any) => p.id === deliveryPersonId);
    return person?.name || person?.username || "";
  }, [deliveryPersonId, deliveryPersons]);

  const createOrderMutation = trpc.orders.create.useMutation({
    onSuccess: () => {
      toast.success("تم إنشاء الطلب بنجاح");
      // تحديث قائمة الطلبات فوراً
      utils.orders.list.invalidate();
      utils.orders.count.invalidate();
      resetForm();
      onSuccess();
      onClose();
    },
    onError: (error: any) => {
      toast.error(error.message || "فشل إنشاء الطلب");
    },
  });

  const resetForm = () => {
    setPhone("");
    setRegionId(null);
    setAddress("");
    setPrice("");
    setLocationLink("");
    setDeliveryPersonId(null);
    setFoundCustomer(null);
    setRegionSearch("");
    setDeliverySearch("");
  };

  // البحث التلقائي والاقتراحات عند إدخال رقم الهاتف
  useEffect(() => {
    const searchCustomer = async () => {
      if (phone.length >= 3) {
        setIsSearching(true);
        try {
          // استخدام customers.search بدلاً من customers.list لضمان عزل البيانات حسب الفرع
          const customers = await utils.client.customers.search.query({ query: phone });
          
          // البحث عن تطابق تام
          const exactMatch = customers?.find((c: any) => c.phone === phone);
          
          if (exactMatch) {
            setFoundCustomer(exactMatch);
            // ملء البيانات تلقائياً
            if (exactMatch.regionId) setRegionId(exactMatch.regionId);
            if (exactMatch.address1) setAddress(exactMatch.address1);
            if (exactMatch.locationUrl1) setLocationLink(exactMatch.locationUrl1);
            toast.success(`تم العثور على الزبون: ${exactMatch.name || "زبون قديم"}`);
            setShowSuggestions(false);
          } else {
            // عرض جميع نتائج البحث كاقتراحات
            const suggestions = customers?.slice(0, 5) || [];
            
            setPhoneSuggestions(suggestions);
            setShowSuggestions(suggestions.length > 0);
            setFoundCustomer(null);
            
            if (phone.length >= 10 && suggestions.length === 0) {
              toast.info("زبون جديد - يرجى إدخال البيانات");
            }
          }
        } catch (error) {
          console.error("Error searching customer:", error);
        } finally {
          setIsSearching(false);
        }
      } else {
        setPhoneSuggestions([]);
        setShowSuggestions(false);
        setFoundCustomer(null);
      }
    };

    const timer = setTimeout(searchCustomer, 300);
    return () => clearTimeout(timer);
  }, [phone, utils.client.customers.search]);

  // دالة لاختيار رقم من الاقتراحات
  const selectPhoneSuggestion = (customer: any) => {
    setPhone(customer.phone);
    setFoundCustomer(customer);
    if (customer.regionId) setRegionId(customer.regionId);
    if (customer.address1) setAddress(customer.address1);
    if (customer.locationUrl1) setLocationLink(customer.locationUrl1);
    setShowSuggestions(false);
    toast.success(`تم اختيار الزبون: ${customer.name || "زبون قديم"}`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!phone || !regionId || !price || !deliveryPersonId) {
      toast.error("يرجى ملء جميع الحقول المطلوبة");
      return;
    }

    // إنشاء أو تحديث الزبون
    let customerId = foundCustomer?.id;
    
    if (!customerId) {
      try {
        const result = await utils.client.customers.create.mutate({
          phone,
          regionId,
          address1: address || undefined,
          locationUrl1: locationLink || undefined,
        });
        customerId = (result as any).id;
        toast.success("تم حفظ بيانات الزبون الجديد");
      } catch (error) {
        console.error("Error creating customer:", error);
        toast.error("فشل إنشاء بيانات الزبون");
        return;
      }
    } else {
      // تحديث بيانات الزبون إذا تغيرت
      try {
        await utils.client.customers.update.mutate({
          id: customerId,
          regionId,
          address1: address || undefined,
          locationUrl1: locationLink || undefined,
        });
      } catch (error) {
        console.error("Error updating customer:", error);
      }
    }

    // إنشاء الطلب
    createOrderMutation.mutate({
      customerId,
      deliveryPersonId,
      regionId,
      provinceId: 1, // Default province
      price: parseInt(price),
      address: address || undefined,
      locationLink: locationLink || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>إضافة طلب مبسط</DialogTitle>
          <DialogDescription>
            أدخل رقم هاتف الزبون للبحث التلقائي عن بياناته
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* رقم الهاتف */}
          <div className="relative">
            <Label htmlFor="phone">
              رقم هاتف الزبون <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onFocus={() => phoneSuggestions.length > 0 && setShowSuggestions(true)}
                placeholder="07XXXXXXXXX"
                className="mt-2"
                required
              />
              {isSearching && (
                <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-gray-400" />
              )}
            </div>
            
            {/* قائمة الاقتراحات */}
            {showSuggestions && phoneSuggestions.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
                {phoneSuggestions.map((customer) => (
                  <button
                    key={customer.id}
                    type="button"
                    onClick={() => selectPhoneSuggestion(customer)}
                    className="w-full px-4 py-2 text-right hover:bg-gray-100 border-b border-gray-100 last:border-b-0 transition-colors"
                  >
                    <div className="font-medium text-gray-900">{customer.phone}</div>
                    <div className="text-sm text-gray-600">
                      {customer.name || "زبون قديم"} • {customer.region?.name || "بدون منطقة"}
                    </div>
                  </button>
                ))}
              </div>
            )}
            
            {foundCustomer && (
              <p className="text-sm text-green-600 mt-1">
                ✓ زبون موجود: {foundCustomer.name || "زبون قديم"}
              </p>
            )}
          </div>

          {/* المنطقة مع البحث */}
          <div>
            <Label>
              المنطقة <span className="text-red-500">*</span>
            </Label>
            <Popover open={regionOpen} onOpenChange={setRegionOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={regionOpen}
                  className="w-full justify-between mt-2"
                >
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    {selectedRegionName || "اختر المنطقة..."}
                  </div>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0" align="start">
                <Command>
                  <CommandInput 
                    placeholder="ابحث عن منطقة..." 
                    value={regionSearch}
                    onValueChange={setRegionSearch}
                  />
                  <CommandList>
                    <CommandEmpty>لا توجد نتائج</CommandEmpty>
                    <CommandGroup className="max-h-60 overflow-y-auto">
                      {filteredRegions.map((region: any) => (
                        <CommandItem
                          key={region.id}
                          value={region.name}
                          onSelect={() => {
                            setRegionId(region.id);
                            setRegionOpen(false);
                            setRegionSearch("");
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              regionId === region.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {region.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* العنوان */}
          <div>
            <Label htmlFor="address">العنوان</Label>
            <Input
              id="address"
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="أدخل العنوان التفصيلي..."
              className="mt-2"
            />
          </div>

          {/* السعر */}
          <div>
            <Label htmlFor="price">
              السعر (دينار عراقي) <span className="text-red-500">*</span>
            </Label>
            <Input
              id="price"
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0"
              className="mt-2"
              required
              min="0"
            />
          </div>

          {/* رابط الموقع */}
          <div>
            <Label htmlFor="locationLink">رابط الموقع (Google Maps)</Label>
            <Input
              id="locationLink"
              type="url"
              value={locationLink}
              onChange={(e) => setLocationLink(e.target.value)}
              placeholder="https://maps.google.com/..."
              className="mt-2"
            />
          </div>

          {/* المندوب مع البحث */}
          <div>
            <Label>
              المندوب <span className="text-red-500">*</span>
            </Label>
            <Popover open={deliveryOpen} onOpenChange={setDeliveryOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={deliveryOpen}
                  className="w-full justify-between mt-2"
                >
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-muted-foreground" />
                    {selectedDeliveryName || "اختر المندوب..."}
                  </div>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0" align="start">
                <Command>
                  <CommandInput 
                    placeholder="ابحث عن مندوب..." 
                    value={deliverySearch}
                    onValueChange={setDeliverySearch}
                  />
                  <CommandList>
                    <CommandEmpty>لا توجد نتائج</CommandEmpty>
                    <CommandGroup className="max-h-60 overflow-y-auto">
                      {filteredDeliveryPersons.map((person: any) => (
                        <CommandItem
                          key={person.id}
                          value={person.name || person.username}
                          onSelect={() => {
                            setDeliveryPersonId(person.id);
                            setDeliveryOpen(false);
                            setDeliverySearch("");
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              deliveryPersonId === person.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <div className="flex flex-col">
                            <span>{person.name || person.username}</span>
                            {person.name && person.username && (
                              <span className="text-xs text-muted-foreground">@{person.username}</span>
                            )}
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              إلغاء
            </Button>
            <Button
              type="submit"
              disabled={createOrderMutation.isPending}
              className="gap-2"
            >
              {createOrderMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              إنشاء الطلب
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
