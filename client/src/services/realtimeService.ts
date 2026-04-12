/**
 * Real-time Order and Location Tracking Service
 * Enables admin dashboard to see live updates of deliveries
 */

export interface DeliveryPersonLocation {
  userId: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
  speed?: number;
  heading?: number;
}

export interface OrderUpdate {
  orderId: string;
  status: 'pending' | 'assigned' | 'picked_up' | 'in_delivery' | 'delivered' | 'cancelled';
  deliveryPersonId?: string;
  updatedAt: string;
  location?: DeliveryPersonLocation;
}

interface RealtimeListener {
  type: 'location' | 'order' | 'all';
  callback: (data: any) => void;
}

class RealtimeService {
  private websocket: WebSocket | null = null;
  private listeners: RealtimeListener[] = [];
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 5000;
  private isConnecting = false;

  /**
   * Connect to WebSocket server for real-time updates
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.websocket?.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      if (this.isConnecting) {
        resolve();
        return;
      }

      this.isConnecting = true;

      try {
        // Determine WebSocket URL based on environment
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        const wsUrl = `${protocol}//${host}/api/realtime`;

        console.log('[Realtime] Connecting to:', wsUrl);

        this.websocket = new WebSocket(wsUrl);

        this.websocket.onopen = () => {
          console.log('[Realtime] Connected');
          this.reconnectAttempts = 0;
          this.isConnecting = false;
          resolve();
        };

        this.websocket.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.websocket.onerror = (error) => {
          console.error('[Realtime] Error:', error);
          this.isConnecting = false;
          this.attemptReconnect();
          reject(error);
        };

        this.websocket.onclose = () => {
          console.log('[Realtime] Disconnected');
          this.isConnecting = false;
          this.attemptReconnect();
        };
      } catch (error) {
        this.isConnecting = false;
        console.error('[Realtime] Connection failed:', error);
        reject(error);
      }
    });
  }

  /**
   * Disconnect from WebSocket
   */
  disconnect() {
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }
    this.listeners = [];
  }

  /**
   * Subscribe to real-time updates
   */
  subscribe(
    type: 'location' | 'order' | 'all',
    callback: (data: any) => void
  ): () => void {
    const listener: RealtimeListener = { type, callback };
    this.listeners.push(listener);

    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Handle incoming WebSocket message
   */
  private handleMessage(data: string) {
    try {
      const message = JSON.parse(data);

      if (message.type === 'location') {
        this.notifyListeners('location', message.data);
        this.notifyListeners('all', { type: 'location', data: message.data });
      } else if (message.type === 'order') {
        this.notifyListeners('order', message.data);
        this.notifyListeners('all', { type: 'order', data: message.data });
      }
    } catch (error) {
      console.error('[Realtime] Error parsing message:', error);
    }
  }

  /**
   * Notify all subscribed listeners
   */
  private notifyListeners(type: string, data: any) {
    this.listeners.forEach((listener) => {
      if (listener.type === type || listener.type === 'all') {
        try {
          listener.callback(data);
        } catch (error) {
          console.error('[Realtime] Error in listener callback:', error);
        }
      }
    });
  }

  /**
   * Send message to server
   */
  send(data: any) {
    if (this.websocket?.readyState === WebSocket.OPEN) {
      this.websocket.send(JSON.stringify(data));
    } else {
      console.warn('[Realtime] WebSocket not connected');
    }
  }

  /**
   * Attempt to reconnect
   */
  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[Realtime] Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    console.log(`[Realtime] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    setTimeout(() => {
      this.connect().catch((error) => {
        console.error('[Realtime] Reconnect failed:', error);
      });
    }, delay);
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.websocket?.readyState === WebSocket.OPEN;
  }
}

export const realtimeService = new RealtimeService();
