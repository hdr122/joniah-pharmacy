import { BackgroundGeolocation } from '@capacitor-community/background-geolocation';
import { Geolocation } from '@capacitor/geolocation';

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
  altitude?: number;
  altitudeAccuracy?: number;
  heading?: number;
  speed?: number;
}

class BackgroundGeolocationService {
  private isTracking = false;
  private locationUpdateCallback: ((location: LocationData) => void) | null = null;
  private sendLocationInterval: NodeJS.Timeout | null = null;

  /**
   * Start background location tracking
   */
  async startTracking(onLocationUpdate?: (location: LocationData) => void) {
    try {
      if (this.isTracking) {
        console.log('[BackgroundGeo] Already tracking');
        return;
      }

      this.locationUpdateCallback = onLocationUpdate || null;

      // Start background geolocation
      await BackgroundGeolocation.start();

      // Listen for location updates
      BackgroundGeolocation.onLocation((location) => {
        this.handleLocationUpdate(location);
      });

      // Listen for errors
      BackgroundGeolocation.onError((error) => {
        console.error('[BackgroundGeo] Error:', error);
      });

      // Also get real-time location updates for foreground
      this.startForegroundTracking();

      this.isTracking = true;
      console.log('[BackgroundGeo] Tracking started');
    } catch (error) {
      console.error('[BackgroundGeo] Failed to start tracking:', error);
    }
  }

  /**
   * Stop background location tracking
   */
  async stopTracking() {
    try {
      if (!this.isTracking) {
        return;
      }

      await BackgroundGeolocation.stop();
      this.isTracking = false;

      if (this.sendLocationInterval) {
        clearInterval(this.sendLocationInterval);
      }

      console.log('[BackgroundGeo] Tracking stopped');
    } catch (error) {
      console.error('[BackgroundGeo] Failed to stop tracking:', error);
    }
  }

  /**
   * Start foreground location tracking
   */
  private startForegroundTracking() {
    // Update location every 10 seconds when app is in foreground
    this.sendLocationInterval = setInterval(async () => {
      try {
        const coordinates = await Geolocation.getCurrentPosition();

        if (coordinates) {
          const location: LocationData = {
            latitude: coordinates.coords.latitude,
            longitude: coordinates.coords.longitude,
            accuracy: coordinates.coords.accuracy || 0,
            altitude: coordinates.coords.altitude || undefined,
            altitudeAccuracy: coordinates.coords.altitudeAccuracy || undefined,
            heading: coordinates.coords.heading || undefined,
            speed: coordinates.coords.speed || undefined,
            timestamp: coordinates.timestamp,
          };

          this.handleLocationUpdate(location);
        }
      } catch (error) {
        console.error('[BackgroundGeo] Error getting position:', error);
      }
    }, 10000); // Every 10 seconds
  }

  /**
   * Handle location update
   */
  private async handleLocationUpdate(location: any) {
    // Convert to standard format
    const locationData: LocationData = {
      latitude: location.latitude,
      longitude: location.longitude,
      accuracy: location.accuracy || 0,
      altitude: location.altitude,
      altitudeAccuracy: location.altitudeAccuracy,
      heading: location.heading,
      speed: location.speed,
      timestamp: location.time || Date.now(),
    };

    console.log('[BackgroundGeo] Location update:', {
      lat: locationData.latitude.toFixed(4),
      lng: locationData.longitude.toFixed(4),
    });

    // Call callback if provided
    if (this.locationUpdateCallback) {
      this.locationUpdateCallback(locationData);
    }

    // Send to server
    await this.sendLocationToServer(locationData);
  }

  /**
   * Send location to server
   */
  private async sendLocationToServer(location: LocationData) {
    try {
      // Will be called from tRPC router
      const response = await fetch('/api/deliveries/location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy,
          altitude: location.altitude,
          heading: location.heading,
          speed: location.speed,
          timestamp: location.timestamp,
        }),
      });

      if (!response.ok) {
        console.error('[BackgroundGeo] Failed to send location to server');
      }
    } catch (error) {
      console.error('[BackgroundGeo] Error sending location:', error);
      // Queue for retry
    }
  }

  /**
   * Check if tracking is active
   */
  isLocationTrackingActive(): boolean {
    return this.isTracking;
  }

  /**
   * Get current location
   */
  async getCurrentLocation(): Promise<LocationData | null> {
    try {
      const coordinates = await Geolocation.getCurrentPosition();

      return {
        latitude: coordinates.coords.latitude,
        longitude: coordinates.coords.longitude,
        accuracy: coordinates.coords.accuracy || 0,
        altitude: coordinates.coords.altitude || undefined,
        altitudeAccuracy: coordinates.coords.altitudeAccuracy || undefined,
        heading: coordinates.coords.heading || undefined,
        speed: coordinates.coords.speed || undefined,
        timestamp: coordinates.timestamp,
      };
    } catch (error) {
      console.error('[BackgroundGeo] Error getting current location:', error);
      return null;
    }
  }

  /**
   * Request location permission
   */
  async requestLocationPermission() {
    try {
      const permission = await Geolocation.requestPermissions();
      console.log('[BackgroundGeo] Permission result:', permission);
      return permission.location === 'granted' || permission.location === 'prompt';
    } catch (error) {
      console.error('[BackgroundGeo] Permission request failed:', error);
      return false;
    }
  }
}

export const backgroundGeolocationService = new BackgroundGeolocationService();
