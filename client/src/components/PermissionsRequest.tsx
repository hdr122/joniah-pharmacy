import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Bell, MapPin, CheckCircle2, Loader2 } from 'lucide-react';
import { 
  requestNotificationPermission, 
  requestGeolocationPermission,
  checkPWAPermissions,
  registerServiceWorker,
  subscribeToPushNotifications,
  type PWAPermissions 
} from '@/lib/pwa';
import { 
  initializePushNotifications, 
  isNativePlatform
} from '@/lib/pushNotifications';
import { requestLocationPermissions as requestBackgroundLocationPermissions } from '@/lib/backgroundLocation';
import { trpc } from '@/lib/trpc';

interface PermissionsRequestProps {
  onPermissionsGranted?: () => void;
}

export function PermissionsRequest({ onPermissionsGranted }: PermissionsRequestProps) {
  const [permissions, setPermissions] = useState<PWAPermissions>({
    notifications: false,
    geolocation: false
  });
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  const pushSubscribeMutation = trpc.push.subscribe.useMutation();
  const updateFcmTokenMutation = trpc.notifications.updateFcmToken.useMutation();

  useEffect(() => {
    checkPermissions();
  }, []);

  const checkPermissions = async () => {
    setChecking(true);
    const perms = await checkPWAPermissions();
    setPermissions(perms);
    setChecking(false);
    
    // Check if user previously skipped or if all permissions are granted
    const hasSkipped = localStorage.getItem('permissions_skipped') === 'true';
    if ((perms.notifications && perms.geolocation) || hasSkipped) {
      if (onPermissionsGranted) {
        onPermissionsGranted();
      }
    }
  };

  const requestNotifications = async () => {
    setLoading(true);
    
    if (isNativePlatform()) {
      // Native app - use FCM
      const success = await initializePushNotifications(
        async (token) => {
          console.log('[Push] Got FCM token:', token);
          // Save FCM token to database
          try {
            await updateFcmTokenMutation.mutateAsync({ fcmToken: token });
            console.log('[Push] FCM token saved to database');
          } catch (error) {
            console.error('[Push] Failed to save FCM token:', error);
          }
        },
        (notification) => {
          console.log('[Push] Notification received:', notification);
        },
        (action) => {
          console.log('[Push] Action performed:', action);
          // Navigate based on notification data
          if (action.notification.data?.url) {
            window.location.href = action.notification.data.url;
          }
        }
      );
      
      setPermissions(prev => ({ ...prev, notifications: success }));
      setLoading(false);
      
      if (success && permissions.geolocation && onPermissionsGranted) {
        onPermissionsGranted();
      }
    } else {
      // Web app - use Web Push
      const granted = await requestNotificationPermission();
      
      if (granted) {
        // Subscribe to push notifications
        const registration = await registerServiceWorker();
        if (registration) {
          const subscription = await subscribeToPushNotifications(registration);
          if (subscription) {
            // Save subscription to database
            const subJSON = subscription.toJSON();
            await pushSubscribeMutation.mutateAsync({
              endpoint: subscription.endpoint,
              p256dh: subJSON.keys?.p256dh || '',
              auth: subJSON.keys?.auth || '',
            });
            console.log('[Push] Subscription saved to database');
          }
        }
      }
      
      setPermissions(prev => ({ ...prev, notifications: granted }));
      setLoading(false);
      
      if (granted && permissions.geolocation && onPermissionsGranted) {
        onPermissionsGranted();
      }
    }
  };

  const requestGeolocation = async () => {
    setLoading(true);
    
    let granted = false;
    
    if (isNativePlatform()) {
      // Native app - use background location
      granted = await requestBackgroundLocationPermissions();
    } else {
      // Web app - use standard geolocation
      granted = await requestGeolocationPermission();
    }
    
    setPermissions(prev => ({ ...prev, geolocation: granted }));
    setLoading(false);
    
    if (granted && permissions.notifications && onPermissionsGranted) {
      onPermissionsGranted();
    }
  };

  const requestAllPermissions = async () => {
    setLoading(true);
    
    let notifGranted = false;
    let geoGranted = false;
    
    if (isNativePlatform()) {
      // Native app
      notifGranted = await initializePushNotifications(
        async (token) => {
          console.log('[Push] Got FCM token:', token);
          try {
            await updateFcmTokenMutation.mutateAsync({ fcmToken: token });
            console.log('[Push] FCM token saved to database');
          } catch (error) {
            console.error('[Push] Failed to save FCM token:', error);
          }
        },
        (notification) => {
          console.log('[Push] Notification received:', notification);
        },
        (action) => {
          console.log('[Push] Action performed:', action);
          if (action.notification.data?.url) {
            window.location.href = action.notification.data.url;
          }
        }
      );
      
      geoGranted = await requestBackgroundLocationPermissions();
    } else {
      // Web app
      notifGranted = await requestNotificationPermission();
      
      if (notifGranted) {
        // Subscribe to push notifications
        const registration = await registerServiceWorker();
        if (registration) {
          const subscription = await subscribeToPushNotifications(registration);
          if (subscription) {
            // Save subscription to database
            const subJSON = subscription.toJSON();
            await pushSubscribeMutation.mutateAsync({
              endpoint: subscription.endpoint,
              p256dh: subJSON.keys?.p256dh || '',
              auth: subJSON.keys?.auth || '',
            });
            console.log('[Push] Subscription saved to database');
          }
        }
      }
      
      geoGranted = await requestGeolocationPermission();
    }
    
    setPermissions({
      notifications: notifGranted,
      geolocation: geoGranted
    });
    
    setLoading(false);
    
    if (notifGranted && geoGranted && onPermissionsGranted) {
      onPermissionsGranted();
    }
  };

  const allGranted = permissions.notifications && permissions.geolocation;

  if (checking) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-6">
      <Card className="border-emerald-200">
        <CardHeader>
          <CardTitle className="text-2xl text-center">
            {allGranted ? '✅ جميع الصلاحيات ممنوحة' : 'الصلاحيات المطلوبة'}
          </CardTitle>
          <CardDescription className="text-center">
            {allGranted 
              ? 'يمكنك الآن استخدام التطبيق بشكل كامل'
              : 'للحصول على أفضل تجربة، نحتاج إلى بعض الصلاحيات'
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Notifications Permission */}
          <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
            <div className="flex-shrink-0">
              {permissions.notifications ? (
                <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              ) : (
                <Bell className="w-6 h-6 text-gray-400" />
              )}
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-lg mb-1">الإشعارات</h3>
              <p className="text-sm text-gray-600 mb-3">
                للحصول على إشعارات فورية عند تعيين طلبات جديدة لك
              </p>
              {!permissions.notifications && (
                <Button 
                  onClick={requestNotifications}
                  disabled={loading}
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      جاري الطلب...
                    </>
                  ) : (
                    'السماح بالإشعارات'
                  )}
                </Button>
              )}
            </div>
          </div>

          {/* Geolocation Permission */}
          <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
            <div className="flex-shrink-0">
              {permissions.geolocation ? (
                <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              ) : (
                <MapPin className="w-6 h-6 text-gray-400" />
              )}
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-lg mb-1">تتبع الموقع</h3>
              <p className="text-sm text-gray-600 mb-3">
                لتتبع موقعك أثناء التوصيل وتحديث الإدارة بموقعك الحالي
                {isNativePlatform() && (
                  <span className="block text-xs text-emerald-600 mt-1">
                    ✓ يعمل حتى عند إغلاق التطبيق
                  </span>
                )}
              </p>
              {!permissions.geolocation && (
                <Button 
                  onClick={requestGeolocation}
                  disabled={loading}
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      جاري الطلب...
                    </>
                  ) : (
                    'السماح بتتبع الموقع'
                  )}
                </Button>
              )}
            </div>
          </div>

          {/* Request All Button */}
          {!allGranted && (
            <div className="pt-4 border-t space-y-3">
              <Button 
                onClick={requestAllPermissions}
                disabled={loading}
                className="w-full bg-emerald-600 hover:bg-emerald-700"
                size="lg"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    جاري طلب الصلاحيات...
                  </>
                ) : (
                  'السماح بجميع الصلاحيات'
                )}
              </Button>
              
              {/* Skip Button */}
              <Button 
                onClick={() => {
                  // Save skip preference to localStorage
                  localStorage.setItem('permissions_skipped', 'true');
                  // Call the callback to proceed
                  if (onPermissionsGranted) {
                    onPermissionsGranted();
                  }
                }}
                disabled={loading}
                variant="outline"
                className="w-full"
                size="lg"
              >
                تخطي الآن
              </Button>
            </div>
          )}

          {/* Info Note */}
          <div className="text-sm text-gray-500 text-center pt-2">
            💡 يمكنك تغيير هذه الصلاحيات لاحقاً من إعدادات {isNativePlatform() ? 'التطبيق' : 'المتصفح'}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
