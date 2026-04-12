/**
 * Push Notifications Service
 * يدعم كل من Web Push و Firebase Cloud Messaging للتطبيقات الأصلية
 */

import { Capacitor } from '@capacitor/core';

// Types
interface PushNotificationToken {
  value: string;
}

interface PushNotificationSchema {
  title?: string;
  body?: string;
  data?: Record<string, string>;
}

interface ActionPerformed {
  actionId: string;
  notification: PushNotificationSchema;
}

type TokenCallback = (token: string) => void;
type NotificationCallback = (notification: PushNotificationSchema) => void;
type ActionCallback = (action: ActionPerformed) => void;

// Callbacks storage
let tokenCallback: TokenCallback | null = null;
let notificationCallback: NotificationCallback | null = null;
let actionCallback: ActionCallback | null = null;

/**
 * Check if running on native platform
 */
export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Initialize push notifications
 */
export async function initializePushNotifications(
  onToken: TokenCallback,
  onNotification?: NotificationCallback,
  onAction?: ActionCallback
): Promise<boolean> {
  tokenCallback = onToken;
  notificationCallback = onNotification || null;
  actionCallback = onAction || null;

  if (isNativePlatform()) {
    return initializeNativePush();
  } else {
    return initializeWebPush();
  }
}

/**
 * Initialize native push notifications (Capacitor)
 */
async function initializeNativePush(): Promise<boolean> {
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    
    // Request permission
    const permResult = await PushNotifications.requestPermissions();
    
    if (permResult.receive !== 'granted') {
      console.warn('[Push] Permission not granted');
      return false;
    }
    
    // Register for push notifications
    await PushNotifications.register();
    
    // Listen for registration success
    await PushNotifications.addListener('registration', (token: PushNotificationToken) => {
      console.log('[Push] Registration successful, token:', token.value);
      if (tokenCallback) {
        tokenCallback(token.value);
      }
    });
    
    // Listen for registration errors
    await PushNotifications.addListener('registrationError', (error: any) => {
      console.error('[Push] Registration error:', error);
    });
    
    // Listen for push notifications received
    await PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
      console.log('[Push] Notification received:', notification);
      if (notificationCallback) {
        notificationCallback(notification);
      }
      
      // Show local notification if app is in foreground
      showLocalNotification(notification);
    });
    
    // Listen for notification actions
    await PushNotifications.addListener('pushNotificationActionPerformed', (action: ActionPerformed) => {
      console.log('[Push] Action performed:', action);
      if (actionCallback) {
        actionCallback(action);
      }
      
      // Navigate based on notification data
      if (action.notification.data?.url) {
        window.location.href = action.notification.data.url;
      }
    });
    
    console.log('[Push] Native push initialized');
    return true;
  } catch (error) {
    console.error('[Push] Failed to initialize native push:', error);
    return false;
  }
}

/**
 * Initialize web push notifications
 */
async function initializeWebPush(): Promise<boolean> {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) {
    console.warn('[Push] Web push not supported');
    return false;
  }
  
  try {
    // Request permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('[Push] Permission not granted');
      return false;
    }
    
    // Register service worker
    const registration = await navigator.serviceWorker.register('/sw.js');
    console.log('[Push] Service worker registered');
    
    // Subscribe to push
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(
        'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDJo3YTIThzWIToeBO3NuMa_Fk1_6Vu_5-xYDx-0_Yl4'
      ) as BufferSource,
    });
    
    // Convert subscription to token-like format
    const subJSON = subscription.toJSON();
    const token = JSON.stringify({
      endpoint: subscription.endpoint,
      keys: subJSON.keys,
    });
    
    if (tokenCallback) {
      tokenCallback(token);
    }
    
    console.log('[Push] Web push initialized');
    return true;
  } catch (error) {
    console.error('[Push] Failed to initialize web push:', error);
    return false;
  }
}

/**
 * Show local notification (for foreground notifications)
 */
async function showLocalNotification(notification: PushNotificationSchema): Promise<void> {
  if (isNativePlatform()) {
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      
      await LocalNotifications.schedule({
        notifications: [
          {
            id: Date.now(),
            title: notification.title || 'إشعار جديد',
            body: notification.body || '',
            extra: notification.data,
            smallIcon: 'ic_stat_icon',
            iconColor: '#10b981',
          },
        ],
      });
    } catch (error) {
      console.error('[Push] Failed to show local notification:', error);
    }
  } else {
    // Web notification
    if (Notification.permission === 'granted') {
      new Notification(notification.title || 'إشعار جديد', {
        body: notification.body,
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-72x72.png',
        data: notification.data,
      });
    }
  }
}

/**
 * Get current FCM token (native only)
 */
export async function getFCMToken(): Promise<string | null> {
  if (!isNativePlatform()) {
    return null;
  }
  
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    
    // Check if already registered
    const permResult = await PushNotifications.checkPermissions();
    if (permResult.receive !== 'granted') {
      return null;
    }
    
    // Return token from registration listener
    return new Promise((resolve) => {
      PushNotifications.addListener('registration', (token: PushNotificationToken) => {
        resolve(token.value);
      });
      
      // Trigger registration
      PushNotifications.register();
      
      // Timeout after 5 seconds
      setTimeout(() => resolve(null), 5000);
    });
  } catch (error) {
    console.error('[Push] Failed to get FCM token:', error);
    return null;
  }
}

/**
 * Convert VAPID key from base64 to Uint8Array
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Request notification permissions
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  if (isNativePlatform()) {
    try {
      const { PushNotifications } = await import('@capacitor/push-notifications');
      const result = await PushNotifications.requestPermissions();
      return result.receive === 'granted';
    } catch (error) {
      console.error('[Push] Failed to request permissions:', error);
      return false;
    }
  } else {
    if (!('Notification' in window)) {
      return false;
    }
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }
}

/**
 * Check if notifications are enabled
 */
export async function areNotificationsEnabled(): Promise<boolean> {
  if (isNativePlatform()) {
    try {
      const { PushNotifications } = await import('@capacitor/push-notifications');
      const result = await PushNotifications.checkPermissions();
      return result.receive === 'granted';
    } catch (error) {
      return false;
    }
  } else {
    return 'Notification' in window && Notification.permission === 'granted';
  }
}
