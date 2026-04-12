import type { Server as HTTPServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'http';

interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  isAlive?: boolean;
}

interface RealtimeMessage {
  type: 'location' | 'order' | 'ping' | 'subscribe' | 'unsubscribe';
  data?: any;
  userId?: string;
}

class WebSocketManager {
  private wss: WebSocketServer;
  private clients: Map<string, Set<AuthenticatedWebSocket>> = new Map();
  private userConnections: Map<string, AuthenticatedWebSocket> = new Map();

  constructor(server: HTTPServer) {
    this.wss = new WebSocketServer({
      server,
      path: '/api/realtime',
      clientTracking: false, // We manage clients manually
    });

    this.setupServer();
  }

  private setupServer() {
    this.wss.on('connection', (ws: AuthenticatedWebSocket, req: IncomingMessage) => {
      console.log('[WebSocket] New connection');

      ws.isAlive = true;

      // Handle messages
      ws.on('message', (data) => {
        this.handleMessage(ws, data);
      });

      // Handle close
      ws.on('close', () => {
        this.handleClose(ws);
      });

      // Handle ping/pong for keep-alive
      ws.on('pong', () => {
        ws.isAlive = true;
      });

      // Send welcome message
      ws.send(JSON.stringify({ type: 'connected', message: 'Connected to real-time service' }));
    });

    // Keep-alive ping interval
    setInterval(() => {
      this.wss.clients?.forEach((ws: AuthenticatedWebSocket) => {
        if (ws.isAlive === false) {
          return ws.terminate();
        }
        ws.isAlive = false;
        ws.ping(() => {});
      });
    }, 30000);
  }

  private handleMessage(ws: AuthenticatedWebSocket, data: Buffer) {
    try {
      const message: RealtimeMessage = JSON.parse(data.toString());

      switch (message.type) {
        case 'subscribe':
          this.subscribe(ws, message.userId || '');
          break;
        case 'location':
          this.broadcastLocationUpdate(message.data);
          break;
        case 'order':
          this.broadcastOrderUpdate(message.data);
          break;
        case 'ping':
          ws.send(JSON.stringify({ type: 'pong' }));
          break;
        default:
          console.log('[WebSocket] Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('[WebSocket] Error handling message:', error);
    }
  }

  private handleClose(ws: AuthenticatedWebSocket) {
    console.log('[WebSocket] Connection closed');

    if (ws.userId) {
      // Remove from user connections
      const connections = this.clients.get(ws.userId);
      if (connections) {
        connections.delete(ws);
        if (connections.size === 0) {
          this.clients.delete(ws.userId);
        }
      }

      this.userConnections.delete(ws.userId);
    }
  }

  private subscribe(ws: AuthenticatedWebSocket, userId: string) {
    ws.userId = userId;

    // Add to client map
    if (!this.clients.has(userId)) {
      this.clients.set(userId, new Set());
    }
    this.clients.get(userId)?.add(ws);

    // Track user connection
    this.userConnections.set(userId, ws);

    console.log(`[WebSocket] User ${userId} subscribed`);
  }

  /**
   * Broadcast location update to all connected admin clients
   */
  broadcastLocationUpdate(location: any) {
    const message = JSON.stringify({
      type: 'location',
      data: {
        userId: location.userId,
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy,
        timestamp: location.timestamp || Date.now(),
        speed: location.speed,
        heading: location.heading,
      },
    });

    // Send to all connected clients (they filter based on their needs)
    this.wss.clients?.forEach((client: AuthenticatedWebSocket) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  /**
   * Broadcast order update to all connected clients
   */
  broadcastOrderUpdate(order: any) {
    const message = JSON.stringify({
      type: 'order',
      data: {
        orderId: order.orderId,
        status: order.status,
        deliveryPersonId: order.deliveryPersonId,
        updatedAt: order.updatedAt || new Date().toISOString(),
        location: order.location,
      },
    });

    this.wss.clients?.forEach((client: AuthenticatedWebSocket) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  /**
   * Send message to specific user
   */
  sendToUser(userId: string, message: any) {
    const connections = this.clients.get(userId);
    if (connections) {
      const messageStr = JSON.stringify(message);
      connections.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(messageStr);
        }
      });
    }
  }

  /**
   * Get number of connected clients
   */
  getConnectedCount(): number {
    return this.wss.clients?.size || 0;
  }
}

export { WebSocketManager, WebSocketServer };
