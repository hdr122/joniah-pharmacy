import { getDb } from "./db";
import { users, deliveryLocations } from "../drizzle/schema";
import { eq, desc, and } from "drizzle-orm";

type StatusType = 'gps_off' | 'internet_lost' | 'app_stopped' | 'no_permission' | 'normal';

interface DeliveryStatus {
  id: number;
  deliveryPersonId: number;
  deliveryPersonName: string;
  status: StatusType;
  lastSeen: Date;
  lastLocation: { lat: number; lng: number } | null;
  batteryLevel: number | null;
  message: string;
}

export async function getDeliveryStatusLog(): Promise<DeliveryStatus[]> {
  const db = await getDb();
  if (!db) return [];

  // الحصول على جميع المندوبين
  const deliveryPersons = await db
    .select({
      id: users.id,
      name: users.name,
      username: users.username,
    })
    .from(users)
    .where(eq(users.role, "delivery"));

  const statusLog: DeliveryStatus[] = [];
  const now = new Date().getTime();

  for (const person of deliveryPersons) {
    // الحصول على آخر موقع GPS
    const lastLocation = await db
      .select()
      .from(deliveryLocations)
      .where(eq(deliveryLocations.deliveryPersonId, person.id))
      .orderBy(desc(deliveryLocations.createdAt))
      .limit(1);

    if (lastLocation.length === 0) {
      // لم يتم استلام أي بيانات GPS
      statusLog.push({
        id: person.id,
        deliveryPersonId: person.id,
        deliveryPersonName: person.name || person.username || 'غير معروف',
        status: 'no_permission',
        lastSeen: new Date(),
        lastLocation: null,
        batteryLevel: null,
        message: 'لم يتم استلام أي بيانات GPS - قد يكون التطبيق غير مثبت أو بدون صلاحيات',
      });
      continue;
    }

    const lastGPS = lastLocation[0];
    const lastSeenTime = new Date(lastGPS.createdAt).getTime();
    const timeDiffMinutes = Math.floor((now - lastSeenTime) / (1000 * 60));

    let status: StatusType = 'normal';
    let message = 'يعمل بشكل طبيعي';

    // تحديد الحالة بناءً على آخر تحديث
    if (timeDiffMinutes > 60) {
      // أكثر من ساعة بدون تحديث
      status = 'app_stopped';
      message = `لم يتم استلام تحديث منذ ${Math.floor(timeDiffMinutes / 60)} ساعة - قد يكون التطبيق متوقف`;
    } else if (timeDiffMinutes > 30) {
      // أكثر من 30 دقيقة بدون تحديث
      status = 'internet_lost';
      message = `لم يتم استلام تحديث منذ ${timeDiffMinutes} دقيقة - قد يكون هناك مشكلة في الإنترنت`;
    } else if (timeDiffMinutes > 10) {
      // أكثر من 10 دقائق بدون تحديث
      status = 'gps_off';
      message = `لم يتم استلام تحديث منذ ${timeDiffMinutes} دقيقة - قد يكون GPS متوقف`;
    }

    statusLog.push({
      id: person.id,
      deliveryPersonId: person.id,
      deliveryPersonName: person.name || person.username || 'غير معروف',
      status,
      lastSeen: new Date(lastGPS.createdAt),
      lastLocation: {
        lat: Number(lastGPS.latitude),
        lng: Number(lastGPS.longitude),
      },
      batteryLevel: lastGPS.battery ? Number(lastGPS.battery) : null,
      message,
    });
  }

  // ترتيب حسب الحالة (المشاكل أولاً)
  return statusLog.sort((a, b) => {
    const statusPriority: Record<StatusType, number> = {
      app_stopped: 1,
      internet_lost: 2,
      gps_off: 3,
      no_permission: 4,
      normal: 5,
    };
    return statusPriority[a.status] - statusPriority[b.status];
  });
}
