// src/routers/realtime.ts
import { Hono } from "hono";
import type { Context } from "hono";

/**
 * Realtime WebSocket Router - Compatible con Supabase Realtime
 * 
 * Implementa el protocolo de Supabase Realtime para suscripciones a cambios en la base de datos
 */

interface WebSocketClient {
  ws: WebSocket;
  id: string;
  subscriptions: Set<string>;
  auth?: {
    token: string;
    user?: any;
  };
}

interface RealtimeMessage {
  type: 'phx_join' | 'phx_leave' | 'heartbeat' | 'presence' | 'broadcast' | 'postgres_changes' | 'phx_reply';
  topic: string;
  payload: any;
  ref?: string;
  join_ref?: string;
}

export class RealtimeServer {
  private clients: Map<string, WebSocketClient> = new Map();
  private subscriptions: Map<string, Set<string>> = new Map();

  constructor() {
    this.startHeartbeat();
  }

  /**
   * Maneja nuevas conexiones WebSocket
   */
  handleConnection(ws: WebSocket, request: Request) {
    // Get clientId from header if provided (from WebSocket server), otherwise generate one
    const clientId = request.headers.get('x-client-id') || this.generateClientId();
    
    // Check if this client already exists (reconnection)
    const existingClient = this.clients.get(clientId);
    const client: WebSocketClient = {
      ws,
      id: clientId,
      subscriptions: existingClient ? existingClient.subscriptions : new Set(),
    };

    this.clients.set(clientId, client);

    ws.onmessage = (event) => this.handleMessage(clientId, event.data.toString());
    ws.onclose = () => this.handleDisconnect(clientId);
    ws.onerror = (event) => {
      console.error(`WebSocket error for client ${clientId}:`, event);
      this.handleDisconnect(clientId);
    };

    // Send welcome message
    this.sendToClient(clientId, {
      type: 'phx_reply',
      topic: 'phoenix',
      payload: { response: {}, status: 'ok' },
      ref: '1'
    });

    console.log(`WebSocket client connected: ${clientId}`);
  }

  /**
   * Maneja mensajes entrantes del cliente
   */
  public handleMessage(clientId: string, message: string) {
    try {
      const msg: RealtimeMessage = JSON.parse(message);
      const client = this.clients.get(clientId);

      if (!client) {
        console.error(`Client ${clientId} not found`);
        return;
      }

      console.log(`Received message from ${clientId}:`, msg);

      switch (msg.type) {
        case 'phx_join':
          this.handleSubscription(clientId, msg);
          break;
        case 'phx_leave':
          this.handleUnsubscription(clientId, msg);
          break;
        case 'heartbeat':
          this.handleHeartbeat(clientId, msg);
          break;
        default:
          console.log(`Unknown message type: ${msg.type}`);
      }
    } catch (error) {
      console.error(`Error handling message from ${clientId}:`, error);
    }
  }

  /**
   * Maneja suscripciones a topics
   */
  private handleSubscription(clientId: string, msg: RealtimeMessage) {
    const client = this.clients.get(clientId);
    if (!client) return;

    const { topic, payload, ref } = msg;

    // Add subscription
    client.subscriptions.add(topic);

    // Add to global subscriptions map
    if (!this.subscriptions.has(topic)) {
      this.subscriptions.set(topic, new Set());
    }
    this.subscriptions.get(topic)!.add(clientId);

    // Send confirmation
    this.sendToClient(clientId, {
      type: 'phx_reply',
      topic,
      payload: { response: { postgres_changes: payload?.config?.postgres_changes || [] }, status: 'ok' },
      ref
    });

    console.log(`Client ${clientId} subscribed to ${topic}`);

    // If subscribing to postgres changes, set up database listeners
    if (payload?.config?.postgres_changes) {
      this.setupDatabaseListeners(payload.config.postgres_changes);
    }
  }

  /**
   * Maneja desuscripciones
   */
  private handleUnsubscription(clientId: string, msg: RealtimeMessage) {
    const client = this.clients.get(clientId);
    if (!client) return;

    const { topic } = msg;

    // Remove subscription
    client.subscriptions.delete(topic);

    // Remove from global subscriptions map
    const topicSubs = this.subscriptions.get(topic);
    if (topicSubs) {
      topicSubs.delete(clientId);
      if (topicSubs.size === 0) {
        this.subscriptions.delete(topic);
      }
    }

    console.log(`Client ${clientId} unsubscribed from ${topic}`);
  }

