import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { notificationService } from '@/services/notificationService';
import { backgroundGeolocationService } from '@/services/backgroundGeolocationService';
import { realtimeService } from '@/services/realtimeService';
import { useCustomAuth } from '@/hooks/useCustomAuth';

/**
 * Component to initialize app services on mount
 * - Sets up push notifications
 * - Initializes real-time tracking
 * - Starts background location for delivery persons
 */
export function AppInitializer() {
  const { user, isDelivery, isAdmin } = useCustomAuth();

  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Capacitor plugins (push notifications, background geolocation)
        // only exist inside the native mobile app
        const isNative = Capacitor.isNativePlatform();

        // Initialize push notifications for all users
        if (user && isNative) {
          console.log('[AppInit] Initializing notifications...');
          await notificationService.initialize();
        }

        // For delivery persons: start background location tracking
        if (user && isDelivery && isNative) {
          console.log('[AppInit] Starting background location tracking...');
          // Don't wait for this, let it initialize in background
          backgroundGeolocationService.startTracking();
        }

        // For admins: connect to real-time tracking service
        if (user && isAdmin) {
          console.log('[AppInit] Connecting to real-time service...');
          // Don't wait for this, let it initialize in background
          realtimeService.connect().catch((error) => {
            console.error('[AppInit] Real-time connection failed:', error);
          });
        }
      } catch (error) {
        console.error('[AppInit] Error initializing services:', error);
      }
    };

    if (user) {
      initializeApp();
    }

    // Cleanup on unmount
    return () => {
      backgroundGeolocationService.stopTracking();
      realtimeService.disconnect();
    };
  }, [user?.id, isDelivery, isAdmin]);

  return null; // This component doesn't render anything
}
