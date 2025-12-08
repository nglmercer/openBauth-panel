// tests/api/integration/realtime-integration.test.ts
import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { createOpenBauthPanelClient } from "../../../client";
import { createRealtimeWebSocketServer } from "../../../src/websocket-server";

describe("Realtime Integration Tests", () => {
  let wsServer: any;

  beforeEach(async () => {
    // Start WebSocket server on a different port for testing
    wsServer = createRealtimeWebSocketServer(3001);
    
    // Wait a bit for server to start
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  afterEach(() => {
    if (wsServer) {
      wsServer.stop();
    }
  });

  test("should connect to realtime WebSocket server", async () => {
    const client = createOpenBauthPanelClient({
      host: '127.0.0.1',
      port: 3001,
      protocol: 'http',
      getFullUrl: function() { return `${this.protocol}://${this.host}:${this.port}`; },
      update: function() { console.log('API config updated'); }
    });

    await expect(client.connectRealtime()).resolves.not.toThrow();
    
    const state = client.realtime.getConnectionState();
    expect(state.isConnected).toBe(true);
    expect(state.channels).toBe(0);

    client.disconnectRealtime();
  });

  test("should handle connection failure gracefully", async () => {
    const client = createOpenBauthPanelClient({
      host: '127.0.0.1',
      port: 3002, // Different port where no server is running
      protocol: 'http',
      getFullUrl: function() { return `${this.protocol}://${this.host}:${this.port}`; },
      update: function() { console.log('API config updated'); }
    });

    await expect(client.connectRealtime()).rejects.toThrow();
    
    const state = client.realtime.getConnectionState();
    expect(state.isConnected).toBe(false);
  });

  test("should create and subscribe to a channel", async () => {
    const client = createOpenBauthPanelClient({
      host: '127.0.0.1',
      port: 3001,
      protocol: 'http',
      getFullUrl: function() { return `${this.protocol}://${this.host}:${this.port}`; },
      update: function() { console.log('API config updated'); }
    });

    await client.connectRealtime();
    
    let receivedData: any = null;
    
    const subscription = client
      .channel('db-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'users' },
        (payload) => {
          receivedData = payload;
        }
      )
      .subscribe();
    
    // Wait a bit for subscription to be processed
    await new Promise(resolve => setTimeout(resolve, 100));
    
    expect(subscription).toBeDefined();
    expect(typeof subscription.unsubscribe).toBe('function');
    
    // Test notification
    const response = await fetch('http://localhost:3001/realtime/v1/test-notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        table: 'users',
        event: 'INSERT',
        data: { id: 1, name: 'Test User' }
      })
    });
    
    expect(response.status).toBe(200);
    
    // Wait for message to be processed
    await new Promise(resolve => setTimeout(resolve, 100));
    
    expect(receivedData).not.toBeNull();
    expect(receivedData.event).toBe('INSERT');
    expect(receivedData.table).toBe('users');
    expect(receivedData.data).toEqual({ id: 1, name: 'Test User' });

    client.disconnectRealtime();
  });

  test("should handle multiple subscriptions to different tables", async () => {
    const client = createOpenBauthPanelClient({
      host: '127.0.0.1',
      port: 3001,
      protocol: 'http',
      getFullUrl: function() { return `${this.protocol}://${this.host}:${this.port}`; },
      update: function() { console.log('API config updated'); }
    });

    await client.connectRealtime();
    
    let usersData: any = null;
    let rolesData: any = null;
    
    // Subscribe to users table
    client
      .channel('db-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'users' },
        (payload) => {
          usersData = payload;
        }
      )
      .subscribe();
    
    // Subscribe to roles table
    client
      .channel('db-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'roles' },
        (payload) => {
          rolesData = payload;
        }
      )
      .subscribe();
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Test users notification
    await fetch('http://localhost:3001/realtime/v1/test-notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        table: 'users',
        event: 'UPDATE',
        data: { id: 1, name: 'Updated User' }
      })
    });
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    expect(usersData).not.toBeNull();
    expect(usersData.event).toBe('UPDATE');
    expect(usersData.table).toBe('users');
    
    // Test roles notification
    await fetch('http://localhost:3001/realtime/v1/test-notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        table: 'roles',
        event: 'INSERT',
        data: { id: 1, name: 'Admin' }
      })
    });
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    expect(rolesData).not.toBeNull();
    expect(rolesData.event).toBe('INSERT');
    expect(rolesData.table).toBe('roles');

    client.disconnectRealtime();
  });

  test("should handle channel unsubscription", async () => {
    const client = createOpenBauthPanelClient({
      host: '127.0.0.1',
      port: 3001,
      protocol: 'http',
      getFullUrl: function() { return `${this.protocol}://${this.host}:${this.port}`; },
      update: function() { console.log('API config updated'); }
    });

    await client.connectRealtime();
    
    let receivedData: any = null;
    
    const subscription = client
      .channel('test-channel')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'users' },
        (payload) => {
          receivedData = payload;
        }
      )
      .subscribe();
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Unsubscribe
    subscription.unsubscribe();
    
    // Send notification after unsubscribe
    await fetch('http://localhost:3001/realtime/v1/test-notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        table: 'users',
        event: 'DELETE',
        data: { id: 1 }
      })
    });
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Should not receive data after unsubscribe
    expect(receivedData).toBeNull();

    client.disconnectRealtime();
  });

  test("should handle reconnection after disconnection", async () => {
    const client = createOpenBauthPanelClient({
      host: '127.0.0.1',
      port: 3001,
      protocol: 'http',
      getFullUrl: function() { return `${this.protocol}://${this.host}:${this.port}`; },
      update: function() { console.log('API config updated'); }
    });

    await client.connectRealtime();
    
    let receivedData: any = null;
    
    client
      .channel('reconnect-test')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'users' },
        (payload) => {
          receivedData = payload;
        }
      )
      .subscribe();
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Disconnect
    client.disconnectRealtime();
    
    const state1 = client.realtime.getConnectionState();
    expect(state1.isConnected).toBe(false);
    
    // Reconnect
    await client.connectRealtime();
    
    const state2 = client.realtime.getConnectionState();
    expect(state2.isConnected).toBe(true);
    
    // Test that subscription still works after reconnection
    await fetch('http://localhost:3001/realtime/v1/test-notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        table: 'users',
        event: 'INSERT',
        data: { id: 2, name: 'Reconnected User' }
      })
    });
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    expect(receivedData).not.toBeNull();
    expect(receivedData.data.name).toBe('Reconnected User');

    client.disconnectRealtime();
  });

  test("should handle health check endpoint", async () => {
    const response = await fetch('http://localhost:3001/realtime/v1/health');
    expect(response.status).toBe(200);
    
    const data = await response.json();
    expect(data.status).toBe('ok');
    expect(data.service).toBe('realtime');
    expect(data.version).toBe('1.0.0');
    expect(data.connectedClients).toBeDefined();
    expect(data.activeSubscriptions).toBeDefined();
  });

  test("should handle invalid test notification requests", async () => {
    // Missing required fields
    const response = await fetch('http://localhost:3001/realtime/v1/test-notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        table: 'users'
        // missing event and data
      })
    });
    
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('Missing required fields');
  });
});