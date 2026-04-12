import admin from 'firebase-admin';
import { ENV } from '../_core/env';

export class NotificationService {
  private initialized = false;

  constructor() {
    this.initialize();
  }

  /**
   * Initialize Firebase Admin SDK
   */
  private initialize() {
    try {
      if (admin.apps.length > 0) {
        this.initialized = true;
        return;
      }

      // Initialize Firebase Admin with service account
      // This requires FIREBASE_SERVICE_ACCOUNT environment variable
      if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });

        this.initialized = true;
        console.log('[Firebase] Initialized successfully');
      } else {
        console.warn('[Firebase] FIREBASE_SERVICE_ACCOUNT not set - notifications disabled');
      }
    } catch (error) {
      console.error('[Firebase] Initialization error:', error);
    }
  }

  /**
   * Send push notification to device
   */
  async sendNotification(options: {
    token: string;
    notification: {
      title: string;
      body: string;
      imageUrl?: string;
    };
    data?: Record<string, string>;
  }): Promise<string> {
    try {
      if (!this.initialized) {
        throw new Error('Firebase not initialized');
      }

      const message = {
        token: options.token,
        notification: {
          title: options.notification.title,
          body: options.notification.body,
          imageUrl: options.notification.imageUrl,
        },
        data: options.data || {},
        android: {
          priority: 'high' as const,
          notification: {
            sound: 'default',
            clickAction: 'FLUTTER_NOTIFICATION_CLICK',
          },
        },
        apns: {
          headers: {
            'apns-priority': '10',
          },
        },
      };

      const response = await admin.messaging().send(message as any);

      console.log('[Notifications] Sent:', response);
      return response;
    } catch (error) {
      console.error('[Notifications] Send error:', error);
      throw error;
    }
  }

  /**
   * Send notification to delivery person
   */
  async notifyDeliveryPerson(
    userId: number,
    title: string,
    body: string,
    type: string,
    data: Record<string, any>
  ): Promise<boolean> {
    try {
      if (!this.initialized) {
        console.warn('[Notifications] Firebase not initialized');
        return false;
      }

      // In production, get FCM token from database
      // For now, we'll implement this when db functions are ready
      console.log(`[Notifications] Would notify user ${userId}: ${title}`);

      return true;
    } catch (error) {
      console.error('[Notifications] Error notifying delivery person:', error);
      return false;
    }
  }

  /**
   * Send batch notifications
   */
  async sendBatchNotifications(tokens: string[], message: string): Promise<void> {
    try {
      if (!this.initialized) {
        throw new Error('Firebase not initialized');
      }

      const messages = tokens.map((token) => ({
        notification: {
          title: 'جونيا - Joniah',
          body: message,
        },
        data: {},
        token,
      }));

      await admin.messaging().sendAll(messages as any);

      console.log('[Notifications] Batch sent to', tokens.length, 'devices');
    } catch (error) {
      console.error('[Notifications] Batch send error:', error);
    }
  }

  /**
   * Subscribe token to topic for group notifications
   */
  async subscribeToTopic(tokens: string[], topic: string): Promise<void> {
    try {
      if (!this.initialized) {
        throw new Error('Firebase not initialized');
      }

      await admin.messaging().subscribeToTopic(tokens, topic);

      console.log('[Notifications] Subscribed', tokens.length, 'devices to topic:', topic);
    } catch (error) {
      console.error('[Notifications] Topic subscription error:', error);
    }
  }

  /**
   * Unsubscribe token from topic
   */
  async unsubscribeFromTopic(tokens: string[], topic: string): Promise<void> {
    try {
      if (!this.initialized) {
        throw new Error('Firebase not initialized');
      }

      await admin.messaging().unsubscribeFromTopic(tokens, topic);

      console.log('[Notifications] Unsubscribed from topic:', topic);
    } catch (error) {
      console.error('[Notifications] Topic unsubscription error:', error);
    }
  }

  /**
   * Check if initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}
