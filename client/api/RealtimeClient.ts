// client/api/RealtimeClient.ts
import type { ApiConfig } from "../config/apiConfig";

/**
 * RealtimeClient - Cliente WebSocket compatible con Supabase Realtime
 * 
 * Proporciona una interfaz similar a Supabase para suscripciones en tiempo real
 * 
 * Ejemplo de uso:
 * ```typescript
 * const client = new RealtimeClient();
 * const subscription = client
 *   .channel('db-changes')
 *   .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, (payload) => {
 *     console.log('Cambio en users:', payload);
 *   })
 *   .subscribe();
 * ```
 */

interface RealtimeChannel {
  topic: string;
  subscriptions: Array<{
    event: string;
    filter: any;
    callback: (payload: any) => void;
  }>;
  joined: boolean;
}

interface PostgresChangesFilter {
  event: '*' | 'INSERT' | 'UPDATE' | 'DELETE';
  schema: string;
  table: string;
  filter?: string;
}

interface RealtimeMessage {
  type: 'phx_join' | 'phx_leave' | 'heartbeat' | 'broadcast' | 'phx_reply' | 'postgres_changes';
  topic: string;
  payload: any;
  ref?: string;
  join_ref?: string;
}

interface RealtimePayload {
  type: string;
  data: any;
  timestamp: string;
}

export class RealtimeClient {
  private ws: WebSocket | null = null;
  private channels: Map<string, RealtimeChannel> = new Map();
  private messageHandlers: Map<string, (payload: any) => void> = new Map();
  private refCounter: number = 0;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 1000;
  private heartbeatInterval: number | null = null;
  private isConnected: boolean = false;
  private config: ApiConfig;

  constructor(config?: ApiConfig) {
    this.config = config || {
      host: '127.0.0.1',
      port: 3000,
      protocol: 'http',
      getFullUrl: function() { return `${this.protocol}://${this.host}:${this.port}`; },
      update: function() { console.log('API config updated'); }
    };
  }

