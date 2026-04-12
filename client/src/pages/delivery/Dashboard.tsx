import { useState, useEffect, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { startBackgroundTracking, stopBackgroundTracking, isNativePlatform, requestLocationPermissions } from "@/lib/backgroundLocation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Package, CheckCircle, Clock, XCircle, Loader2, Upload, MapPin, ExternalLink, LogOut, Bell, Navigation, NavigationOff, ChevronDown, Settings, User, Phone, MessageCircle } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { useLocation } from "wouter";

import { ThemeToggle } from "@/components/ThemeToggle";
import { PullToRefresh } from "@/components/PullToRefresh";
import EnableNotificationsModal from "@/components/EnableNotificationsModal";

// دالة لفلترة الطلبات - إخفاء الطلبات بعد الساعة 5 فجراً (بداية اليوم الجديد)
function filterOrdersByTime(orders: any[]) {
  const now = new Date();
  const currentHour = now.getHours();
  
  // إذا كانت الساعة بعد 5 صباحاً، نخفي طلبات الأمس
  if (currentHour >= 5) {
    const todayStart = new Date(now);
    todayStart.setHours(5, 0, 0, 0); // الساعة 5 فجراً اليوم
    
    return orders.filter((order: any) => {
      const orderDate = new Date(order.createdAt);
      return orderDate >= todayStart;
    });
  } else {
    // إذا كانت الساعة قبل 5 صباحاً، نعرض طلبات الأمس (من الساعة 5 فجراً الأمس)
    const yesterdayStart = new Date(now);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    yesterdayStart.setHours(5, 0, 0, 0);
    
    return orders.filter((order: any) => {
      const orderDate = new Date(order.createdAt);
      return orderDate >= yesterdayStart;
    });
  }
}

export default function DeliveryDashboard() {
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [postponeReason, setPostponeReason] = useState("");
  const [returnReason, setReturnReason] = useState("");
  const [deliveryNote, setDeliveryNote] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dialogType, setDialogType] = useState<"deliver" | "postpone" | "return" | "adminNote" | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [requireImage, setRequireImage] = useState(false);
  const [locationTracking, setLocationTracking] = useState(() => {
    const saved = localStorage.getItem("locationTracking");
    // تفعيل التتبع تلقائياً بشكل افتراضي
    return saved === null ? true : saved === "true";
  });
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [previousUnreadCount, setPreviousUnreadCount] = useState(0);
  const [notificationSound, setNotificationSound] = useState(() => {
    return localStorage.getItem("notificationSound") !== "false";
  });
  const trackingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const utils = trpc.useUtils();
  const { data: ordersRaw, isLoading } = trpc.orders.list.useQuery(undefined, {
    refetchInterval: 10000, // تحديث تلقائي كل 10 ثواني
  });
  const { data: user } = trpc.auth.me.useQuery();
  const { data: unreadCount } = trpc.notifications.unreadCount.useQuery();
  const { data: recentNotifications } = trpc.notifications.list.useQuery(undefined, {
    select: (data) => data?.slice(0, 5) || [],
    refetchInterval: 30000,
  });
  
  // فلترة الطلبات حسب الوقت
  const orders = ordersRaw ? filterOrdersByTime(ordersRaw) : [];
  
  const { data: monthlyStats } = trpc.stats.byDeliveryPerson.useQuery(
    { deliveryPersonId: user?.id || 0 },
    { 
      enabled: !!user?.id,
      refetchInterval: 30000, // تحديث تلقائي كل 30 ثانية
    }
  );
  
  useEffect(() => {
    if (unreadCount && unreadCount > previousUnreadCount && previousUnreadCount > 0 && notificationSound) {
      const audio = new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZURE");
      audio.play().catch(() => {});
    }
    setPreviousUnreadCount(unreadCount || 0);
  }, [unreadCount, previousUnreadCount, notificationSound]);
  
  const saveLocationMutation = trpc.gps.saveLocation.useMutation({
    onError: (error) => {
      console.error("Failed to save location:", error);
    },
    onSuccess: () => {
      console.log("Location saved successfully");
    }
  });
  const [, setLocation] = useLocation();
  const [autoStartAttempted, setAutoStartAttempted] = useState(false);

  const toggleLocationTracking = useCallback(async () => {
    if (!locationTracking) {
      console.log("[GPS] Requesting location permission...");
      
      if (!("geolocation" in navigator)) {
        toast.error("المتصفح لا يدعم تحديد الموقع");
        return;
      }
      
      navigator.geolocation.getCurrentPosition(
        (position) => {
          console.log("[GPS] Permission granted");
          setLocationTracking(true);
          localStorage.setItem("locationTracking", "true");
          toast.success("تم تفعيل تتبع الموقع");
        },
        (error) => {
          console.error("[GPS] Permission denied:", error);
          
          switch (error.code) {
            case error.PERMISSION_DENIED:
              toast.error("تم رفض صلاحية الوصول للموقع. يرجى السماح بالوصول من إعدادات المتصفح");
              break;
            case error.POSITION_UNAVAILABLE:
              toast.error("الموقع غير متاح حالياً");
              break;
            case error.TIMEOUT:
              toast.error("انتهت مهلة الحصول على الموقع");
              break;
            default:
              toast.error("فشل الحصول على الموقع");
          }
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    } else {
      console.log("[GPS] Stopping tracking");
      setLocationTracking(false);
      localStorage.setItem("locationTracking", "false");
      toast.success("تم إيقاف تتبع الموقع");
    }
  }, [locationTracking]);

  useEffect(() => {
    if (!user?.id) return;
    if (!locationTracking) return;

    console.log("[GPS] Setting up tracking for user:", user.id);

    const handleLocationUpdate = async (location: { latitude: number; longitude: number; accuracy?: number; speed?: number; heading?: number; altitude?: number; timestamp: number }) => {
      const { latitude, longitude, accuracy, speed, heading, altitude } = location;
      
      setCurrentLocation({ lat: latitude, lng: longitude });

      let batteryLevel: number | undefined;
      if ('getBattery' in navigator) {
        try {
          const battery = await (navigator as any).getBattery();
          batteryLevel = Math.round(battery.level * 100);
        } catch (e) {
          console.warn("[GPS] Could not get battery level");
        }
      }

      console.log("[GPS] Saving location:", { latitude, longitude, accuracy });

      // حفظ الموقع العام للمندوب
      saveLocationMutation.mutate({
        latitude: latitude.toString(),
        longitude: longitude.toString(),
        accuracy: accuracy?.toString(),
        speed: speed?.toString(),
        heading: heading?.toString(),
        battery: batteryLevel?.toString(),
      });
      
      // حفظ نقطة GPS في مسار الطلبات النشطة
      const activeOrders = orders?.filter((order: any) => 
        order.status === 'pending' && order.acceptedAt
      );
      
      if (activeOrders && activeOrders.length > 0) {
        activeOrders.forEach((order: any) => {
          saveRoutePointMutation.mutate({
            orderId: order.id,
            latitude: latitude.toString(),
            longitude: longitude.toString(),
            accuracy: accuracy?.toString(),
            speed: speed?.toString(),
            heading: heading?.toString(),
          });
        });
      }
    };
    
    startBackgroundTracking(
      handleLocationUpdate,
      (error) => {
        console.error("[GPS] Location error:", error);
        toast.error("فشل تتبع الموقع: " + error.message);
      }
    );
    
    console.log("[GPS] Tracking started");
    
    return () => {
      stopBackgroundTracking();
      console.log("[GPS] Tracking stopped");
    };
  }, [locationTracking, user?.id]);

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      window.location.href = "/";
    },
  });

  // Mutation لحفظ نقطة GPS في المسار
  const saveRoutePointMutation = trpc.gps.saveRoutePoint.useMutation();
  
  // إضافة Optimistic Update لقبول الطلب
  const acceptOrderMutation = trpc.orders.acceptOrder.useMutation({
    onMutate: async ({ orderId }) => {
      // إلغاء أي queries قيد التنفيذ
      await utils.orders.list.cancel();
      
      // حفظ البيانات السابقة
      const previousOrders = utils.orders.list.getData();
      
      // تحديث البيانات بشكل optimistic
      utils.orders.list.setData(undefined, (old) => {
        if (!old) return old;
        return old.map((order: any) =>
          order.id === orderId
            ? { ...order, status: "pending", acceptedAt: new Date() }
            : order
        );
      });
      
      return { previousOrders };
    },
    onError: (error: any, variables, context) => {
      // استرجاع البيانات السابقة عند الفشل
      if (context?.previousOrders) {
        utils.orders.list.setData(undefined, context.previousOrders);
      }
      toast.error(error.message || "فشل قبول الطلب");
    },
    onSuccess: (data, variables) => {
      toast.success("تم قبول الطلب بنجاح");
      
      // حفظ نقطة GPS عند قبول الطلب
      if (currentLocation) {
        saveRoutePointMutation.mutate({
          orderId: variables.orderId,
          latitude: currentLocation.lat.toString(),
          longitude: currentLocation.lng.toString(),
        });
      }
    },
    onSettled: () => {
      // إعادة تحميل البيانات من السيرفر
      utils.orders.list.invalidate();
    },
  });

  const rejectOrderMutation = trpc.orders.rejectOrder.useMutation({
    onSuccess: () => {
      toast.success("تم رفض الطلب");
      utils.orders.list.invalidate();
    },
    onError: (error: any) => {
      toast.error(error.message || "فشل رفض الطلب");
    },
  });

  // إضافة Optimistic Update لتسليم الطلب
  const deliverMutation = trpc.orders.uploadDeliveryImage.useMutation({
    onMutate: async ({ orderId }) => {
      await utils.orders.list.cancel();
      const previousOrders = utils.orders.list.getData();
      
      utils.orders.list.setData(undefined, (old) => {
        if (!old) return old;
        return old.map((order: any) =>
          order.id === orderId
            ? { ...order, status: "delivered", deliveredAt: new Date() }
            : order
        );
      });
      
      return { previousOrders };
    },
    onError: (error: any, variables, context) => {
      if (context?.previousOrders) {
        utils.orders.list.setData(undefined, context.previousOrders);
      }
      toast.error(error.message || "فشل تسليم الطلب");
    },
    onSuccess: () => {
      toast.success("تم تسليم الطلب بنجاح");
      setSelectedOrder(null);
      setImageFile(null);
      setDeliveryNote("");
    },
    onSettled: () => {
      utils.orders.list.invalidate();
    },
  });

  const postponeMutation = trpc.orders.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("تم تأجيل الطلب");
      setSelectedOrder(null);
      setPostponeReason("");
      utils.orders.list.invalidate();
    },
    onError: (error: any) => {
      toast.error(error.message || "فشل تأجيل الطلب");
    },
  });

  const returnMutation = trpc.orders.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("تم إرجاع الطلب");
      setSelectedOrder(null);
      setReturnReason("");
      utils.orders.list.invalidate();
    },
    onError: (error: any) => {
      toast.error(error.message || "فشل إرجاع الطلب");
    },
  });

  const sendAdminNoteMutation = trpc.orders.sendAdminNote.useMutation({
    onSuccess: () => {
      toast.success("تم إرسال الملاحظة للإدارة بنجاح");
      setDialogType(null);
      setSelectedOrder(null);
      setAdminNote("");
    },
    onError: (error: any) => {
      toast.error(error.message || "فشل إرسال الملاحظة");
    },
  });

  const handleDeliver = async () => {
    if (requireImage && !imageFile) {
      toast.error("الرجاء رفع صورة الطلب المسلم");
      return;
    }

    setUploading(true);
    
    let deliveryLocationName: string | undefined;
    let deliveryLocationUrl: string | undefined;
    try {
      if (navigator.geolocation) {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 0
          });
        });
        
        deliveryLocationUrl = `https://www.google.com/maps?q=${position.coords.latitude},${position.coords.longitude}`;
        
        const geocoder = new google.maps.Geocoder();
        const result = await geocoder.geocode({
          location: {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          }
        });
        
        if (result.results && result.results.length > 0) {
          deliveryLocationName = result.results[0].formatted_address;
        }
      }
    } catch (geoError) {
      console.warn('Could not get location name:', geoError);
    }
    
    try {
      if (!imageFile) {
        await deliverMutation.mutateAsync({
          orderId: selectedOrder.id,
          imageBase64: undefined,
          deliveryNote: deliveryNote.trim() || undefined,
          deliveryLocationName,
          deliveryLocationUrl,
        });
        setDialogType(null);
        setDeliveryNote("");
        setImageFile(null);
        setRequireImage(false);
        return;
      }
      
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64 = reader.result as string;
          await deliverMutation.mutateAsync({
            orderId: selectedOrder.id,
            imageBase64: base64,
            deliveryNote: deliveryNote.trim() || undefined,
            deliveryLocationName,
            deliveryLocationUrl,
          });
          setDialogType(null);
          setImageFile(null);
        } catch (error: any) {
          console.error("Delivery error:", error);
        } finally {
          setUploading(false);
        }
      };
      reader.onerror = () => {
        toast.error("فشل قراءة الصورة");
        setUploading(false);
      };
      reader.readAsDataURL(imageFile);
    } catch (error: any) {
      console.error("File read error:", error);
      toast.error("حدث خطأ أثناء معالجة الصورة");
      setUploading(false);
    }
  };

  const handlePostpone = () => {
    if (!postponeReason.trim()) {
      toast.error("الرجاء إدخال سبب التأجيل");
      return;
    }

    postponeMutation.mutate({
      orderId: selectedOrder.id,
      status: "postponed",
      postponeReason: postponeReason,
    });
    setDialogType(null);
  };

  const handleReturn = () => {
    if (!returnReason.trim()) {
      toast.error("الرجاء إدخال سبب الإرجاع");
      return;
    }

    returnMutation.mutate({
      orderId: selectedOrder.id,
      status: "returned",
      returnReason: returnReason,
    });
    setDialogType(null);
  };

  const handleRefresh = async () => {
    await utils.orders.list.invalidate();
    await utils.notifications.unreadCount.invalidate();
    await utils.notifications.list.invalidate();
    if (user?.id) {
      await utils.stats.byDeliveryPerson.invalidate();
    }
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      pending_approval: <Badge className="bg-blue-500">في انتظار الموافقة</Badge>,
      pending: <Badge className="bg-yellow-500">قيد التنفيذ</Badge>,
      delivered: <Badge className="bg-green-500">تم التسليم</Badge>,
      postponed: <Badge className="bg-orange-500">مؤجل</Badge>,
      returned: <Badge className="bg-purple-500">مرجوع</Badge>,
    };
    return badges[status as keyof typeof badges] || <Badge>{status}</Badge>;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  const todayStats = {
    total: orders?.length || 0,
    pending: orders?.filter((o: any) => o.status === "pending" || o.status === "pending_approval").length || 0,
    delivered: orders?.filter((o: any) => o.status === "delivered").length || 0,
    postponed: orders?.filter((o: any) => o.status === "postponed").length || 0,
  };
  
  const stats = {
    ...todayStats,
    monthlyDelivered: Array.isArray(monthlyStats) ? monthlyStats[0]?.deliveredOrders || 0 : 0,
  };

  return (
    <PullToRefresh onRefresh={handleRefresh} className="min-h-screen">
      {user && user.branchId && (
        <EnableNotificationsModal userId={user.id} branchId={user.branchId} />
      )}
      
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-gray-900 dark:to-gray-800 p-4 lg:p-8" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header - تصميم جديد */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold">مرحباً {user?.name} 👋</h1>
              <p className="text-emerald-100 mt-2">لوحة تحكم المندوب</p>
            </div>
            <div className="flex gap-3 flex-wrap">
              <ThemeToggle />
              <Button
                variant={locationTracking ? "secondary" : "outline"}
                className={locationTracking 
                  ? "bg-white text-emerald-600 hover:bg-emerald-50" 
                  : "border-white text-white hover:bg-white/10"
                }
                onClick={toggleLocationTracking}
              >
                {locationTracking ? (
                  <>
                    <Navigation className="w-4 h-4 ml-2 animate-pulse" />
                    تتبع نشط
                  </>
                ) : (
                  <>
                    <NavigationOff className="w-4 h-4 ml-2" />
                    تفعيل التتبع
                  </>
                )}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="relative border-white text-white hover:bg-white/10"
                  >
                    <Bell className="w-4 h-4 ml-2" />
                    الإشعارات
                    {(unreadCount || 0) > 0 && (
                      <Badge className="absolute -top-2 -left-2 bg-red-500 text-white px-2 py-0.5 text-xs">
                        {unreadCount}
                      </Badge>
                    )}
                    <ChevronDown className="w-3 h-3 mr-2" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80">
                  {recentNotifications && recentNotifications.length > 0 ? (
                    <>
                      {recentNotifications.map((notif: any) => (
                        <DropdownMenuItem
                          key={notif.id}
                          className="flex flex-col items-start gap-1 p-3 cursor-pointer"
                          onClick={() => setLocation("/delivery/notifications")}
                        >
                          <div className="flex items-center justify-between w-full">
                            <span className="font-semibold text-sm">{notif.title}</span>
                            {!notif.isRead && (
                              <Badge className="bg-emerald-500 text-white text-xs px-1.5 py-0.5">جديد</Badge>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground">{notif.message}</span>
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-center text-emerald-600 font-medium cursor-pointer"
                        onClick={() => setLocation("/delivery/notifications")}
                      >
                        عرض جميع الإشعارات
                      </DropdownMenuItem>
                    </>
                  ) : (
                    <div className="p-4 text-center text-muted-foreground">
                      لا توجد إشعارات جديدة
                    </div>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="border-white text-white hover:bg-white/10">
                    <User className="w-4 h-4 ml-2" />
                    <ChevronDown className="w-3 h-3 mr-2" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setLocation("/delivery/profile")}>
                    <User className="w-4 h-4 ml-2" />
                    الملف الشخصي
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setLocation("/delivery/notification-settings")}>
                    <Settings className="w-4 h-4 ml-2" />
                    إعدادات الإشعارات
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => logoutMutation.mutate()}
                    className="text-red-600"
                  >
                    <LogOut className="w-4 h-4 ml-2" />
                    تسجيل الخروج
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* Statistics - تصميم جديد */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-l-4 border-l-blue-500 hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                <Package className="w-4 h-4" />
                إجمالي الطلبات
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-blue-600">{stats.total}</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-yellow-500 hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                <Clock className="w-4 h-4" />
                قيد التنفيذ
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-yellow-600">{stats.pending}</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-green-500 hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                تم التسليم اليوم
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-green-600">{stats.delivered}</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-emerald-500 hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                <Package className="w-4 h-4" />
                تسليمات الشهر
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-emerald-600">{stats.monthlyDelivered || 0}</p>
            </CardContent>
          </Card>
        </div>

        {/* Orders List - تصميم جديد */}
        <Card className="shadow-lg">
          <CardHeader className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-gray-800 dark:to-gray-700">
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5 text-emerald-600" />
              طلباتي
            </CardTitle>
            <CardDescription>جميع الطلبات المعينة لك</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            {orders && orders.length > 0 ? (
              <div className="space-y-4">
                {orders
                  .filter((order: any) => {
                    // إخفاء الطلبات المسلمة بعد 5 دقائق من التسليم
                    if (order.status === 'delivered' && order.deliveredAt) {
                      const deliveredTime = new Date(order.deliveredAt).getTime();
                      const now = Date.now();
                      const fiveMinutesInMs = 5 * 60 * 1000;
                      return (now - deliveredTime) < fiveMinutesInMs;
                    }
                    return true;
                  })
                  .map((order: any) => {
                  // تحديد ما إذا كان الطلب مقبولاً أم لا
                  const isAccepted = order.status !== "pending_approval";
                  
                  return (
                    <div
                      key={order.id}
                      className="p-5 bg-white dark:bg-gray-800 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-emerald-300 dark:hover:border-emerald-600 hover:shadow-xl transition-all duration-200"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-3">
                            <h3 className="text-xl font-bold text-foreground">طلب #{order.id}</h3>
                            {getStatusBadge(order.status)}
                          </div>
                          <div className="space-y-2 text-sm">
                            {/* المنطقة - تظهر دائماً */}
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <MapPin className="w-4 h-4 text-emerald-600" />
                              <span className="font-medium">{order.regionName} - {order.provinceName}</span>
                            </div>
                            
                            {/* تفاصيل الزبون - تظهر دائماً */}
                                {order.customerName && (
                                  <div className="flex items-center gap-2">
                                    <User className="w-4 h-4 text-blue-600" />
                                    <span><strong>الزبون:</strong> {order.customerName}</span>
                                  </div>
                                )}
                                {order.customerPhone && !order.hidePhoneFromDelivery && (
                                  <div className="space-y-2">
                                    <div dir="ltr" className="text-right flex items-center gap-2">
                                      <Phone className="w-4 h-4 text-green-600" />
                                      <span><strong>الهاتف:</strong> {order.customerPhone}</span>
                                    </div>
                                    <div className="flex gap-2">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="gap-2 text-green-600 border-green-300 hover:bg-green-50"
                                        onClick={() => {
                                          const phone = order.customerPhone.replace(/^0/, '964');
                                          window.open(`https://wa.me/${phone}`, '_blank');
                                        }}
                                      >
                                        <MessageCircle className="w-4 h-4" />
                                        واتساب
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="gap-2 text-blue-600 border-blue-300 hover:bg-blue-50"
                                        onClick={() => {
                                          window.open(`tel:${order.customerPhone}`, '_self');
                                        }}
                                      >
                                        <Phone className="w-4 h-4" />
                                        مكالمة
                                      </Button>
                                    </div>
                                  </div>
                                )}
                                {order.customerAddress1 && (
                                  <div>
                                    <strong>العنوان 1:</strong> {order.customerAddress1}
                                  </div>
                                )}
                                {order.customerAddress2 && (
                                  <div>
                                    <strong>العنوان 2:</strong> {order.customerAddress2}
                                  </div>
                                )}
                                {order.address && (
                                  <div>
                                    <strong>عنوان إضافي:</strong> {order.address}
                                  </div>
                                )}
                          </div>
                        </div>
                        <div className="text-left">
                          <p className="text-2xl font-bold text-emerald-600">
                            {order.price.toLocaleString('en-US')} د.ع
                          </p>
                        </div>
                      </div>

                      {order.note && (
                        <div className="mb-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                          <p className="text-sm text-gray-700 dark:text-gray-300">
                            <strong>ملاحظة:</strong> {order.note}
                          </p>
                        </div>
                      )}

                      {/* روابط الموقع - تظهر دائماً */}
                      <>
                        <div className="mb-4 space-y-2">
                          {order.customerLocationUrl1 && (
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-gray-600 dark:text-gray-400">موقع 1:</span>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="gap-2 text-red-600 border-red-300 hover:bg-red-50"
                                  onClick={() => window.open(order.customerLocationUrl1, '_blank')}
                                >
                                  <MapPin className="w-4 h-4" />
                                  Google Maps
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="gap-2 text-cyan-600 border-cyan-300 hover:bg-cyan-50"
                                  onClick={() => {
                                    const url = order.customerLocationUrl1;
                                    const coordsMatch = url.match(/[?&]q=([\d.-]+),([\d.-]+)/) || url.match(/@([\d.-]+),([\d.-]+)/);
                                    if (coordsMatch) {
                                      window.open(`https://waze.com/ul?ll=${coordsMatch[1]},${coordsMatch[2]}&navigate=yes`, '_blank');
                                    } else {
                                      window.open(`https://waze.com/ul?q=${encodeURIComponent(url)}&navigate=yes`, '_blank');
                                    }
                                  }}
                                >
                                  <Navigation className="w-4 h-4" />
                                  Waze
                                </Button>
                              </div>
                            </div>
                          )}
                          
                          {order.customerLocationUrl2 && (
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-gray-600 dark:text-gray-400">موقع 2:</span>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="gap-2 text-red-600 border-red-300 hover:bg-red-50"
                                  onClick={() => window.open(order.customerLocationUrl2, '_blank')}
                                >
                                  <MapPin className="w-4 h-4" />
                                  Google Maps
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="gap-2 text-cyan-600 border-cyan-300 hover:bg-cyan-50"
                                  onClick={() => {
                                    const url = order.customerLocationUrl2;
                                    const coordsMatch = url.match(/[?&]q=([\d.-]+),([\d.-]+)/) || url.match(/@([\d.-]+),([\d.-]+)/);
                                    if (coordsMatch) {
                                      window.open(`https://waze.com/ul?ll=${coordsMatch[1]},${coordsMatch[2]}&navigate=yes`, '_blank');
                                    } else {
                                      window.open(`https://waze.com/ul?q=${encodeURIComponent(url)}&navigate=yes`, '_blank');
                                    }
                                  }}
                                >
                                  <Navigation className="w-4 h-4" />
                                  Waze
                                </Button>
                              </div>
                            </div>
                          )}
                          
                          {order.locationLink && (
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-gray-600 dark:text-gray-400">موقع إضافي:</span>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="gap-2 text-red-600 border-red-300 hover:bg-red-50"
                                  onClick={() => window.open(order.locationLink, '_blank')}
                                >
                                  <MapPin className="w-4 h-4" />
                                  Google Maps
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="gap-2 text-cyan-600 border-cyan-300 hover:bg-cyan-50"
                                  onClick={() => {
                                    const url = order.locationLink;
                                    const coordsMatch = url.match(/[?&]q=([\d.-]+),([\d.-]+)/) || url.match(/@([\d.-]+),([\d.-]+)/);
                                    if (coordsMatch) {
                                      window.open(`https://waze.com/ul?ll=${coordsMatch[1]},${coordsMatch[2]}&navigate=yes`, '_blank');
                                    } else {
                                      window.open(`https://waze.com/ul?q=${encodeURIComponent(url)}&navigate=yes`, '_blank');
                                    }
                                  }}
                                >
                                  <Navigation className="w-4 h-4" />
                                  Waze
                                </Button>
                              </div>
                            </div>
                          )}
                          
                          {order.customerLastDeliveryLocation && (
                            <div className="flex items-center gap-2 p-2 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg">
                              <span className="text-sm text-emerald-700 dark:text-emerald-300 font-medium">آخر تسليم:</span>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="gap-2 text-red-600 border-red-300 hover:bg-red-50"
                                  onClick={() => window.open(order.customerLastDeliveryLocation, '_blank')}
                                >
                                  <MapPin className="w-4 h-4" />
                                  Google Maps
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="gap-2 text-cyan-600 border-cyan-300 hover:bg-cyan-50"
                                  onClick={() => {
                                    const url = order.customerLastDeliveryLocation;
                                    const coordsMatch = url.match(/[?&]q=([\d.-]+),([\d.-]+)/) || url.match(/@([\d.-]+),([\d.-]+)/);
                                    if (coordsMatch) {
                                      window.open(`https://waze.com/ul?ll=${coordsMatch[1]},${coordsMatch[2]}&navigate=yes`, '_blank');
                                    } else {
                                      window.open(`https://waze.com/ul?q=${encodeURIComponent(url)}&navigate=yes`, '_blank');
                                    }
                                  }}
                                >
                                  <Navigation className="w-4 h-4" />
                                  Waze
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      </>

                      <div className="flex gap-2 mt-4 flex-wrap">
                        {order.status === "pending_approval" && (
                          <>
                            <Button
                              className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-lg"
                              onClick={() => {
                                acceptOrderMutation.mutate({ orderId: order.id });
                              }}
                              disabled={acceptOrderMutation.isPending}
                            >
                              {acceptOrderMutation.isPending ? (
                                <>
                                  <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                                  جاري القبول...
                                </>
                              ) : (
                                <>
                                  <CheckCircle className="w-4 h-4 ml-2" />
                                  قبول الطلب
                                </>
                              )}
                            </Button>
                            <Button
                              variant="outline"
                              className="flex-1 border-red-300 text-red-700 hover:bg-red-50"
                              onClick={() => {
                                rejectOrderMutation.mutate({ orderId: order.id });
                              }}
                            >
                              <XCircle className="w-4 h-4 ml-2" />
                              رفض
                            </Button>
                          </>
                        )}
                        {order.status === "pending" && (
                          <>
                            <Button
                              className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 shadow-lg"
                              onClick={() => {
                                setSelectedOrder(order);
                                setDialogType("deliver");
                              }}
                            >
                              <CheckCircle className="w-4 h-4 ml-2" />
                              تم التسليم
                            </Button>
                            <Button
                              variant="outline"
                              className="flex-1 border-orange-300 text-orange-700 hover:bg-orange-50"
                              onClick={() => {
                                setSelectedOrder(order);
                                setDialogType("postpone");
                              }}
                            >
                              <Clock className="w-4 h-4 ml-2" />
                              تأجيل
                            </Button>
                            <Button
                              variant="outline"
                              className="flex-1 border-purple-300 text-purple-700 hover:bg-purple-50"
                              onClick={() => {
                                setSelectedOrder(order);
                                setDialogType("return");
                              }}
                            >
                              <XCircle className="w-4 h-4 ml-2" />
                              إرجاع
                            </Button>
                          </>
                        )}
                        <Button
                          variant="outline"
                          className="border-blue-300 text-blue-700 hover:bg-blue-50"
                          onClick={() => {
                            setSelectedOrder(order);
                            setDialogType("adminNote");
                          }}
                        >
                          <MessageCircle className="w-4 h-4 ml-2" />
                          ملاحظة للإدارة
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12">
                <Package className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                <p className="text-lg text-muted-foreground">لا توجد طلبات حالياً</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialogs */}
      <Dialog open={dialogType === "deliver"} onOpenChange={(open) => !open && setDialogType(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>تأكيد التسليم</DialogTitle>
            <DialogDescription>
              يرجى رفع صورة الطلب المسلم (اختياري) وإضافة ملاحظة إن وجدت
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>صورة الطلب (اختياري)</Label>
              <div className="mt-2">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setImageFile(e.target.files[0]);
                    }
                  }}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
                />
              </div>
            </div>
            <div>
              <Label>ملاحظة التسليم (اختياري)</Label>
              <Textarea
                value={deliveryNote}
                onChange={(e) => setDeliveryNote(e.target.value)}
                placeholder="أضف ملاحظة حول التسليم..."
                rows={3}
              />
            </div>
            <div className="flex gap-2">
              <Button
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                onClick={handleDeliver}
                disabled={uploading || deliverMutation.isPending}
              >
                {uploading || deliverMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                    جاري التسليم...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 ml-2" />
                    تأكيد التسليم
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setDialogType(null);
                  setImageFile(null);
                  setDeliveryNote("");
                }}
              >
                إلغاء
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogType === "postpone"} onOpenChange={(open) => !open && setDialogType(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تأجيل الطلب</DialogTitle>
            <DialogDescription>
              يرجى إدخال سبب التأجيل
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              value={postponeReason}
              onChange={(e) => setPostponeReason(e.target.value)}
              placeholder="سبب التأجيل..."
              rows={4}
            />
            <div className="flex gap-2">
              <Button
                className="flex-1 bg-orange-600 hover:bg-orange-700"
                onClick={handlePostpone}
                disabled={!postponeReason.trim() || postponeMutation.isPending}
              >
                {postponeMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                    جاري التأجيل...
                  </>
                ) : (
                  <>
                    <Clock className="w-4 h-4 ml-2" />
                    تأكيد التأجيل
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setDialogType(null);
                  setPostponeReason("");
                }}
              >
                إلغاء
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogType === "return"} onOpenChange={(open) => !open && setDialogType(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>إرجاع الطلب</DialogTitle>
            <DialogDescription>
              يرجى إدخال سبب الإرجاع
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
              placeholder="سبب الإرجاع..."
              rows={4}
            />
            <div className="flex gap-2">
              <Button
                className="flex-1 bg-purple-600 hover:bg-purple-700"
                onClick={handleReturn}
                disabled={!returnReason.trim() || returnMutation.isPending}
              >
                {returnMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                    جاري الإرجاع...
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4 ml-2" />
                    تأكيد الإرجاع
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setDialogType(null);
                  setReturnReason("");
                }}
              >
                إلغاء
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogType === "adminNote"} onOpenChange={(open) => !open && setDialogType(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>إرسال ملاحظة للإدارة</DialogTitle>
            <DialogDescription>
              أضف ملاحظة أو استفسار للإدارة حول هذا الطلب
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              placeholder="اكتب ملاحظتك هنا..."
              rows={4}
            />
            <div className="flex gap-2">
              <Button
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                onClick={() => {
                  if (!adminNote.trim()) {
                    toast.error("الرجاء إدخال الملاحظة");
                    return;
                  }
                  sendAdminNoteMutation.mutate({
                    orderId: selectedOrder.id,
                    note: adminNote,
                  });
                }}
                disabled={!adminNote.trim() || sendAdminNoteMutation.isPending}
              >
                {sendAdminNoteMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                    جاري الإرسال...
                  </>
                ) : (
                  <>
                    <MessageCircle className="w-4 h-4 ml-2" />
                    إرسال للإدارة
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setDialogType(null);
                  setSelectedOrder(null);
                  setAdminNote("");
                }}
              >
                إلغاء
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      </div>
    </PullToRefresh>
  );
}
