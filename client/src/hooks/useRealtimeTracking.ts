import { useEffect, useState, useCallback } from 'react';
import { realtimeService, type DeliveryPersonLocation, type OrderUpdate } from '../services/realtimeService';

export interface UseRealtimeTrackingOptions {
  enabled?: boolean;
  onLocationUpdate?: (location: DeliveryPersonLocation) => void;
  onOrderUpdate?: (order: OrderUpdate) => void;
}

/**
 * Hook for real-time order and location tracking
 * Used in admin dashboard to see live delivery updates
 */
export function useRealtimeTracking(options: UseRealtimeTrackingOptions = {}) {
  const { enabled = true, onLocationUpdate, onOrderUpdate } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [deliveryPersons, setDeliveryPersons] = useState<Map<string, DeliveryPersonLocation>>(new Map());
  const [orders, setOrders] = useState<Map<string, OrderUpdate>>(new Map());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let mounted = true;

    const initRealtime = async () => {
      try {
        await realtimeService.connect();

        if (mounted) {
          setIsConnected(true);
          setError(null);
        }

        // Subscribe to location updates
        const unsubscribeLocation = realtimeService.subscribe('location', (location: DeliveryPersonLocation) => {
          if (mounted) {
            setDeliveryPersons((prev) => {
              const updated = new Map(prev);
              updated.set(location.userId, location);
              return updated;
            });

            onLocationUpdate?.(location);
          }
        });

        // Subscribe to order updates
        const unsubscribeOrder = realtimeService.subscribe('order', (order: OrderUpdate) => {
          if (mounted) {
            setOrders((prev) => {
              const updated = new Map(prev);
              updated.set(order.orderId, order);
              return updated;
            });

            onOrderUpdate?.(order);
          }
        });

        return () => {
          unsubscribeLocation();
          unsubscribeOrder();
        };
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to connect to realtime service');
          setIsConnected(false);
        }
      }
    };

    let cleanup: (() => void) | undefined;

    initRealtime().then((fn) => {
      cleanup = fn;
    });

    return () => {
      mounted = false;
      cleanup?.();
      if (mounted === false) {
        realtimeService.disconnect();
      }
    };
  }, [enabled, onLocationUpdate, onOrderUpdate]);

  const getDeliveryPersonLocation = useCallback((userId: string) => {
    return deliveryPersons.get(userId) || null;
  }, [deliveryPersons]);

  const getOrderStatus = useCallback((orderId: string) => {
    return orders.get(orderId) || null;
  }, [orders]);

  const getAllDeliveryPersons = useCallback(() => {
    return Array.from(deliveryPersons.values());
  }, [deliveryPersons]);

  const getAllOrders = useCallback(() => {
    return Array.from(orders.values());
  }, [orders]);

  return {
    isConnected,
    deliveryPersons: getAllDeliveryPersons(),
    orders: getAllOrders(),
    error,
    getDeliveryPersonLocation,
    getOrderStatus,
  };
}
