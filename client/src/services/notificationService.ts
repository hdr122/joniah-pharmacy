import { PushNotifications } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';

export interface NotificationPayload {
  orderId: string;
  title: string;
  message: string;
  type: 'new_order' | 'order_updated' | 'order_cancelled' | 'assignment' | 'location_update';
  data?: Record<string, any>;
}

class NotificationService {
  private fcmToken: string | null = null;

  /**
   * Initialize push notifications
   */
  async initialize() {
    try {
      // Request permission
      await this.requestPermissions();

      // Get FCM token
      await this.registerPushNotifications();

      // Listen for incoming notifications
      this.setupNotificationListeners();

      console.log('[Notifications] Service initialized');
    } catch (error) {
      console.error('[Notifications] Initialization failed:', error);
    }
  }

  /**
   * Request notification permissions
   */
  private async requestPermissions() {
    try {
      const result = await PushNotifications.requestPermissions();
      if (result.receive === 'granted') {
        console.log('[Notifications] Permissions granted');
      }
    } catch (error) {
      console.error('[Notifications] Permission request failed:', error);
    }
  }

  /**
   * Register for push notifications and get FCM token
   */
  private async registerPushNotifications() {
    try {
      await PushNotifications.register();

      // Get the token
      const result = await PushNotifications.getDeliveryTokens();

      if (result.fcm) {
        this.fcmToken = result.fcm;
        console.log('[Notifications] FCM Token:', this.fcmToken);

        // Send token to backend to store for this user
        await this.sendTokenToServer(this.fcmToken);
      }
    } catch (error) {
      console.error('[Notifications] Registration failed:', error);
    }
  }

  /**
   * Send FCM token to backend
   */
  private async sendTokenToServer(token: string) {
    try {
      // This will be called from your tRPC router
      // Store the token on the user record in database
      const response = await fetch('/api/notifications/register-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fcmToken: token }),
      });

      if (!response.ok) {
        console.error('[Notifications] Failed to register token on server');
      }
    } catch (error) {
      console.error('[Notifications] Error sending token to server:', error);
    }
  }

  /**
   * Setup notification listeners
   */
  private setupNotificationListeners() {
    // Handle notifications when app is in foreground
    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('[Notifications] Received:', notification);

      // Show local notification
      this.showLocalNotification({
        title: notification.title || 'جونيا',
        body: notification.body || 'رسالة جديدة',
        id: Math.floor(Math.random() * 10000),
      });

      // Handle specific notification types
      this.handleNotification(notification);
    });

    // Handle notification tap
    PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
      console.log('[Notifications] Action performed:', notification);
      this.handleNotificationTap(notification);
    });

    // Handle registration token refresh
    PushNotifications.addListener('registration', (token) => {
      console.log('[Notifications] Token refreshed:', token);
      this.fcmToken = token.value;
    });

    // Handle registration error
    PushNotifications.addListener('registrationError', (error) => {
      console.error('[Notifications] Registration error:', error);
    });
  }

  /**
   * Show local notification
   */
  async showLocalNotification(options: {
    id: number;
    title: string;
    body: string;
    data?: Record<string, any>;
  }) {
    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            id: options.id,
            title: options.title,
            body: options.body,
            extra: options.data,
            smallIcon: 'ic_stat_icon',
            actionTypeId: 'message',
          },
        ],
      });
    } catch (error) {
      console.error('[Notifications] Error showing local notification:', error);
    }
  }

  /**
   * Handle incoming notification
   */
  private handleNotification(notification: any) {
    const data = notification.data || {};

    switch (data.type) {
      case 'new_order':
        // New order assigned to delivery person
        this.handleNewOrder(data);
        break;
      case 'order_updated':
        // Order status changed
        this.handleOrderUpdated(data);
        break;
      case 'order_cancelled':
        // Order cancelled
        this.handleOrderCancelled(data);
        break;
      default:
        console.log('[Notifications] Unknown notification type:', data.type);
    }
  }

  /**
   * Handle new order notification
   */
  private handleNewOrder(data: any) {
    console.log('[Notifications] New order:', data.orderId);

    // Trigger event so React components can listen
    window.dispatchEvent(
      new CustomEvent('order:new', {
        detail: {
          orderId: data.orderId,
          customerName: data.customerName,
          address: data.address,
          items: data.items,
        },
      })
    );
  }

  /**
   * Handle order updated notification
   */
  private handleOrderUpdated(data: any) {
    console.log('[Notifications] Order updated:', data.orderId);

    window.dispatchEvent(
      new CustomEvent('order:updated', {
        detail: {
          orderId: data.orderId,
          status: data.status,
          updatedAt: data.updatedAt,
        },
      })
    );
  }

  /**
   * Handle order cancelled notification
   */
  private handleOrderCancelled(data: any) {
    console.log('[Notifications] Order cancelled:', data.orderId);

    window.dispatchEvent(
      new CustomEvent('order:cancelled', {
        detail: {
          orderId: data.orderId,
          reason: data.reason,
        },
      })
    );
  }

  /**
   * Handle notification tap
   */
  private handleNotificationTap(notification: any) {
    const data = notification.notification.data || {};
    const orderId = data.orderId;

    if (orderId) {
      // Navigate to order details
      window.location.href = `/delivery/orders/${orderId}`;
    }
  }

  /**
   * Get FCM token
   */
  getFcmToken(): string | null {
    return this.fcmToken;
  }
}

export const notificationService = new NotificationService();
