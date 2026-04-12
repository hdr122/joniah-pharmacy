import { useState, useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, MapPin, User, ChevronsUpDown, DollarSign } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface EditOrderDialogProps {
  order: any | null;
  open: boolean;
  onClose?: () => void;
  onOpenChange?: (open: boolean) => void;
  onSuccess: () => void;
}

export default function EditOrderDialog({ order, open, onClose, onOpenChange, onSuccess }: EditOrderDialogProps) {
  const handleClose = () => {
    if (onClose) onClose();
    if (onOpenChange) onOpenChange(false);
  };
  const [price, setPrice] = useState("");
  const [address, setAddress] = useState("");
  const [locationLink, setLocationLink] = useState("");
  const [deliveryPersonId, setDeliveryPersonId] = useState<number | null>(null);
  const [regionId, setRegionId] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [status, setStatus] = useState<"pending_approval" | "pending" | "delivered" | "postponed" | "cancelled" | "returned" | "">("");
  const [deliveryProfit, setDeliveryProfit] = useState("");
  
  // حالات البحث في المناطق والمندوبين
  const [regionOpen, setRegionOpen] = useState(false);
  const [regionSearch, setRegionSearch] = useState("");
  const [deliveryOpen, setDeliveryOpen] = useState(false);
  const [deliverySearch, setDeliverySearch] = useState("");

  // تحميل البيانات فقط عند فتح النافذة
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

  // ملء البيانات عند فتح النافذة
  useEffect(() => {
    if (order && open) {
      setPrice(order.price?.toString() || "");
      setAddress(order.customerAddress1 || "");
      setLocationLink(order.locationLink || "");
      setDeliveryPersonId(order.deliveryPersonId || null);
      setRegionId(order.regionId || null);
      setNote(order.note || "");
      setCustomerPhone(order.customerPhone || "");
      setCustomerName(order.customerName || "");
      setStatus(order.status || "");
      setDeliveryProfit(order.deliveryProfit?.toString() || "");
    }
  }, [order, open]);

  const updateOrderMutation = trpc.orders.update.useMutation({
    onSuccess: () => {
      toast.success("تم تعديل الطلب بنجاح");
      utils.orders.list.invalidate();
      utils.orders.count.invalidate();
      onSuccess();
      handleClose();
    },
    onError: (error: any) => {
      toast.error(error.message || "فشل تعديل الطلب");
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!order) return;

    if (!price || !deliveryPersonId || !regionId) {
      toast.error("يرجى ملء جميع الحقول المطلوبة");
      return;
    }

    updateOrderMutation.mutate({
      orderId: order.id,
      price: parseInt(price),
      deliveryPersonId,
      regionId,
      address: address || undefined,
      locationLink: locationLink || undefined,
      note: note || undefined,
      customerPhone: customerPhone || undefined,
      customerName: customerName || undefined,
      status: status || undefined,
      deliveryProfit: deliveryProfit ? parseInt(deliveryProfit) : undefined,
      customerData: order.customerId ? {
        address1: address || undefined,
        locationUrl1: locationLink || undefined,
        name: customerName || undefined,
      } : undefined,
    });
  };

  const resetForm = () => {
    setPrice("");
    setAddress("");
    setLocationLink("");
    setDeliveryPersonId(null);
    setRegionId(null);
    setNote("");
    setCustomerPhone("");
    setCustomerName("");
    setStatus("");
    setDeliveryProfit("");
    setRegionSearch("");
    setDeliverySearch("");
  };

  const handleCloseDialog = () => {
    resetForm();
    handleClose();
  };

  if (!order) return null;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) handleCloseDialog(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
            تعديل الطلب #{order.id}
          </DialogTitle>
          <DialogDescription>
            قم بتعديل بيانات الطلب أدناه
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* معلومات الزبون */}
          <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950 dark:to-cyan-950 p-4 rounded-xl border-2 border-blue-200 dark:border-blue-800 space-y-3">
            <h3 className="font-bold text-blue-800 dark:text-blue-200 mb-2">معلومات الزبون</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="customerName" className="text-sm text-blue-700 dark:text-blue-300">اسم الزبون</Label>
                <Input
                  id="customerName"
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="اسم الزبون"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="customerPhone" className="text-sm text-blue-700 dark:text-blue-300">رقم الهاتف</Label>
                <Input
                  id="customerPhone"
                  type="text"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="07XXXXXXXXX"
                  className="mt-1 font-mono"
                />
              </div>
            </div>
          </div>

          {/* السعر */}
          <div>
            <Label htmlFor="price">
              السعر (دينار) <span className="text-red-500">*</span>
            </Label>
            <Input
              id="price"
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="مثال: 25000"
              className="mt-2"
              required
            />
          </div>

          {/* حالة الطلب */}
          <div>
            <Label htmlFor="status">
              حالة الطلب <span className="text-red-500">*</span>
            </Label>
            <Select value={status} onValueChange={(value: any) => setStatus(value)}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="اختر حالة الطلب" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending_approval">قيد الانتظار/القبول</SelectItem>
                <SelectItem value="pending">قيد التسليم</SelectItem>
                <SelectItem value="delivered">تم التسليم</SelectItem>
                <SelectItem value="postponed">مؤجل</SelectItem>
                <SelectItem value="returned">مرتجع</SelectItem>
                <SelectItem value="cancelled">ملغي</SelectItem>
              </SelectContent>
            </Select>
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
                    <CommandGroup>
                      {filteredDeliveryPersons.map((person: any) => (
                        <CommandItem
                          key={person.id}
                          value={person.name || person.username}
                          onSelect={() => {
                            setDeliveryPersonId(person.id);
                            setDeliveryOpen(false);
                          }}
                        >
                          <div className="flex items-center gap-2">
                            {person.profileImage ? (
                              <img
                                src={person.profileImage}
                                alt={person.name || person.username}
                                className="w-6 h-6 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-emerald-400 to-teal-400 flex items-center justify-center">
                                <User className="w-3 h-3 text-white" />
                              </div>
                            )}
                            <span>{person.name || person.username}</span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
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
                    <CommandGroup>
                      {filteredRegions.map((region: any) => (
                        <CommandItem
                          key={region.id}
                          value={region.name}
                          onSelect={() => {
                            setRegionId(region.id);
                            setRegionOpen(false);
                          }}
                        >
                          <MapPin className="w-4 h-4 ml-2 text-muted-foreground" />
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
            <Label htmlFor="address">عنوان التسليم</Label>
            <Input
              id="address"
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="مثال: حي الجامعة، شارع 10"
              className="mt-2"
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

          {/* ملاحظات */}
          <div>
            <Label htmlFor="note">ملاحظات</Label>
            <Input
              id="note"
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="أي ملاحظات إضافية..."
              className="mt-2"
            />
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={updateOrderMutation.isPending}
            >
              إلغاء
            </Button>
            <Button
              type="submit"
              disabled={updateOrderMutation.isPending}
              className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white"
            >
              {updateOrderMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                  جاري الحفظ...
                </>
              ) : (
                "حفظ التعديلات"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
