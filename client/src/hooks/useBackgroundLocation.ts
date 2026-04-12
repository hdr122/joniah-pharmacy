import { useEffect, useState } from 'react';
import { backgroundGeolocationService, type LocationData } from '../services/backgroundGeolocationService';

export interface UseBackgroundLocationOptions {
  enabled?: boolean;
  onLocationUpdate?: (location: LocationData) => void;
}

/**
 * Hook for background location tracking
 * Automatically starts tracking when component mounts and stops when unmounts
 */
export function useBackgroundLocation(options: UseBackgroundLocationOptions = {}) {
  const { enabled = true, onLocationUpdate } = options;

  const [isTracking, setIsTracking] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let mounted = true;

    const initTracking = async () => {
      try {
        // Request permission first
        const hasPermission = await backgroundGeolocationService.requestLocationPermission();

        if (!hasPermission) {
          setError('Location permission denied');
          return;
        }

        // Start tracking with callback
        backgroundGeolocationService.startTracking((location) => {
          if (mounted) {
            setCurrentLocation(location);
            onLocationUpdate?.(location);
          }
        });

        if (mounted) {
          setIsTracking(true);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to start tracking');
        }
      }
    };

    initTracking();

    // Cleanup function
    return () => {
      mounted = false;
      backgroundGeolocationService.stopTracking();
    };
  }, [enabled, onLocationUpdate]);

  const getCurrentLocation = async () => {
    return backgroundGeolocationService.getCurrentLocation();
  };

  const startTracking = async () => {
    try {
      const hasPermission = await backgroundGeolocationService.requestLocationPermission();
      if (!hasPermission) {
        setError('Location permission denied');
        return;
      }

      backgroundGeolocationService.startTracking(onLocationUpdate);
      setIsTracking(true);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start tracking');
    }
  };

  const stopTracking = async () => {
    try {
      backgroundGeolocationService.stopTracking();
      setIsTracking(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stop tracking');
    }
  };

  return {
    isTracking,
    currentLocation,
    error,
    startTracking,
    stopTracking,
    getCurrentLocation,
  };
}
