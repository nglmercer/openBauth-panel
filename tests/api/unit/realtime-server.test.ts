// tests/api/unit/realtime-server.test.ts
import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { realtimeServer } from "../../../src/routers/realtime";

// Mock WebSocket for testing
class MockWebSocket {
  readyState: number = WebSocket.OPEN;
  onmessage: ((event: any) => void) | null = null;
  onclose: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  sentMessages: any[] = [];

  constructor(public url: string) {}

  send(data: string) {
    this.sentMessages.push(JSON.parse(data));
  }

  close() {
    this.readyState = WebSocket.CLOSED;
    if (this.onclose) {
      this.onclose({} as any);
    }
  }

  simulateMessage(data: string) {
    if (this.onmessage) {
      this.onmessage({ data } as any);
    }
  }

  simulateError(error: any) {
    if (this.onerror) {
      this.onerror({ error } as any);
    }
  }
}

describe("RealtimeServer", () => {
  let mockWs: MockWebSocket;
  let mockRequest: Request;

  beforeEach(() => {
    // Clear server state
    (realtimeServer as any).clients.clear();
    (realtimeServer as any).subscriptions.clear();
    
    mockWs = new MockWebSocket("ws://localhost:3000/realtime/v1/websocket");
    mockRequest = new Request("http://localhost:3000/realtime/v1/websocket");
  });

  afterEach(() => {
    // Cleanup
    (realtimeServer as any).clients.clear();
    (realtimeServer as any).subscriptions.clear();
  });

  test("should handle new WebSocket connection", () => {
    realtimeServer.handleConnection(mockWs as any, mockRequest);
    
    const stats = realtimeServer.getStats();
    expect(stats.connectedClients).toBe(1);
    expect(stats.activeSubscriptions).toBe(0);
  });

  test("should send welcome message on connection", () => {
    realtimeServer.handleConnection(mockWs as any, mockRequest);
    
    expect(mockWs.sentMessages.length).toBeGreaterThan(0);
    const welcomeMessage = mockWs.sentMessages[0];
    expect(welcomeMessage.type).toBe('phx_reply');
    expect(welcomeMessage.topic).toBe('phoenix');
    expect(welcomeMessage.payload.status).toBe('ok');
  });

  test("should handle subscription to a topic", () => {
    realtimeServer.handleConnection(mockWs as any, mockRequest);
    
    const joinMessage = {
      type: 'phx_join',
      topic: 'realtime:users',
      payload: {
        config: {
          postgres_changes: [{
            event: '*',
            schema: 'public',
            table: 'users'
          }]
        }
      },
      ref: '1'
    };

    mockWs.simulateMessage(JSON.stringify(joinMessage));
    
    const stats = realtimeServer.getStats();
    expect(stats.activeSubscriptions).toBe(1);
    expect(stats.topics).toContain('realtime:users');
  });

  test("should handle heartbeat message", () => {
    realtimeServer.handleConnection(mockWs as any, mockRequest);
    
    const heartbeatMessage = {
      type: 'heartbeat',
      topic: 'phoenix',
      payload: {},
      ref: '2'
    };

    mockWs.simulateMessage(JSON.stringify(heartbeatMessage));
    
    // Should respond with heartbeat reply
    const heartbeatReply = mockWs.sentMessages.find(msg => 
      msg.type === 'phx_reply' && msg.topic === 'phoenix'
    );
    expect(heartbeatReply).toBeDefined();
    expect(heartbeatReply.payload.status).toBe('ok');
  });

  test("should handle unsubscription", () => {
    realtimeServer.handleConnection(mockWs as any, mockRequest);
    
    // First subscribe
    const joinMessage = {
      type: 'phx_join',
      topic: 'realtime:users',
      payload: {},
      ref: '1'
    };
    mockWs.simulateMessage(JSON.stringify(joinMessage));
    
    // Then unsubscribe
    const leaveMessage = {
      type: 'phx_leave',
      topic: 'realtime:users',
      payload: {},
      ref: '2'
    };
    mockWs.simulateMessage(JSON.stringify(leaveMessage));
    
    const stats = realtimeServer.getStats();
    expect(stats.activeSubscriptions).toBe(0);
  });

  test("should handle disconnection", () => {
    realtimeServer.handleConnection(mockWs as any, mockRequest);
    
    // Subscribe first
    const joinMessage = {
      type: 'phx_join',
      topic: 'realtime:users',
      payload: {},
      ref: '1'
    };
    mockWs.simulateMessage(JSON.stringify(joinMessage));
    
    // Simulate disconnection
    mockWs.close();
    
    const stats = realtimeServer.getStats();
    expect(stats.connectedClients).toBe(0);
    expect(stats.activeSubscriptions).toBe(0);
  });

  test("should broadcast messages to topic subscribers", () => {
    // Create two mock clients
    const mockWs1 = new MockWebSocket("ws://localhost:3000/realtime/v1/websocket");
    const mockWs2 = new MockWebSocket("ws://localhost:3000/realtime/v1/websocket");
    
    realtimeServer.handleConnection(mockWs1 as any, mockRequest);
    realtimeServer.handleConnection(mockWs2 as any, mockRequest);
    
    // Subscribe both to the same topic
    const joinMessage = {
      type: 'phx_join',
      topic: 'realtime:users',
      payload: {},
      ref: '1'
    };
    
    mockWs1.simulateMessage(JSON.stringify(joinMessage));
    mockWs2.simulateMessage(JSON.stringify(joinMessage));
    
    // Clear previous messages
    mockWs1.sentMessages = [];
    mockWs2.sentMessages = [];
    
    // Broadcast to topic
    realtimeServer.broadcastToTopic('realtime:users', 'test_event', { data: 'test' });
    
    // Both clients should receive the broadcast
    expect(mockWs1.sentMessages.length).toBeGreaterThan(0);
    expect(mockWs2.sentMessages.length).toBeGreaterThan(0);
    
    const broadcast1 = mockWs1.sentMessages.find(msg => msg.type === 'test_event');
    const broadcast2 = mockWs2.sentMessages.find(msg => msg.type === 'test_event');
    
    expect(broadcast1).toBeDefined();
    expect(broadcast2).toBeDefined();
    expect(broadcast1.payload).toEqual({ data: 'test' });
    expect(broadcast2.payload).toEqual({ data: 'test' });
  });

  test("should notify database changes", () => {
    const mockWs = new MockWebSocket("ws://localhost:3000/realtime/v1/websocket");
    realtimeServer.handleConnection(mockWs as any, mockRequest);
    
    // Subscribe to users table
    const joinMessage = {
      type: 'phx_join',
      topic: 'realtime:users',
      payload: {},
      ref: '1'
    };
    mockWs.simulateMessage(JSON.stringify(joinMessage));
    
    // Clear previous messages
    mockWs.sentMessages = [];
    
    // Notify database change
    realtimeServer.notifyDatabaseChange('users', 'INSERT', { id: 1, name: 'Test User' });
    
    // Should receive postgres_changes notification
    const postgresMessage = mockWs.sentMessages.find(msg =>
      msg.type === 'postgres_changes'
    );
    
    expect(postgresMessage).toBeDefined();
    expect(postgresMessage.payload.event).toBe('INSERT');
    expect(postgresMessage.payload.table).toBe('users');
    expect(postgresMessage.payload.data).toEqual({ id: 1, name: 'Test User' });
  });

  test("should handle invalid JSON messages gracefully", () => {
    realtimeServer.handleConnection(mockWs as any, mockRequest);
    
    // Capture console.error
    const originalConsoleError = console.error;
    let errorCalled = false;
    console.error = () => { errorCalled = true; };
    
    mockWs.simulateMessage('invalid json');
    
    expect(errorCalled).toBe(true);
    
    // Restore console.error
    console.error = originalConsoleError;
  });

  test("should generate unique client IDs", () => {
    const mockWs1 = new MockWebSocket("ws://localhost:3000/realtime/v1/websocket");
    const mockWs2 = new MockWebSocket("ws://localhost:3000/realtime/v1/websocket");
    
    realtimeServer.handleConnection(mockWs1 as any, mockRequest);
    realtimeServer.handleConnection(mockWs2 as any, mockRequest);
    
    const stats = realtimeServer.getStats();
    expect(stats.connectedClients).toBe(2);
  });
});