  /**
   * Maneja heartbeat para mantener conexión viva
   */
  private handleHeartbeat(clientId: string, msg: RealtimeMessage) {
    this.sendToClient(clientId, {
      type: 'phx_reply',
      topic: 'phoenix',
      payload: { response: {}, status: 'ok' },
      ref: msg.ref
    });
  }

  /**
   * Maneja desconexiones
   */
  public handleDisconnect(clientId: string) {
    const client = this.clients.get(clientId);
    if (!client) return;

    // Remove from all subscriptions
    client.subscriptions.forEach(topic => {
      const topicSubs = this.subscriptions.get(topic);
      if (topicSubs) {
        topicSubs.delete(clientId);
        if (topicSubs.size === 0) {
          this.subscriptions.delete(topic);
        }
      }
    });

    this.clients.delete(clientId);
    console.log(`WebSocket client disconnected: ${clientId}`);
  }

  /**
   * Envía mensaje a un cliente específico
   */
  private sendToClient(clientId: string, message: any) {
    const client = this.clients.get(clientId);
    if (client && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(message));
    }
  }

  /**
   * Broadcast message to all clients subscribed to a topic
   */
  broadcastToTopic(topic: string, event: string, data: any) {
    const topicSubs = this.subscriptions.get(topic);
    if (!topicSubs) return;

    const message = {
      type: event, // Use the event type directly (e.g., 'postgres_changes')
      topic,
      payload: data
    };

    topicSubs.forEach(clientId => {
      this.sendToClient(clientId, message);
    });

    console.log(`Broadcasted to ${topic}: ${event}`, data);
  }

  /**
   * Notifica cambios en la base de datos a los suscriptores
   */
  notifyDatabaseChange(table: string, event: 'INSERT' | 'UPDATE' | 'DELETE', data: any) {
    const payload = {
      event,
      table,
      data,
      timestamp: new Date().toISOString()
    };
    
    // Notify specific table subscribers - use the channel topic format from client
    this.broadcastToTopic('db-changes', 'postgres_changes', payload);

    // Also notify using the old format for compatibility
    const topic = `realtime:${table}`;
    this.broadcastToTopic(topic, 'postgres_changes', payload);

    // Notify wildcard subscribers
    this.broadcastToTopic('realtime:*', 'postgres_changes', payload);
  }

  /**
   * Configura listeners de base de datos (placeholder para implementación real)
   */
  private setupDatabaseListeners(postgresChanges: any[]) {
    // This would integrate with PostgreSQL LISTEN/NOTIFY
    // For now, it's a placeholder that logs the intent
    console.log('Setting up database listeners for:', postgresChanges);
  }

  /**
   * Mantiene conexiones vivas con heartbeat
   */
  private startHeartbeat() {
    setInterval(() => {
      this.clients.forEach((client, clientId) => {
        if (client.ws.readyState === WebSocket.OPEN) {
          this.sendToClient(clientId, {
            type: 'heartbeat',
            topic: 'phoenix'
          });
        }
      });
    }, 30000); // 30 seconds
  }

  /**
   * Genera ID único para clientes
   */
  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Obtiene estadísticas del servidor
   */
  getStats() {
    return {
      connectedClients: this.clients.size,
      activeSubscriptions: this.subscriptions.size,
      topics: Array.from(this.subscriptions.keys())
    };
  }
}

// Create singleton instance
export const realtimeServer = new RealtimeServer();

// Create Hono router
export const realtimeRouter = new Hono();

/**
 * Health check endpoint
 */
realtimeRouter.get("/v1/health", (c) => {
  const stats = realtimeServer.getStats();
  return c.json({
    status: "ok",
    service: "realtime",
    version: "1.0.0",
    ...stats
  });
});

/**
 * Test endpoint to trigger database notifications
 */
realtimeRouter.post("/v1/test-notify", async (c) => {
  const { table, event, data } = await c.req.json();
  
  if (!table || !event || !data) {
    return c.json({ error: "Missing required fields: table, event, data" }, 400);
  }

  realtimeServer.notifyDatabaseChange(table, event, data);
  return c.json({ message: "Notification sent", table, event, data });
});

/**
 * WebSocket endpoint - simplified version for Bun
 * This will be handled by the main server setup
 */
realtimeRouter.get("/v1/websocket-info", (c) => {
  return c.json({
    endpoint: "/realtime/v1/websocket",
    protocol: "WebSocket",
    compatible: "Supabase Realtime",
    features: ["postgres_changes", "broadcast", "presence"],
    stats: realtimeServer.getStats()
  });
});

export default realtimeServer;