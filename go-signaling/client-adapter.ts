// SignalingClient Adapter for React Frontend
// Mimics Socket.io-like event handling but uses native WebSocket

type SignalingEvents = 'join' | 'leave' | 'offer' | 'answer' | 'ice-candidate' | 'metadata' | 'error' | 'connect' | 'disconnect';

interface Message {
  type: SignalingEvents;
  payload: any;
  target?: string;
  sender?: string;
}

export class SignalingClient {
  private socket: WebSocket | null = null;
  private listeners: Map<string, Function[]> = new Map();
  private roomId: string | null = null;

  constructor(private url: string) {}

  connect(token: string) {
    const wsUrl = `${this.url}?token=${token}`;
    console.log(`Connecting to signaling server at ${wsUrl}`);
    this.socket = new WebSocket(wsUrl);
    
    this.socket.onopen = () => {
      console.log('Connected to signaling server');
      this.emit('connect', null);
    };

    this.socket.onmessage = (event) => {
      try {
        const msg: Message = JSON.parse(event.data);
        // If message has sender, include it in payload or pass separately?
        // Socket.io passes data directly. Here we might want to wrap.
        // For simplicity, emit with payload and sender info if available.
        this.emit(msg.type, msg.payload, msg.sender);
      } catch (e) {
        console.error('Invalid message', e);
      }
    };

    this.socket.onclose = () => {
        console.log('Disconnected from signaling server');
        this.emit('disconnect', null);
    };
    
    this.socket.onerror = (err) => {
        console.error('WebSocket error:', err);
        this.emit('error', err);
    };
  }

  join(roomId: string, userId: string, metadata: any) {
    this.send('join', { roomId, userId, metadata });
    this.roomId = roomId;
  }

  leave() {
    if (this.roomId) {
        this.send('leave', {});
        this.roomId = null;
    }
    if (this.socket) {
        this.socket.close();
    }
  }

  // Send a signal to a specific peer or broadcast to room (if target is omitted)
  signal(type: SignalingEvents, payload: any, target?: string) {
      this.send(type, payload, target);
  }

  private send(type: SignalingEvents, payload: any, target?: string) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type, payload, target }));
    } else {
      console.warn('Socket not connected, cannot send message:', type);
    }
  }

  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  off(event: string, callback: Function) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      this.listeners.set(event, callbacks.filter(cb => cb !== callback));
    }
  }

  private emit(event: string, data: any, sender?: string) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(cb => cb(data, sender));
    }
  }
}
