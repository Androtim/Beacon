// SignalingClient Adapter for React Frontend
// Mimics Socket.io-like event handling but uses native WebSocket

export class SignalingClient {
  constructor(url) {
    this.url = url;
    this.socket = null;
    this.listeners = new Map();
    this.roomId = null;
    this.connected = false;
    this.id = Math.random().toString(36).substr(2, 9); // Initial fallback ID
  }

  connect(token) {
    const wsUrl = `${this.url}?token=${token}`;
    console.log(`🔌 Connecting to signaling server: ${wsUrl}`);
    this.socket = new WebSocket(wsUrl);
    
    this.socket.onopen = () => {
      console.log('✅ Connected to signaling server');
      this.connected = true;
      this.triggerLocal('connect', null);
    };

    this.socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        const { type, payload, sender } = msg;

        // Route the message to listeners
        this.triggerLocal(type, payload, sender);

        // Routing shim for legacy Socket.io metadata events
        if (type === 'metadata' && payload && payload.action) {
            this.triggerLocal(payload.action, payload.data || payload, sender);
        }
      } catch (e) {
        console.error('❌ Socket Parse Error:', e);
      }
    };

    this.socket.onclose = () => {
        console.log('❌ Connection closed');
        this.connected = false;
        this.triggerLocal('disconnect', null);
    };
    
    this.socket.onerror = (err) => {
        console.error('⚠️ Socket Error:', err);
        this.triggerLocal('error', err);
    };
  }

  join(roomId, userId, metadata) {
    this.send('join', { roomId, userId, metadata });
    this.roomId = roomId;
  }

  disconnect() {
    if (this.socket) this.socket.close();
  }

  signal(type, payload, target) {
    this.send(type, payload, target);
  }

  // Socket.io 'emit' compatibility layer
  emit(event, payload, target) {
    const builtIn = ['join', 'leave', 'offer', 'answer', 'ice-candidate', 'metadata'];
    if (builtIn.includes(event)) {
      this.send(event, payload, target);
    } else {
      // Wrap custom events in metadata for the Go engine
      this.send('metadata', { action: event, data: payload }, target);
    }
  }

  send(type, payload, target) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type, payload, target }));
    } else {
      console.warn(`[Signaling] Socket not ready. Message dropped: ${type}`);
    }
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  off(event, callback) {
    if (!callback) {
      this.listeners.delete(event);
      return;
    }
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      this.listeners.set(event, callbacks.filter(cb => cb !== callback));
    }
  }

  triggerLocal(event, data, sender) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(cb => cb(data, sender));
    }
  }
}
