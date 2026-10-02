import { useState, useEffect, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { startBackgroundTracking, stopBackgroundTracking, isNativePlatform, requestLocationPermissions } from "@/lib/backgroundLocation";
import { enqueueLocation, enqueueRoutePoint, flushQueue, startAutoFlush, getPendingCounts, appendTrackPoint } from "@/lib/offlineQueue";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Package, CheckCircle, Clock, XCircle, Loader2, Upload, MapPin, ExternalLink, LogOut, Bell, Navigation, NavigationOff, ChevronDown, Settings, User, Phone, MessageCircle, Image as ImageIcon, Download } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { useLocation } from "wouter";

import { ThemeToggle } from "@/components/ThemeToggle";
import { PullToRefresh } from "@/components/PullToRefresh";
import EnableNotificationsModal from "@/components/EnableNotificationsModal";
import OrderLocationPreview from "@/components/OrderLocationPreview";
import { compressImage } from "@/lib/imageCompress";

// حالات الطلب المنتهية — هذه وحدها تُخفى مع انتهاء يوم العمل.
const FINISHED_STATUSES = ["delivered", "returned", "cancelled"];

// بداية يوم العمل (5 فجراً) بالتوقيت المحلي للجهاز.
function businessDayStart(now: Date = new Date()): Date {
  const start = new Date(now);
  start.setHours(5, 0, 0, 0);
  if (now.getHours() < 5) start.setDate(start.getDate() - 1);
  return start;
}

