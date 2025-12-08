// src/websocket-server.ts
import { realtimeServer } from "./routers/realtime";
import type { ServerWebSocket } from "bun";

/**
 * WebSocket server setup for Bun
 * Handles WebSocket connections compatible with Supabase Realtime
 */

export interface WebSocketData {
  clientId: string;
  createdAt: number;
}

// Map to track WebSocket connections and their client IDs
const websocketClients = new Map<string, ServerWebSocket<WebSocketData>>();

/**
 * Create WebSocket server for realtime functionality
 */
export function createRealtimeWebSocketServer(port: number = 3000) {
  const server = Bun.serve<WebSocketData>({
    port,
    fetch(req, server) {
      const url = new URL(req.url);
      
      // Handle WebSocket upgrade requests
      if (url.pathname === "/realtime/v1/websocket") {
        const upgradeHeader = req.headers.get("upgrade");
        if (upgradeHeader === "websocket") {
          const success = server.upgrade(req, {
            data: {
              clientId: `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              createdAt: Date.now(),
            },
          });

          if (success) {
            return undefined; // Bun will handle the response
          }
        }
      }

      // Handle regular HTTP requests
      if (url.pathname === "/realtime/v1/health") {
        const stats = realtimeServer.getStats();
        return new Response(JSON.stringify({
          status: "ok",
          service: "realtime",
          version: "1.0.0",
          ...stats
        }), {
          headers: { "Content-Type": "application/json" }
        });
      }

      if (url.pathname === "/realtime/v1/test-notify" && req.method === "POST") {
        return req.json().then(({ table, event, data }) => {
          if (!table || !event || !data) {
            return new Response(JSON.stringify({ error: "Missing required fields" }), {
              status: 400,
              headers: { "Content-Type": "application/json" }
            });
          }

          realtimeServer.notifyDatabaseChange(table, event, data);
          return new Response(JSON.stringify({ message: "Notification sent" }), {
            headers: { "Content-Type": "application/json" }
          });
        });
      }

      return new Response("Use WebSocket endpoint: /realtime/v1/websocket", { status: 400 });
    },
    websocket: {
      open: (ws: ServerWebSocket<WebSocketData>) => {
        const data = ws.data;
        console.log(`WebSocket connection opened: ${data.clientId}`);
        
        // Store the WebSocket connection
        websocketClients.set(data.clientId, ws);
        
        // Create a WebSocket-like interface for our realtime server
        const webSocketInterface = {
          send: (message: string) => {
            if (ws.readyState === 1) { // WebSocket.OPEN
              ws.send(message);
            }
          },
          close: () => {
            ws.close();
          },
          readyState: 1, // WebSocket.OPEN
          onmessage: null as ((event: any) => void) | null,
          onclose: null as (() => void) | null,
          onerror: null as ((event: any) => void) | null,
        };
        
        // Handle the initial connection - pass the clientId as part of the request
        const requestWithClientId = new Request("http://localhost:3000/realtime/v1/websocket", {
          headers: {
            'x-client-id': data.clientId
          }
        });
        realtimeServer.handleConnection(webSocketInterface as any, requestWithClientId);
        
        // Set up event handlers on the interface
        webSocketInterface.onclose = () => {
          realtimeServer.handleDisconnect(data.clientId);
          websocketClients.delete(data.clientId);
        };
        
        webSocketInterface.onerror = (event: any) => {
          console.error(`WebSocket error for client ${data.clientId}:`, event);
          realtimeServer.handleDisconnect(data.clientId);
          websocketClients.delete(data.clientId);
        };
      },

      message: (ws: ServerWebSocket<WebSocketData>, message: string | Buffer) => {
        const data = ws.data;
        const messageStr = typeof message === 'string' ? message : message.toString();
        
        console.log(`WebSocket message from ${data.clientId}:`, messageStr);
        
        // Handle the message through our realtime server
        realtimeServer.handleMessage(data.clientId, messageStr);
      },

      close: (ws: ServerWebSocket<WebSocketData>) => {
        const data = ws.data;
        console.log(`WebSocket connection closed: ${data.clientId}`);
        
        // Handle disconnection
        realtimeServer.handleDisconnect(data.clientId);
        websocketClients.delete(data.clientId);
      },

      drain: (ws: ServerWebSocket<WebSocketData>) => {
        const data = ws.data;
        console.log(`WebSocket backpressure drained for ${data.clientId}`);
      },
    },
  });

  console.log(`🚀 Realtime WebSocket server running on ws://localhost:${port}/realtime/v1/websocket`);
  console.log(`📊 Health check available at http://localhost:${port}/realtime/v1/health`);
  
  return server;
}

/**
 * Simple WebSocket client for testing
 */
export function createTestWebSocketClient(url: string = "ws://localhost:3000/realtime/v1/websocket") {
  const ws = new WebSocket(url);

  ws.onopen = () => {
    console.log("Connected to realtime server");
    
    // Send a test subscription
    ws.send(JSON.stringify({
      type: "phx_join",
      topic: "realtime:users",
      payload: {
        config: {
          postgres_changes: [{
            event: "*",
            schema: "public",
            table: "users"
          }]
        }
      },
      ref: "1"
    }));
  };

  ws.onmessage = (event) => {
    console.log("Received message:", event.data);
  };

  ws.onerror = (error) => {
    console.error("WebSocket error:", error);
  };

  ws.onclose = () => {
    console.log("WebSocket connection closed");
  };

  return ws;
}