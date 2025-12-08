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
            headers: {
              "Sec-WebSocket-Protocol": "realtime",
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
        
        // Convert ServerWebSocket to standard WebSocket for our realtime server
        const standardWebSocket = ws as any;
        realtimeServer.handleConnection(standardWebSocket, new Request("http://localhost:3000/realtime/v1/websocket"));
      },

      message: (ws: ServerWebSocket<WebSocketData>, message: string | Buffer) => {
        const data = ws.data;
        const messageStr = typeof message === 'string' ? message : message.toString();
        
        console.log(`WebSocket message from ${data.clientId}:`, messageStr);
        
        // Handle the message through our realtime server
        // This is a simplified approach - in production you'd want better integration
        const standardWebSocket = ws as any;
        realtimeServer.handleConnection(standardWebSocket, new Request("http://localhost:3000/realtime/v1/websocket"));
      },

      close: (ws: ServerWebSocket<WebSocketData>) => {
        const data = ws.data;
        console.log(`WebSocket connection closed: ${data.clientId}`);
        
        // Handle disconnection
        // The realtime server will handle cleanup when the WebSocket closes
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