// فلترة طلبات المندوب.
//
// ⚠️ مهم: الطلبات غير المكتملة (بانتظار الموافقة / قيد التوصيل / مؤجلة) تبقى ظاهرة
// دائماً مهما كان عمرها. كانت النسخة السابقة تُخفي كل طلب أُنشئ قبل 5 فجر اليوم،
// فتختفي طلبات الأمس غير المكتملة من صفحة المندوب ولا يستطيع إنهاءها أبداً —
// وتختفي أيضاً أمام عينيه عند تجاوز الحدّ الزمني حتى بعد التحديث.
function filterOrdersByTime(orders: any[]) {
  const dayStart = businessDayStart().getTime();

  return orders.filter((order: any) => {
    if (!FINISHED_STATUSES.includes(order.status)) return true; // غير مكتمل ⇒ يظهر دائماً

    const finishedAtRaw = order.deliveredAt || order.updatedAt || order.createdAt;
    const finishedAt = finishedAtRaw ? new Date(finishedAtRaw).getTime() : NaN;
    // تاريخ غير صالح ⇒ نُبقي الطلب ظاهراً بدل إخفائه بالخطأ
    if (!Number.isFinite(finishedAt)) return true;
    return finishedAt >= dayStart;
  });
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
  const [pendingSync, setPendingSync] = useState(0);
  const [ordersView, setOrdersView] = useState<"home" | "log">("home"); // الرئيسية (جديدة/حالية) أو سجل اليوم
  const [previewOrder, setPreviewOrder] = useState<any>(null); // معاينة موقع الطلب على الخريطة
  const [imageOrderId, setImageOrderId] = useState<number | null>(null); // معاينة صورة الطلب
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
  // ملخّص التسليمات: اليوم (يُصفَّر عند ساعة بدء اليوم) + الشهر (يبقى حتى نهاية الشهر)
  const { data: riderSummary } = trpc.stats.riderSummary.useQuery(undefined, {
    enabled: !!user?.id,
    refetchInterval: 30000,
  });
  // معرّفات الطلبات التي لها صورة مرفقة — لعرض زر «عرض الصورة»
  const { data: imageIds } = trpc.orders.myImages.useQuery(undefined, {
    enabled: !!user?.id,
    refetchInterval: 30000,
  });
  const imageSet = new Set<number>(imageIds || []);
  
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

  // المزامنة التلقائية للنقاط المخزّنة محلياً تبدأ فور دخول المندوب،
  // وتُفرّغ ما تراكم أثناء انقطاع الإنترنت حتى لو لم يكن التتبّع مفعّلاً الآن.
  useEffect(() => {
    if (user?.role !== "delivery") return;
    startAutoFlush();
    getPendingCounts().then((c) => setPendingSync(c.total)).catch(() => {});
  }, [user?.role]);

  const toggleLocationTracking = useCallback(async () => {
    if (!locationTracking) {
      console.log("[GPS] Requesting location permission...");

      // على التطبيق الأصلي (أندرويد): اطلب صلاحية الموقع في الخلفية وابدأ خدمة
      // المقدّمة (foreground service) ذات الإشعار الدائم عبر إضافة التتبّع الخلفي.
      if (isNativePlatform()) {
        const granted = await requestLocationPermissions();
        if (!granted) {
          toast.error("نحتاج صلاحية الموقع «طوال الوقت» ليستمر التتبّع والجهاز مقفل. فعّلها من إعدادات التطبيق.");
          return;
        }
        setLocationTracking(true);
        localStorage.setItem("locationTracking", "true");
        toast.success("بدأ العمل — التتبّع يعمل حتى والجهاز مقفل");
        return;
      }

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
      // أفرغ ما تبقّى في الطابور عند إيقاف العمل
      flushQueue().then(() => getPendingCounts().then((c) => setPendingSync(c.total))).catch(() => {});
      toast.success("تم إيقاف العمل وتتبع الموقع");
    }
  }, [locationTracking, user?.role]);

  useEffect(() => {
    if (!user?.id) return;
    if (!locationTracking) return;

    console.log("[GPS] Setting up tracking for user:", user.id);

    const handleLocationUpdate = async (location: { latitude: number; longitude: number; accuracy?: number; speed?: number; heading?: number; altitude?: number; timestamp: number }) => {
      const { latitude, longitude, accuracy, speed, heading, altitude } = location;
      
      setCurrentLocation({ lat: latitude, lng: longitude });
      // سجّل النقطة في مسار العرض على الخريطة (يبقى محلياً حتى بلا إنترنت)
      appendTrackPoint({ lat: latitude, lng: longitude, t: location.timestamp || Date.now() }).catch(() => {});

      let batteryLevel: number | undefined;
      if ('getBattery' in navigator) {
        try {
          const battery = await (navigator as any).getBattery();
          batteryLevel = Math.round(battery.level * 100);
        } catch (e) {
          console.warn("[GPS] Could not get battery level");
        }
      }

      const recordedAt = new Date(location.timestamp || Date.now()).toISOString();
      console.log("[GPS] Buffering location:", { latitude, longitude, accuracy });

      // 1) خزّن الموقع محلياً أولاً — لا يضيع مهما انقطع الإنترنت أو أُغلق التطبيق
      await enqueueLocation({
        latitude: latitude.toString(),
        longitude: longitude.toString(),
        accuracy: accuracy?.toString(),
        speed: speed?.toString(),
        heading: heading?.toString(),
        battery: batteryLevel?.toString(),
        recordedAt,
      });

      // 2) خزّن نقطة المسار لكل طلب نشط محلياً أيضاً
      const activeOrders = orders?.filter((order: any) =>
        order.status === 'pending' && order.acceptedAt
      );
      if (activeOrders && activeOrders.length > 0) {
        for (const order of activeOrders) {
          await enqueueRoutePoint({
            orderId: order.id,
            latitude: latitude.toString(),
            longitude: longitude.toString(),
            accuracy: accuracy?.toString(),
            speed: speed?.toString(),
            heading: heading?.toString(),
            recordedAt,
          });
        }
      }

      // 3) حاول الإرسال فوراً (إن كان هناك إنترنت) — وإلّا يبقى في الطابور ويُرسل لاحقاً
      flushQueue().then((r) => {
        if (r.sentLocations || r.sentRoutePoints) {
          getPendingCounts().then((c) => setPendingSync(c.total));
        } else {
          getPendingCounts().then((c) => setPendingSync(c.total));
        }
      }).catch(() => {});
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
      
      // Shrink before upload: proof photos are embedded in the database
      const { base64, mimeType } = await compressImage(imageFile);
      await deliverMutation.mutateAsync({
        orderId: selectedOrder.id,
        imageBase64: `data:${mimeType};base64,${base64}`,
        deliveryNote: deliveryNote.trim() || undefined,
        deliveryLocationName,
        deliveryLocationUrl,
      });
      setDialogType(null);
      setImageFile(null);
      setUploading(false);
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
        <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
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
    // تسليمات اليوم تُصفَّر عند ساعة بدء اليوم (إعداد المدير)، وتسليمات الشهر تبقى حتى نهاية الشهر
    delivered: riderSummary?.todayDelivered ?? todayStats.delivered,
    monthlyDelivered: riderSummary?.monthDelivered ?? (Array.isArray(monthlyStats) ? monthlyStats[0]?.deliveredOrders || 0 : 0),
  };

  // بطاقة طلب واحدة — تُستخدم في أقسام الرئيسية وفي سجل اليوم
  const renderOrderCard = (order: any) => {

                  // تحديد ما إذا كان الطلب مقبولاً أم لا
                  const isAccepted = order.status !== "pending_approval";
                  // طلب متأخّر: أُنشئ قبل يوم العمل الحالي ولم يُنجز بعد
                  const createdTs = new Date(order.createdAt).getTime();
                  const isOverdue =
                    !FINISHED_STATUSES.includes(order.status) &&
                    Number.isFinite(createdTs) &&
                    createdTs < businessDayStart().getTime();

                  return (
                    <div
                      key={order.id}
                      className={`p-5 bg-white dark:bg-gray-800 rounded-xl border-2 hover:shadow-xl transition-all duration-200 ${
                        isOverdue
                          ? "border-amber-400 dark:border-amber-500/60"
                          : "border-gray-200 dark:border-gray-700 hover:border-violet-300 dark:hover:border-violet-600"
                      }`}
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-3">
                            <h3 className="text-xl font-bold text-foreground">طلب #{order.id}</h3>
                            {order.status !== "pending_approval" && (
                              <Button type="button" size="sm" variant="outline"
                                className="h-7 border-violet-300 text-violet-700 dark:text-violet-300 dark:border-violet-700"
                                onClick={() => setPreviewOrder(order)}>
                                <MapPin className="w-3.5 h-3.5 ml-1" /> معاينة الموقع
                              </Button>
                            )}
                            {imageSet.has(order.id) && (
                              <Button type="button" size="sm" variant="outline"
                                className="h-7 border-fuchsia-300 text-fuchsia-700 dark:text-fuchsia-300 dark:border-fuchsia-700"
                                onClick={() => setImageOrderId(order.id)}>
                                <ImageIcon className="w-3.5 h-3.5 ml-1" /> عرض الصورة
                              </Button>
                            )}
                            {getStatusBadge(order.status)}
                            {isOverdue && (
                              <Badge className="bg-amber-500 text-white border-0">
                                <Clock className="w-3 h-3 ml-1" />
                                طلب سابق غير مكتمل
                              </Badge>
                            )}
                          </div>
                          <div className="space-y-2 text-sm">
                            {/* المنطقة - تظهر دائماً */}
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <MapPin className="w-4 h-4 text-violet-600" />
                              <span className="font-medium">{order.regionName} - {order.provinceName}</span>
                            </div>
                            
                            {/* تفاصيل الزبون - تظهر دائماً */}
                                {order.customerName && (
                                  <div className="flex items-center gap-2">
                                    <User className="w-4 h-4 text-blue-600" />
                                    <span><strong>الزبون:</strong> {order.customerName}</span>
                                  </div>
                                )}
                                {(order.customerPhone || order.customerWaUsername) && !order.hidePhoneFromDelivery && (
                                  <div className="space-y-2">
                                    <div dir="ltr" className="text-right flex items-center gap-2">
                                      <Phone className="w-4 h-4 text-green-600" />
                                      {order.customerPhone
                                        ? <span><strong>الهاتف:</strong> {order.customerPhone}</span>
                                        : <span><strong>يوزر واتساب:</strong> {order.customerWaUsername}</span>}
                                    </div>
                                    <div className="flex gap-2">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="gap-2 text-green-600 border-green-300 hover:bg-green-50"
                                        onClick={() => {
                                          const url = order.customerPhone
                                            ? `https://wa.me/${order.customerPhone.replace(/^0/, '964')}`
                                            : `https://wa.me/${encodeURIComponent(order.customerWaUsername || '')}`;
                                          window.open(url, '_blank');
                                        }}
                                      >
                                        <MessageCircle className="w-4 h-4" />
                                        واتساب
                                      </Button>
                                      {order.customerPhone && (
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
                                      )}
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
                        <div className="text-left shrink-0">
                          <p className="text-2xl font-bold text-violet-600">
                            {(order.price - (order.discount || 0)).toLocaleString('en-US')} د.ع
                          </p>
                          {(order.discount || 0) > 0 && (
                            <p className="text-xs text-muted-foreground mt-0.5 whitespace-nowrap">
                              <span className="line-through">{order.price.toLocaleString('en-US')}</span>
                              <span className="text-emerald-600 dark:text-emerald-400 font-semibold mr-1">
                                خصم {order.discount.toLocaleString('en-US')}
                              </span>
                            </p>
                          )}
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
                            <div className="flex items-center gap-2 p-2 bg-violet-50 dark:bg-violet-950/30 rounded-lg">
                              <span className="text-sm text-violet-700 dark:text-violet-300 font-medium">آخر تسليم:</span>
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
                              className="flex-1 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 shadow-lg"
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
                              className="flex-1 bg-gradient-to-r from-green-600 to-violet-600 hover:from-green-700 hover:to-violet-700 shadow-lg"
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
  };

  return (
    <>
    <PullToRefresh onRefresh={handleRefresh} className="min-h-screen">
      {user && user.branchId && (
        <EnableNotificationsModal userId={user.id} branchId={user.branchId} />
      )}

      <OrderLocationPreview order={previewOrder} open={!!previewOrder} onClose={() => setPreviewOrder(null)} />

      <Dialog open={imageOrderId !== null} onOpenChange={(o) => !o && setImageOrderId(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>صورة الطلب #{imageOrderId}</DialogTitle>
          </DialogHeader>
          {imageOrderId !== null && (
            <div className="space-y-3">
              <img src={`/api/order-image/${imageOrderId}`} alt="صورة الطلب" className="w-full rounded-lg border border-border" />
              <a
                href={`/api/order-image/${imageOrderId}`}
                download={`order-${imageOrderId}.png`}
                className="flex items-center justify-center gap-2 text-sm text-violet-600 dark:text-violet-400 underline underline-offset-2"
              >
                <Download className="w-4 h-4" /> تنزيل الصورة
              </a>
            </div>
          )}
        </DialogContent>
      </Dialog>
      
      <div className="min-h-screen bg-gradient-to-br from-violet-50 to-fuchsia-50 dark:from-[#120b26] dark:to-[#1c1136] p-4 lg:p-8" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-6 pb-28">
        {/* Header - هوية Xenon */}
        <div className="relative overflow-hidden bg-[#170f2e] rounded-2xl shadow-lg p-6 text-white ring-1 ring-white/10">
          <div className="pointer-events-none absolute -top-16 left-1/4 h-48 w-48 rounded-full bg-fuchsia-600/25 blur-[80px]" />
          <div className="pointer-events-none absolute -bottom-16 right-1/4 h-48 w-48 rounded-full bg-violet-600/25 blur-[80px]" />
          <div className="relative flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <img src="/xenon-logo.svg" alt="Xenon" className="w-12 h-12 sm:w-14 sm:h-14 xenon-logo-glow shrink-0" />
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-bold truncate">مرحباً {user?.name} 👋</h1>
                <p className="text-violet-200/70 text-sm mt-0.5">
                  لوحة المندوب — <span className="xenon-gradient-text font-bold">Xenon</span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <ThemeToggle />
              <Button
                variant="outline"
                size="icon"
                aria-label="الخريطة ومساري"
                className="border-white/30 text-white hover:bg-white/10"
                onClick={() => setLocation("/delivery/map")}
              >
                <MapPin className="w-5 h-5" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="الإشعارات"
                    className="relative border-white/30 text-white hover:bg-white/10"
                  >
                    <Bell className="w-5 h-5" />
                    {(unreadCount || 0) > 0 && (
                      <Badge className="absolute -top-1.5 -left-1.5 bg-red-500 text-white px-1.5 py-0.5 text-[10px] min-w-[18px] justify-center">
                        {unreadCount}
                      </Badge>
                    )}
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
                              <Badge className="bg-violet-500 text-white text-xs px-1.5 py-0.5">جديد</Badge>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground">{notif.message}</span>
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-center text-violet-600 font-medium cursor-pointer"
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
                  <Button variant="outline" size="icon" aria-label="الحساب" className="border-white/30 text-white hover:bg-white/10">
                    <User className="w-5 h-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setLocation("/delivery/map")}>
                    <MapPin className="w-4 h-4 ml-2" />
                    خريطة المحافظة ومساري
                  </DropdownMenuItem>
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

        {/* شريط حالة العمل — الإجراء الأساسي للمندوب */}
        <div className={`rounded-2xl p-4 ring-1 flex items-center justify-between gap-3 flex-wrap transition-colors ${
          locationTracking
            ? "bg-emerald-500/10 ring-emerald-400/30"
            : "bg-white/80 dark:bg-white/5 ring-border/60"
        }`}>
          <div className="flex items-center gap-3 min-w-0">
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${locationTracking ? "bg-emerald-500/20" : "bg-muted"}`}>
              {locationTracking
                ? <Navigation className="w-5 h-5 text-emerald-600 animate-pulse" />
                : <NavigationOff className="w-5 h-5 text-muted-foreground" />}
            </span>
            <div className="min-w-0">
              <p className="font-bold text-foreground">{locationTracking ? "جارٍ العمل — التتبّع نشط" : "أنت غير نشط"}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {locationTracking ? "موقعك ومسارك يُحفظان ويُرسلان للإدارة" : "اضغط «ابدأ العمل» لبدء التتبّع واستقبال الطلبات"}
                {pendingSync > 0 && <span className="text-amber-600 dark:text-amber-400"> • {pendingSync} نقطة بانتظار المزامنة</span>}
              </p>
            </div>
          </div>
          <Button
            onClick={toggleLocationTracking}
            className={locationTracking
              ? "bg-rose-600 hover:bg-rose-700 text-white shrink-0"
              : "bg-gradient-to-l from-violet-600 to-fuchsia-600 hover:opacity-90 text-white shrink-0"}
          >
            {locationTracking
              ? (<><NavigationOff className="w-4 h-4 ml-2" /> إيقاف العمل</>)
              : (<><Navigation className="w-4 h-4 ml-2" /> ابدأ العمل</>)}
          </Button>
        </div>

        {/* Statistics - هوية Xenon */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "إجمالي الطلبات", value: stats.total, Icon: Package, chip: "bg-violet-500/15 text-violet-500 dark:text-violet-300" },
            { label: "قيد التنفيذ", value: stats.pending, Icon: Clock, chip: "bg-amber-500/15 text-amber-600 dark:text-amber-300" },
            { label: "تم التسليم اليوم", value: stats.delivered, Icon: CheckCircle, chip: "bg-green-500/15 text-green-600 dark:text-green-300" },
            { label: "تسليمات الشهر", value: stats.monthlyDelivered || 0, Icon: Package, chip: "bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-300" },
          ].map(({ label, value, Icon, chip }) => (
            <Card
              key={label}
              className="group relative overflow-hidden border-border/60 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:border-fuchsia-400/40"
            >
              <CardContent className="flex items-center gap-4 p-5">
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${chip}`}>
                  <Icon className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-3xl font-extrabold tabular-nums text-foreground">{value}</p>
                  <p className="text-sm text-muted-foreground">{label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Orders List - تصميم جديد */}
        <Card className="shadow-lg">
          <CardHeader className="bg-accent/50 dark:from-gray-800 dark:to-gray-700">
            <CardTitle className="flex items-center gap-2">
              {ordersView === "log" ? <Clock className="w-5 h-5 text-violet-600" /> : <Package className="w-5 h-5 text-violet-600" />}
              {ordersView === "log" ? "سجل اليوم" : "طلباتي"}
            </CardTitle>
            <CardDescription>{ordersView === "log" ? "طلبات اليوم (الجديدة والمكتملة)" : "الطلبات الجديدة والحالية المعيّنة لك"}</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            {(() => {
              const all = orders || [];
              const dayStart = businessDayStart().getTime();
              const newOrders = all.filter((o: any) => o.status === "pending_approval");
              const currentOrders = all.filter((o: any) => o.status === "pending" || o.status === "postponed");
              const todayOrders = all.filter((o: any) => {
                const c = new Date(o.createdAt).getTime();
                const d = o.deliveredAt ? new Date(o.deliveredAt).getTime() : NaN;
                return (Number.isFinite(c) && c >= dayStart) || (Number.isFinite(d) && d >= dayStart);
              });
              const emptyBox = (text: string) => (
                <div className="text-center py-10">
                  <Package className="w-14 h-14 mx-auto text-gray-400 mb-3" />
                  <p className="text-muted-foreground">{text}</p>
                </div>
              );

              if (ordersView === "log") {
                return todayOrders.length > 0
                  ? <div className="space-y-4">{todayOrders.map(renderOrderCard)}</div>
                  : emptyBox("لا توجد طلبات اليوم");
              }

              return (
                <div className="space-y-6">
                  <section>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-sky-500/15 text-sky-600 dark:text-sky-300 text-xs font-bold">{newOrders.length}</span>
                      <h3 className="font-bold text-foreground">الطلبات الجديدة</h3>
                    </div>
                    {newOrders.length > 0
                      ? <div className="space-y-4">{newOrders.map(renderOrderCard)}</div>
                      : <p className="text-sm text-muted-foreground px-1 pb-2">لا توجد طلبات جديدة بانتظار الموافقة</p>}
                  </section>
                  <section>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-violet-500/15 text-violet-600 dark:text-violet-300 text-xs font-bold">{currentOrders.length}</span>
                      <h3 className="font-bold text-foreground">الطلبات الحالية</h3>
                    </div>
                    {currentOrders.length > 0
                      ? <div className="space-y-4">{currentOrders.map(renderOrderCard)}</div>
                      : <p className="text-sm text-muted-foreground px-1">لا توجد طلبات قيد التنفيذ</p>}
                  </section>
                </div>
              );
            })()}
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
                  className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-violet-100 file:text-violet-700 hover:file:bg-violet-200 dark:file:bg-violet-500/20 dark:file:text-violet-200"
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
                className="flex-1 bg-violet-600 hover:bg-violet-700"
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
                className="flex-1 bg-violet-600 hover:bg-violet-700"
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

    {/* شريط التنقّل السفلي — نمط تطبيقات الهاتف */}
    <nav
      className="fixed bottom-0 inset-x-0 z-50 bg-[#170f2e]/95 backdrop-blur border-t border-white/10 text-white"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      dir="rtl"
    >
      <div className="max-w-7xl mx-auto grid grid-cols-4">
        {[
          { key: "home", label: "الرئيسية", Icon: Package, active: ordersView === "home", onClick: () => { setOrdersView("home"); window.scrollTo({ top: 0, behavior: "smooth" }); }, badge: 0 },
          { key: "log", label: "السجل", Icon: Clock, active: ordersView === "log", onClick: () => { setOrdersView("log"); window.scrollTo({ top: 0, behavior: "smooth" }); }, badge: 0 },
          { key: "map", label: "الخريطة", Icon: MapPin, active: false, onClick: () => setLocation("/delivery/map"), badge: 0 },
          { key: "notif", label: "الإشعارات", Icon: Bell, active: false, onClick: () => setLocation("/delivery/notifications"), badge: unreadCount || 0 },
        ].map(({ key, label, Icon, active, onClick, badge }) => (
          <button
            key={key}
            type="button"
            onClick={onClick}
            className={`relative flex flex-col items-center gap-1 py-2 text-[11px] font-medium transition-colors ${active ? "text-white" : "text-violet-200/60 hover:text-white"}`}
          >
            <span className={`relative flex items-center justify-center w-11 h-7 rounded-full transition-colors ${active ? "bg-violet-600" : ""}`}>
              <Icon className="w-5 h-5" />
              {badge > 0 && (
                <span className="absolute -top-1 -left-1 bg-red-500 text-white rounded-full text-[9px] min-w-[16px] h-[16px] px-1 flex items-center justify-center font-bold">
                  {badge}
                </span>
              )}
            </span>
            {label}
          </button>
        ))}
      </div>
    </nav>
    </>
  );
}
