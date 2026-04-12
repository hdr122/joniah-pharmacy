import { getNotificationSettings } from './db';

interface OneSignalNotification {
  app_id: string;
  contents: {
    en: string;
    ar: string;
  };
  headings: {
    en: string;
    ar: string;
  };
  include_external_user_ids?: string[];
  data?: Record<string, any>;
}

/**
 * إرسال إشعار OneSignal باستخدام v2 API
 * @param branchId معرف الفرع
 * @param title عنوان الإشعار
 * @param message محتوى الإشعار
 * @param userIds معرفات المستخدمين (اختياري)
 * @param data بيانات إضافية (اختياري)
 */
export async function sendNotification(
  branchId: number,
  title: string,
  message: string,
  userIds?: string[],
  data?: Record<string, any>
): Promise<boolean> {
  try {
    // جلب إعدادات الإشعارات للفرع
    const settings = await getNotificationSettings(branchId);
    
    // التحقق من تفعيل الإشعارات
    if (!settings || !settings.isEnabled) {
      console.log(`[OneSignal] Notifications disabled for branch ${branchId}`);
      return false;
    }
    
    // التحقق من وجود المفاتيح
    if (!settings.oneSignalAppId || !settings.oneSignalRestApiKey) {
      console.error(`[OneSignal] Missing credentials for branch ${branchId}`);
      return false;
    }
    
    // إعداد الإشعار
    const notification: OneSignalNotification = {
      app_id: settings.oneSignalAppId,
      contents: {
        en: message,
        ar: message,
      },
      headings: {
        en: title,
        ar: title,
      },
    };
    
    // إضافة معرفات المستخدمين إذا كانت موجودة
    if (userIds && userIds.length > 0) {
      notification.include_external_user_ids = userIds;
    }
    
    // إضافة البيانات الإضافية
    if (data) {
      notification.data = data;
    }
    
    // إرسال الإشعار باستخدام OneSignal REST API
    const payload = notification;
    
    console.log('\n' + '='.repeat(80));
    console.log('[OneSignal] إرسال إشعار');
    console.log('='.repeat(80));
    console.log('Payload:');
    console.log(JSON.stringify(payload, null, 2));
    console.log('='.repeat(80));
    
    const response = await fetch(`https://onesignal.com/api/v1/notifications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Authorization': `Basic ${settings.oneSignalRestApiKey}`,
      },
      body: JSON.stringify(payload),
    });
    
    const responseText = await response.text();
    console.log('\nResponse:');
    console.log(`Status: ${response.status} ${response.statusText}`);
    console.log('Body:', responseText);
    console.log('='.repeat(80) + '\n');
    
    let result;
    try {
      result = JSON.parse(responseText);
    } catch (e) {
      console.error('[OneSignal] Failed to parse response:', e);
      result = { raw: responseText };
    }
    
    // حفظ السجل في قاعدة البيانات
    const { createNotificationLog } = await import('./db');
    await createNotificationLog({
      branchId,
      userId: userIds && userIds.length === 1 ? parseInt(userIds[0]) : undefined,
      title,
      message,
      recipientCount: userIds?.length || 0,
      status: response.ok ? 'success' : 'failed',
      errorMessage: response.ok ? undefined : responseText,
      oneSignalResponse: JSON.stringify(result),
    });
    
    if (!response.ok) {
      console.error(`[OneSignal] Failed to send notification`);
      console.error(`[OneSignal] Status: ${response.status}`);
      console.error(`[OneSignal] Error: ${responseText}`);
      return false;
    }
    
    console.log(`[OneSignal] Notification sent successfully:`, result);
    return true;
  } catch (error) {
    console.error('[OneSignal] Error sending notification:', error);
    return false;
  }
}

/**
 * إرسال إشعار عند إنشاء طلب جديد
 */
export async function notifyNewOrder(
  branchId: number,
  orderNumber: string,
  deliveryPersonId: number,
  deliveryPersonName: string
): Promise<boolean> {
  const settings = await getNotificationSettings(branchId);
  
  if (!settings || !settings.notifyOnNewOrder) {
    console.log(`[OneSignal] New order notifications disabled for branch ${branchId}`);
    return false;
  }
  
  console.log(`[OneSignal] Sending new order notification to user ${deliveryPersonId} for order ${orderNumber}`);
  
  return await sendNotification(
    branchId,
    'طلب جديد 📦',
    `تم تعيين طلب رقم ${orderNumber} لك`,
    [deliveryPersonId.toString()],
    {
      type: 'new_order',
      orderNumber,
      deliveryPersonId,
    }
  );
}

/**
 * إرسال إشعار عند إرسال رسالة لمندوب
 */
export async function notifyMessage(
  branchId: number,
  messageContent: string,
  recipientId: number,
  recipientName: string
): Promise<boolean> {
  const settings = await getNotificationSettings(branchId);
  
  if (!settings || !settings.notifyOnMessage) {
    console.log(`[OneSignal] Message notifications disabled for branch ${branchId}`);
    return false;
  }
  
  console.log(`[OneSignal] Sending message notification to user ${recipientId}`);
  
  return await sendNotification(
    branchId,
    'رسالة جديدة 💬',
    messageContent,
    [recipientId.toString()],
    {
      type: 'new_message',
      recipientId,
    }
  );
}

/**
 * إرسال إشعار عند تعديل طلب
 */
export async function notifyOrderUpdate(
  branchId: number,
  orderNumber: string,
  deliveryPersonId: number,
  deliveryPersonName: string,
  updateDetails: string
): Promise<boolean> {
  const settings = await getNotificationSettings(branchId);
  
  if (!settings || !settings.notifyOnNewOrder) {
    console.log(`[OneSignal] Order update notifications disabled for branch ${branchId}`);
    return false;
  }
  
  console.log(`[OneSignal] Sending order update notification to user ${deliveryPersonId} for order ${orderNumber}`);
  
  return await sendNotification(
    branchId,
    'تم تعديل الطلب ✏️',
    `تم تعديل طلب رقم ${orderNumber}: ${updateDetails}`,
    [deliveryPersonId.toString()],
    {
      type: 'order_updated',
      orderNumber,
      deliveryPersonId,
    }
  );
}

/**
 * إرسال إشعار عند إعادة تعيين طلب لمندوب آخر
 */
export async function notifyOrderReassign(
  branchId: number,
  orderNumber: string,
  newDeliveryPersonId: number,
  newDeliveryPersonName: string
): Promise<boolean> {
  const settings = await getNotificationSettings(branchId);
  
  if (!settings || !settings.notifyOnNewOrder) {
    console.log(`[OneSignal] Order reassign notifications disabled for branch ${branchId}`);
    return false;
  }
  
  console.log(`[OneSignal] Sending order reassign notification to user ${newDeliveryPersonId} for order ${orderNumber}`);
  
  return await sendNotification(
    branchId,
    'تم تعيين طلب لك 🔄',
    `تم إعادة تعيين طلب رقم ${orderNumber} لك`,
    [newDeliveryPersonId.toString()],
    {
      type: 'order_reassigned',
      orderNumber,
      deliveryPersonId: newDeliveryPersonId,
    }
  );
}

/**
 * إرسال إشعار عند تغيير حالة طلب
 */
export async function notifyOrderStatusChange(
  branchId: number,
  orderNumber: string,
  deliveryPersonId: number,
  deliveryPersonName: string,
  newStatus: string
): Promise<boolean> {
  const settings = await getNotificationSettings(branchId);
  
  if (!settings || !settings.notifyOnNewOrder) {
    console.log(`[OneSignal] Order status change notifications disabled for branch ${branchId}`);
    return false;
  }
  
  const statusMessages: Record<string, string> = {
    pending: 'قيد الانتظار',
    delivered: 'تم التسليم',
    postponed: 'تم التأجيل',
    cancelled: 'تم الإلغاء',
    returned: 'تم الإرجاع',
  };
  
  console.log(`[OneSignal] Sending order status change notification to user ${deliveryPersonId} for order ${orderNumber}`);
  
  return await sendNotification(
    branchId,
    'تغيير حالة الطلب 🔔',
    `تم تغيير حالة طلب رقم ${orderNumber} إلى: ${statusMessages[newStatus] || newStatus}`,
    [deliveryPersonId.toString()],
    {
      type: 'order_status_changed',
      orderNumber,
      deliveryPersonId,
      newStatus,
    }
  );
}
