/**
 * Background Location Service
 * يستخدم Capacitor Background Geolocation للتتبع المستمر حتى عند إغلاق التطبيق
 */

import { Capacitor } from '@capacitor/core';
import { registerPlugin } from '@capacitor/core';

// Types
interface LocationData {
  latitude: number;
  longitude: number;
  accuracy?: number;
  speed?: number;
  heading?: number;
  altitude?: number;
  timestamp: number;
}

interface BackgroundGeolocationLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
  speed?: number | null;
  bearing?: number | null;
  altitude?: number | null;
  time?: number;
}

interface BackgroundGeolocationError {
  code?: string;
  message?: string;
}

interface BackgroundGeolocationPlugin {
  addWatcher(
    options: {
      backgroundMessage?: string;
      backgroundTitle?: string;
      requestPermissions?: boolean;
      stale?: boolean;
      distanceFilter?: number;
    },
    callback: (location: BackgroundGeolocationLocation | null, error: BackgroundGeolocationError | null) => void
  ): Promise<string>;
  removeWatcher(options: { id: string }): Promise<void>;
}

// Register the plugin
const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>('BackgroundGeolocation');

type LocationCallback = (location: LocationData) => void;
type ErrorCallback = (error: Error) => void;

// Store callbacks
let locationCallback: LocationCallback | null = null;
let errorCallback: ErrorCallback | null = null;
let isTracking = false;
let watchId: string | number | null = null;
let intervalId: ReturnType<typeof setInterval> | null = null;

/**
 * Check if running on native platform (Android/iOS)
 */
export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Start background location tracking
 */
export async function startBackgroundTracking(
  onLocation: LocationCallback,
  onError?: ErrorCallback
): Promise<boolean> {
  locationCallback = onLocation;
  errorCallback = onError || null;

  if (isNativePlatform()) {
    // Use Capacitor Background Geolocation for native apps
    try {
      // Configure the plugin
      const id = await BackgroundGeolocation.addWatcher(
        {
          backgroundMessage: "جاري تتبع موقعك لتحديث الإدارة",
          backgroundTitle: "جونيا للتوصيل",
          requestPermissions: true,
          stale: false,
          distanceFilter: 10, // Update every 10 meters
        },
        (location: BackgroundGeolocationLocation | null, error: BackgroundGeolocationError | null) => {
          if (error) {
            console.error('[BackgroundLocation] Error:', error);
            if (errorCallback) {
              errorCallback(new Error(error.message || 'Location error'));
            }
            return;
          }
          
          if (location && locationCallback) {
            console.log('[BackgroundLocation] Got location:', location);
            locationCallback({
              latitude: location.latitude,
              longitude: location.longitude,
              accuracy: location.accuracy,
              speed: location.speed || undefined,
              heading: location.bearing || undefined,
              altitude: location.altitude || undefined,
              timestamp: Date.now(),
            });
          }
        }
      );
      
      watchId = id;
      console.log('[BackgroundLocation] Watcher started with ID:', watchId);
      
      isTracking = true;
      console.log('[BackgroundLocation] Native tracking started');
      return true;
    } catch (error) {
      console.error('[BackgroundLocation] Failed to start native tracking:', error);
      // Fallback to web geolocation
      return startWebTracking();
    }
  } else {
    // Use web geolocation for browsers
    return startWebTracking();
  }
}

/**
 * Start web-based location tracking (fallback)
 */
function startWebTracking(): boolean {
  if (!('geolocation' in navigator)) {
    console.error('[BackgroundLocation] Geolocation not supported');
    return false;
  }

  // Use watchPosition for continuous tracking
  watchId = navigator.geolocation.watchPosition(
    (position) => {
      if (locationCallback) {
        locationCallback({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          speed: position.coords.speed || undefined,
          heading: position.coords.heading || undefined,
          altitude: position.coords.altitude || undefined,
          timestamp: position.timestamp,
        });
      }
    },
    (error) => {
      console.error('[BackgroundLocation] Web geolocation error:', error);
      if (errorCallback) {
        errorCallback(new Error(error.message));
      }
    },
    {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    }
  );

  // Also set up interval-based tracking for more frequent updates
  intervalId = setInterval(() => {
    if (!isTracking) {
      if (intervalId) clearInterval(intervalId);
      return;
    }
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (locationCallback) {
          locationCallback({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            speed: position.coords.speed || undefined,
            heading: position.coords.heading || undefined,
            altitude: position.coords.altitude || undefined,
            timestamp: position.timestamp,
          });
        }
      },
      () => {}, // Ignore errors for interval-based tracking
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, 15000); // Every 15 seconds

  isTracking = true;
  console.log('[BackgroundLocation] Web tracking started');
  return true;
}

/**
 * Stop background location tracking
 */
export async function stopBackgroundTracking(): Promise<void> {
  isTracking = false;
  
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  
  if (isNativePlatform() && watchId !== null && typeof watchId === 'string') {
    try {
      await BackgroundGeolocation.removeWatcher({ id: watchId });
      console.log('[BackgroundLocation] Native tracking stopped');
    } catch (error) {
      console.error('[BackgroundLocation] Error stopping native tracking:', error);
    }
  } else if (watchId !== null && typeof watchId === 'number') {
    navigator.geolocation.clearWatch(watchId);
    console.log('[BackgroundLocation] Web tracking stopped');
  }
  
  watchId = null;
  locationCallback = null;
  errorCallback = null;
}

/**
 * Check if tracking is active
 */
export function isTrackingActive(): boolean {
  return isTracking;
}

/**
 * Request location permissions
 */
export async function requestLocationPermissions(): Promise<boolean> {
  if (isNativePlatform()) {
    try {
      // Start and immediately stop to trigger permission request
      const id = await BackgroundGeolocation.addWatcher(
        {
          backgroundMessage: "جاري تتبع موقعك",
          backgroundTitle: "جونيا للتوصيل",
          requestPermissions: true,
          stale: true,
        },
        () => {}
      );
      
      await BackgroundGeolocation.removeWatcher({ id });
      console.log('[BackgroundLocation] Permissions requested');
      return true;
    } catch (error) {
      console.error('[BackgroundLocation] Permission request failed:', error);
      return false;
    }
  } else {
    // Web permission request
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        () => resolve(true),
        () => resolve(false),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  }
}

/**
 * Get current location once
 */
export async function getCurrentLocation(): Promise<LocationData | null> {
  if (isNativePlatform()) {
    try {
      const { Geolocation } = await import('@capacitor/geolocation');
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
      });
      
      return {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        speed: position.coords.speed || undefined,
        heading: position.coords.heading || undefined,
        altitude: position.coords.altitude || undefined,
        timestamp: position.timestamp,
      };
    } catch (error) {
      console.error('[BackgroundLocation] Failed to get current location:', error);
      return null;
    }
  } else {
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            speed: position.coords.speed || undefined,
            heading: position.coords.heading || undefined,
            altitude: position.coords.altitude || undefined,
            timestamp: position.timestamp,
          });
        },
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  }
}
