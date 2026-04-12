import { z } from 'zod';
import { publicProcedure, router } from '../_core/trpc';
import * as db from '../db';
import { NotificationService } from '../services/NotificationService';

const notificationService = new NotificationService();

export const notificationsRouter = router({
  /**
   * Register FCM token for push notifications
   */
  registerToken: publicProcedure
    .input(z.object({ fcmToken: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        if (!ctx.user) {
          throw new Error('Not authenticated');
        }

        // Store FCM token in database
        await db.saveFCMToken(ctx.user.id, input.fcmToken);

        console.log(`[Notifications] FCM token registered for user ${ctx.user.id}`);

        return { success: true };
      } catch (error) {
        console.error('[Notifications] Error registering token:', error);
        throw error;
      }
    }),

  /**
   * Get FCM token for user
   */
  getToken: publicProcedure.query(async ({ ctx }) => {
    try {
      if (!ctx.user) {
        return null;
      }

      const token = await db.getFCMToken(ctx.user.id);
      return token;
    } catch (error) {
      console.error('[Notifications] Error getting token:', error);
      return null;
    }
  }),

  /**
   * Send push notification
   */
  sendNotification: publicProcedure
    .input(
      z.object({
        userId: z.number(),
        title: z.string(),
        message: z.string(),
        type: z.enum(['new_order', 'order_updated', 'order_cancelled', 'assignment']),
        data: z.record(z.any()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Get user's FCM token
        const fcmToken = await db.getFCMToken(input.userId);

        if (!fcmToken) {
          console.log(`[Notifications] No FCM token for user ${input.userId}`);
          return { success: false, error: 'No FCM token found' };
        }

        // Send notification using Firebase Cloud Messaging
        const result = await notificationService.sendNotification({
          token: fcmToken,
          notification: {
            title: input.title,
            body: input.message,
          },
          data: {
            type: input.type,
            ...input.data,
          },
        });

        console.log(`[Notifications] Sent to user ${input.userId}:`, result);

        return { success: true, messageId: result };
      } catch (error) {
        console.error('[Notifications] Error sending notification:', error);
        throw error;
      }
    }),

  /**
   * Send notification to delivery person when assigned new order
   */
  notifyNewOrder: publicProcedure
    .input(
      z.object({
        deliveryPersonId: z.number(),
        orderId: z.string(),
        customerName: z.string(),
        address: z.string(),
        itemCount: z.number(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const message = `طلب جديد من ${input.customerName} - ${input.itemCount} منتج`;
        const data = {
          orderId: input.orderId,
          customerName: input.customerName,
          address: input.address,
          items: input.itemCount.toString(),
        };

        // Send notification
        const result = await notificationService.notifyDeliveryPerson(
          input.deliveryPersonId,
          'طلب جديد - New Order',
          message,
          'new_order',
          data
        );

        return result;
      } catch (error) {
        console.error('[Notifications] Error notifying about new order:', error);
        throw error;
      }
    }),

  /**
   * Send notification when order status changes
   */
  notifyOrderStatusChange: publicProcedure
    .input(
      z.object({
        deliveryPersonId: z.number(),
        orderId: z.string(),
        newStatus: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const statusMessages: Record<string, string> = {
          pending: 'في الانتظار',
          assigned: 'تم التعيين',
          picked_up: 'تم الاستلام',
          in_delivery: 'جاري التوصيل',
          delivered: 'تم التوصيل',
          cancelled: 'تم الإلغاء',
        };

        const statusArabic = statusMessages[input.newStatus] || input.newStatus;

        const result = await notificationService.notifyDeliveryPerson(
          input.deliveryPersonId,
          'تحديث الطلب',
          `تم تحديث الطلب إلى: ${statusArabic}`,
          'order_updated',
          {
            orderId: input.orderId,
            status: input.newStatus,
          }
        );

        return result;
      } catch (error) {
        console.error('[Notifications] Error notifying about status change:', error);
        throw error;
      }
    }),
});
