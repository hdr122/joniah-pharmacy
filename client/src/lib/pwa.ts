/**
 * PWA Utilities - Service Worker Registration & Permissions
 */

export interface PWAPermissions {
  notifications: boolean;
  geolocation: boolean;
}

/**
 * Register service worker
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('[PWA] Service Worker registered successfully:', registration);
      return registration;
    } catch (error) {
      console.error('[PWA] Service Worker registration failed:', error);
      return null;
    }
  }
  return null;
}

/**
 * Request notification permission
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    console.warn('[PWA] Notifications not supported');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    try {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    } catch (error) {
      console.error('[PWA] Notification permission request failed:', error);
      return false;
    }
  }

  return false;
}

/**
 * Request geolocation permission - IMPROVED VERSION
 * This will trigger the browser's permission prompt
 */
export async function requestGeolocationPermission(): Promise<boolean> {
  if (!('geolocation' in navigator)) {
    console.warn('[PWA] Geolocation not supported');
    alert('متصفحك لا يدعم تحديد الموقع الجغرافي');
    return false;
  }

  return new Promise((resolve) => {
    console.log('[PWA] Requesting geolocation permission...');
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        console.log('[PWA] Geolocation permission granted:', position);
        resolve(true);
      },
      (error) => {
        console.error('[PWA] Geolocation permission error:', error);
        
        // Show user-friendly error messages
        switch (error.code) {
          case error.PERMISSION_DENIED:
            alert('تم رفض صلاحية الوصول للموقع. يرجى السماح بالوصول من إعدادات المتصفح.');
            break;
          case error.POSITION_UNAVAILABLE:
            alert('لا يمكن تحديد الموقع. تأكد من تفعيل GPS على جهازك.');
            break;
          case error.TIMEOUT:
            alert('انتهت مهلة طلب الموقع. حاول مرة أخرى.');
            break;
          default:
            alert('فشل الحصول على الموقع. حاول مرة أخرى.');
        }
        
        resolve(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  });
}

/**
 * Check all PWA permissions
 */
export async function checkPWAPermissions(): Promise<PWAPermissions> {
  const notifications = 'Notification' in window && Notification.permission === 'granted';
  
  // Check geolocation permission
  let geolocation = false;
  if ('geolocation' in navigator) {
    // Try to check permission status if available
    if ('permissions' in navigator) {
      try {
        const result = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
        geolocation = result.state === 'granted';
      } catch {
        // Fallback: try to get position with cached data
        try {
          await new Promise<void>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(
              () => resolve(),
              () => reject(),
              { timeout: 1000, maximumAge: Infinity }
            );
          });
          geolocation = true;
        } catch {
          geolocation = false;
        }
      }
    }
  }

  return { notifications, geolocation };
}

/**
 * Request all PWA permissions
 */
export async function requestAllPermissions(): Promise<PWAPermissions> {
  console.log('[PWA] Requesting all permissions...');
  
  // Request geolocation first (more important for delivery app)
  const geolocation = await requestGeolocationPermission();
  
  // Then request notifications
  const notifications = await requestNotificationPermission();
  
  return { notifications, geolocation };
}

/**
 * Check if app can be installed (PWA)
 */
export function canInstallPWA(): boolean {
  return 'BeforeInstallPromptEvent' in window || 
         (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
}

/**
 * Check if app is already installed
 */
export function isAppInstalled(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches ||
         (window.navigator as any).standalone === true;
}

/**
 * Subscribe to push notifications
 */
export async function subscribeToPushNotifications(
  registration: ServiceWorkerRegistration
): Promise<PushSubscription | null> {
  try {
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(
        'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDJo3YTIThzWIToeBO3NuMa_Fk1_6Vu_5-xYDx-0_Yl4'
      ) as BufferSource
    });
    
    console.log('[PWA] Push subscription successful:', subscription);
    return subscription;
  } catch (error) {
    console.error('[PWA] Push subscription failed:', error);
    return null;
  }
}

/**
 * Convert VAPID key from base64 to Uint8Array
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Start tracking geolocation (for delivery persons)
 */
export function startGeolocationTracking(
  onPosition: (position: GeolocationPosition) => void,
  onError?: (error: GeolocationPositionError) => void
): number {
  if (!('geolocation' in navigator)) {
    console.error('[PWA] Geolocation not supported');
    return -1;
  }

  const watchId = navigator.geolocation.watchPosition(
    onPosition,
    onError || ((error) => {
      console.error('[PWA] Geolocation error:', error);
      
      // Show user-friendly error messages
      switch (error.code) {
        case error.PERMISSION_DENIED:
          console.error('[PWA] User denied geolocation permission');
          break;
        case error.POSITION_UNAVAILABLE:
          console.error('[PWA] Position unavailable');
          break;
        case error.TIMEOUT:
          console.error('[PWA] Geolocation timeout');
          break;
      }
    }),
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    }
  );

  console.log('[PWA] Geolocation tracking started, watch ID:', watchId);
  return watchId;
}

/**
 * Stop tracking geolocation
 */
export function stopGeolocationTracking(watchId: number): void {
  if (watchId !== -1) {
    navigator.geolocation.clearWatch(watchId);
    console.log('[PWA] Geolocation tracking stopped');
  }
}
