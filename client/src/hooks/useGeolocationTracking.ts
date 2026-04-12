import { useEffect, useRef, useState } from 'react';
import { trpc } from '@/lib/trpc';
import { startGeolocationTracking, stopGeolocationTracking } from '@/lib/pwa';

interface GeolocationState {
  latitude: string | null;
  longitude: string | null;
  accuracy: string | null;
  error: string | null;
  tracking: boolean;
}

/**
 * Hook for tracking delivery person's location
 * Automatically sends location updates to the server every 30 seconds
 */
export function useGeolocationTracking(enabled: boolean = false) {
  const [state, setState] = useState<GeolocationState>({
    latitude: null,
    longitude: null,
    accuracy: null,
    error: null,
    tracking: false
  });
  
  const watchIdRef = useRef<number>(-1);
  const lastUpdateRef = useRef<number>(0);
  const updateIntervalMs = 30000; // 30 seconds

  const saveLocationMutation = trpc.gps.saveLocation.useMutation();

  useEffect(() => {
    if (!enabled) {
      if (watchIdRef.current !== -1) {
        stopGeolocationTracking(watchIdRef.current);
        watchIdRef.current = -1;
        setState(prev => ({ ...prev, tracking: false }));
      }
      return;
    }

    // Start tracking
    watchIdRef.current = startGeolocationTracking(
      (position) => {
        const latitude = position.coords.latitude.toFixed(6);
        const longitude = position.coords.longitude.toFixed(6);
        const accuracy = position.coords.accuracy.toFixed(2);

        setState({
          latitude,
          longitude,
          accuracy,
          error: null,
          tracking: true
        });

        // Send to server every 30 seconds
        const now = Date.now();
        if (now - lastUpdateRef.current >= updateIntervalMs) {
          lastUpdateRef.current = now;
          
          saveLocationMutation.mutate({
            latitude,
            longitude,
            accuracy
          }, {
            onSuccess: () => {
              console.log('[Geolocation] Location saved successfully');
            },
            onError: (error) => {
              console.error('[Geolocation] Failed to save location:', error);
            }
          });
        }
      },
      (error) => {
        setState(prev => ({
          ...prev,
          error: error.message,
          tracking: false
        }));
      }
    );

    // Cleanup
    return () => {
      if (watchIdRef.current !== -1) {
        stopGeolocationTracking(watchIdRef.current);
        watchIdRef.current = -1;
      }
    };
  }, [enabled]);

  return state;
}