  /**
   * Conecta al servidor WebSocket
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      const wsUrl = this.config.getFullUrl().replace('http://', 'ws://').replace('https://', 'wss://');
      const websocketUrl = `${wsUrl}/realtime/v1/websocket`;

      console.log(`Connecting to WebSocket: ${websocketUrl}`);

      this.ws = new WebSocket(websocketUrl, ['realtime']);

      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.startHeartbeat();
        this.resubscribeToChannels();
        resolve();
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event.data);
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        reject(error);
      };

      this.ws.onclose = () => {
        console.log('WebSocket disconnected');
        this.isConnected = false;
        this.stopHeartbeat();
        this.attemptReconnect();
      };
    });
  }

  /**
   * Desconecta del servidor WebSocket
   */
  disconnect() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.isConnected = false;
    this.channels.clear();
    this.messageHandlers.clear();
  }

  /**
   * Crea un canal de suscripción
   */
  channel(topic: string): RealtimeChannelBuilder {
    return new RealtimeChannelBuilder(this, topic);
  }

  /**
   * Maneja mensajes entrantes del WebSocket
   */
  private handleMessage(data: string) {
    try {
      const message: RealtimeMessage = JSON.parse(data);
      console.log('Received WebSocket message:', message);

      switch (message.type) {
        case 'phx_reply':
          this.handlePhxReply(message);
          break;
        case 'broadcast':
          this.handleBroadcast(message);
          break;
        case 'postgres_changes':
          this.handlePostgresChanges(message);
          break;
        default:
          console.log(`Unknown message type: ${message.type}`);
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error);
    }
  }

  /**
   * Maneja respuestas del servidor
   */
  private handlePhxReply(message: RealtimeMessage) {
    const { topic, payload } = message;
    
    if (payload.status === 'ok') {
      const channel = this.channels.get(topic);
      if (channel) {
        channel.joined = true;
        console.log(`Successfully joined channel: ${topic}`);
      }
    }
  }

  /**
   * Maneja mensajes de broadcast
   */
  private handleBroadcast(message: RealtimeMessage) {
    const { topic, payload } = message;
    const handler = this.messageHandlers.get(`${topic}:broadcast`);
    
    if (handler) {
      handler(payload);
    }
  }

  /**
   * Maneja cambios en la base de datos
   */
  private handlePostgresChanges(message: RealtimeMessage) {
    const { topic, payload } = message;
    
    // Notify all subscribers for this table
    const table = payload.table;
    if (table) {
      const handler = this.messageHandlers.get(`${topic}:postgres_changes:${table}`);
      if (handler) {
        handler(payload);
      }
      
      // Also notify wildcard subscribers
      const wildcardHandler = this.messageHandlers.get(`${topic}:postgres_changes:*`);
      if (wildcardHandler) {
        wildcardHandler(payload);
      }
    }
  }

  /**
   * Envía mensaje al servidor
   */
  send(message: RealtimeMessage) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket not connected, message not sent:', message);
    }
  }

  /**
   * Inicia heartbeat para mantener la conexión viva
   */
  private startHeartbeat() {
    this.heartbeatInterval = window.setInterval(() => {
      this.send({
        type: 'heartbeat',
        topic: 'phoenix',
        payload: {}
      });
    }, 30000); // 30 seconds
  }

  /**
   * Detiene el heartbeat
   */
  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Intenta reconectar tras una desconexión
   */
  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // Exponential backoff

    console.log(`Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);

    setTimeout(() => {
      this.connect().catch((error) => {
        console.error('Reconnection failed:', error);
      });
    }, delay);
  }

  /**
   * Vuelve a suscribirse a todos los canales tras reconexión
   */
  private resubscribeToChannels() {
    this.channels.forEach((channel, topic) => {
      if (channel.joined) {
        this.joinChannel(topic, channel);
      }
    });
  }

  /**
   * Se une a un canal
   */
  joinChannel(topic: string, channel: RealtimeChannel) {
    const message: RealtimeMessage = {
      type: 'phx_join',
      topic,
      payload: {
        config: {
          postgres_changes: channel.subscriptions
            .filter(sub => sub.event === 'postgres_changes')
            .map(sub => sub.filter)
        }
      },
      ref: this.generateRef()
    };

    this.send(message);
  }

  /**
   * Se desune de un canal
   */
  leaveChannel(topic: string) {
    const message: RealtimeMessage = {
      type: 'phx_leave',
      topic,
      payload: {},
      ref: this.generateRef()
    };

    this.send(message);
    this.channels.delete(topic);
  }

  /**
   * Registra un handler para mensajes
   */
  registerHandler(key: string, handler: (payload: any) => void) {
    this.messageHandlers.set(key, handler);
  }

  /**
   * Elimina un handler
   */
  unregisterHandler(key: string) {
    this.messageHandlers.delete(key);
  }

  /**
   * Genera un ID de referencia único
   */
  private generateRef(): string {
    return `ref_${++this.refCounter}`;
  }

  /**
   * Obtiene el estado de la conexión
   */
  getConnectionState() {
    return {
      isConnected: this.isConnected,
      channels: this.channels.size,
      reconnectAttempts: this.reconnectAttempts
    };
  }

  // Métodos públicos para acceso desde RealtimeChannelBuilder
  public getChannels() {
    return this.channels;
  }

  public getIsConnected() {
    return this.isConnected;
  }
}

/**
 * Builder para canales de realtime
 */
export class RealtimeChannelBuilder {
  private client: RealtimeClient;
  private topic: string;
  private subscriptions: Array<{
    event: string;
    filter: any;
    callback: (payload: any) => void;
  }> = [];

  constructor(client: RealtimeClient, topic: string) {
    this.client = client;
    this.topic = topic;
  }

  /**
   * Suscribe a cambios en PostgreSQL
   */
  on(
    event: 'postgres_changes',
    filter: PostgresChangesFilter,
    callback: (payload: any) => void
  ): RealtimeChannelBuilder {
    this.subscriptions.push({
      event,
      filter,
      callback
    });

    // Register the handler
    const handlerKey = `${this.topic}:${event}:${filter.table || '*'}`;
    this.client.registerHandler(handlerKey, callback);

    return this;
  }

  /**
   * Suscribe a mensajes de broadcast
   */
  onBroadcast(
    event: string,
    callback: (payload: any) => void
  ): RealtimeChannelBuilder {
    this.subscriptions.push({
      event: 'broadcast',
      filter: { event },
      callback
    });

    const handlerKey = `${this.topic}:broadcast`;
    this.client.registerHandler(handlerKey, callback);

    return this;
  }

  /**
   * Suscribe al canal
   */
  subscribe(): RealtimeSubscription {
    const channel: RealtimeChannel = {
      topic: this.topic,
      subscriptions: this.subscriptions,
      joined: false
    };

    this.client.getChannels().set(this.topic, channel);
    
    // Connect if not already connected
    if (!this.client.getIsConnected()) {
      this.client.connect().then(() => {
        this.client.joinChannel(this.topic, channel);
      }).catch((error) => {
        console.error('Failed to connect to realtime server:', error);
      });
    } else {
      this.client.joinChannel(this.topic, channel);
    }

    return new RealtimeSubscription(this.client, this.topic);
  }
}

/**
 * Suscripción a un canal
 */
export class RealtimeSubscription {
  constructor(
    private client: RealtimeClient,
    private topic: string
  ) {}

  /**
   * Cancela la suscripción
   */
  unsubscribe() {
    this.client.leaveChannel(this.topic);
  }
}

export default RealtimeClient;