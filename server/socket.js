import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import Message from './models/Message.js';
import User from './models/User.js';
import inMemoryDb from './utils/inMemoryDb.js';

export default function initSocket(server, usingMongoDB) {
  const io = new Server(server, {
    cors: {
      origin: ["http://localhost:3000", "http://172.18.191.100:3000"],
      methods: ["GET", "POST"],
      credentials: true,
      allowedHeaders: ["authorization"]
    },
    transports: ['polling', 'websocket'],
    pingTimeout: 60000,
    pingInterval: 25000
  });

  // Socket.io Middleware for Authentication
  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.query.token;
    
    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }

    try {
      const secret = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';
      const decoded = jwt.verify(token, secret);
      
      // Verify user exists in DB
      let user;
      if (usingMongoDB) {
        user = await User.findById(decoded.userId);
      } else {
        user = await inMemoryDb.findUserById(decoded.userId);
      }

      if (!user) {
        return next(new Error('Authentication error: User not found'));
      }

      socket.user = {
        id: (user._id || user.id).toString(),
        username: user.username,
        email: user.email
      };
      
      next();
    } catch (err) {
      console.log('❌ Socket connection rejected: Invalid token');
      next(new Error('Authentication error: Invalid token'));
    }
  });

  // Store active rooms and their state
  const rooms = new Map();
  // Store active file shares
  const fileShares = new Map();
  // Store online users (userId -> { socketId, username, etc })
  const onlineUsers = new Map();

  io.on('connection', (socket) => {
    const { id: userId, username } = socket.user;
    
    console.log(`✅ User connected: ${username} (${userId}) | Socket: ${socket.id}`);
    
    onlineUsers.set(userId, {
      id: userId,
      username,
      socketId: socket.id,
      isOnline: true
    });
    
    // Notify all users about new online user
    io.emit('user-online', { id: userId, username });

    // Join room
    socket.on('join-room', (data) => {
      const { roomId } = data;
      
      if (!roomId) return;

      // Leave any previous rooms
      Array.from(socket.rooms).forEach(room => {
        if (room !== socket.id) {
          socket.leave(room);
        }
      });
      
      socket.join(roomId);
      
      if (!rooms.has(roomId)) {
        rooms.set(roomId, {
          participants: [],
          host: userId,
          videoState: {
            isPlaying: false,
            currentTime: 0,
            duration: 0,
            url: null
          },
          fileShare: null
        });
      }
      
      const room = rooms.get(roomId);
      
      // Add user to participants if not already present
      const existingParticipant = room.participants.find(p => p.id === userId);
      if (!existingParticipant) {
        room.participants.push({ id: userId, username, socketId: socket.id });
      } else {
        existingParticipant.socketId = socket.id;
      }
      
      // Send room state to the joining user
      socket.emit('room-joined', {
        participants: room.participants,
        isHost: userId === room.host,
        videoState: room.videoState,
        fileShare: room.fileShare
      });
      
      // Notify other users in the room
      socket.to(roomId).emit('user-joined', {
        participants: room.participants,
        user: { id: userId, username }
      });
    });

    // Clock synchronization
    socket.on('get-server-time', (callback) => {
      if (typeof callback === 'function') {
        callback(Date.now());
      }
    });

    // Video controls
    socket.on('video-url-set', (data) => {
      const { roomId, url } = data;
      if (rooms.has(roomId)) {
        const room = rooms.get(roomId);
        room.videoState.url = url;
        room.videoState.lastSyncTimestamp = Date.now();
        io.to(roomId).emit('video-url-set', { url });
      }
    });

    socket.on('video-play', (data) => {
      const { roomId, currentTime, timestamp } = data;
      if (rooms.has(roomId)) {
        const room = rooms.get(roomId);
        room.videoState.isPlaying = true;
        room.videoState.currentTime = currentTime;
        room.videoState.lastSyncTimestamp = timestamp || Date.now();
        io.to(roomId).emit('video-play', { 
          currentTime, 
          timestamp: room.videoState.lastSyncTimestamp 
        });
      }
    });
    
    socket.on('video-pause', (data) => {
      const { roomId, currentTime, timestamp } = data;
      if (rooms.has(roomId)) {
        const room = rooms.get(roomId);
        room.videoState.isPlaying = false;
        room.videoState.currentTime = currentTime;
        room.videoState.lastSyncTimestamp = timestamp || Date.now();
        io.to(roomId).emit('video-pause', { 
          currentTime, 
          timestamp: room.videoState.lastSyncTimestamp 
        });
      }
    });
    
    socket.on('video-seek', (data) => {
      const { roomId, currentTime, timestamp } = data;
      if (rooms.has(roomId)) {
        const room = rooms.get(roomId);
        room.videoState.currentTime = currentTime;
        room.videoState.lastSyncTimestamp = timestamp || Date.now();
        io.to(roomId).emit('video-seek', { 
          currentTime, 
          timestamp: room.videoState.lastSyncTimestamp 
        });
      }
    });

    // Private messaging
    socket.on('private-message', async (data) => {
      const { to, message, timestamp } = data;
      
      if (!to || !message) return;

      // Save message to database
      try {
        if (usingMongoDB) {
          await Message.create({
            from: userId,
            to: to,
            message: message,
            timestamp: timestamp || new Date()
          });
        } else {
          await inMemoryDb.createMessage({
            from: userId,
            to: to,
            message: message,
            timestamp: timestamp || new Date()
          });
        }
      } catch (error) {
        console.error('Error saving message:', error);
      }
      
      const recipient = onlineUsers.get(to);
      if (recipient) {
        io.to(recipient.socketId).emit('private-message', {
          from: { id: userId, username },
          message,
          timestamp
        });
      }
    });

    // File sharing (Generic)
    socket.on('file-share-create', (data) => {
      const { code, files } = data;
      if (!code) return;
      fileShares.set(code, {
        hostId: socket.id,
        hostUserId: userId,
        files,
        createdAt: Date.now(),
        expiresAt: Date.now() + 30 * 60 * 1000
      });
    });
    
    socket.on('file-share-join', (data) => {
      const { code } = data;
      const shareData = fileShares.get(code);
      if (shareData && shareData.expiresAt > Date.now()) {
        socket.emit('file-share-info', {
          files: shareData.files,
          hostId: shareData.hostId,
          code
        });
      } else {
        socket.emit('file-share-error', { message: 'Invalid or expired share code' });
      }
    });

    socket.on('file-share-signal', (data) => {
      const { to, signal } = data;
      if (!to) return;
      io.to(to).emit('file-share-signal', { from: socket.id, signal });
    });

    // Video File P2P Sharing (Room-specific)
    socket.on('video-file-share', (data) => {
      const { roomId, fileInfo } = data;
      if (!roomId || !rooms.has(roomId)) return;
      
      const room = rooms.get(roomId);
      // Only host can share video files for the room
      if (room.host !== userId) return;

      // Store file info in room state for latecomers
      room.fileShare = {
        fileInfo,
        hostId: socket.id
      };

      socket.to(roomId).emit('video-file-info', {
        fileInfo,
        hostId: socket.id
      });
    });
    
    socket.on('video-file-request', (data) => {
      const { to } = data;
      if (!to) return;
      // We could add more checks here to ensure 'to' is in the same room
      io.to(to).emit('video-file-request', { from: socket.id });
    });
    
    socket.on('video-file-ready', (data) => {
      const { to, fileInfo } = data;
      if (!to) return;
      io.to(to).emit('video-file-ready', { from: socket.id, fileInfo });
    });
    
    socket.on('video-file-signal', (data) => {
      const { to, signal } = data;
      if (!to) return;
      io.to(to).emit('video-file-signal', { from: socket.id, signal });
    });
    
    socket.on('video-file-cancel', (data) => {
      const { roomId } = data;
      if (roomId && rooms.has(roomId)) {
        const room = rooms.get(roomId);
        if (room.host === userId) {
          room.fileShare = null;
          socket.to(roomId).emit('video-file-cancel');
        }
      }
    });

    socket.on('disconnect', () => {
      onlineUsers.delete(userId);
      io.emit('user-offline', userId);
      
      // Cleanup rooms
      rooms.forEach((room, roomId) => {
        room.participants = room.participants.filter(p => p.id !== userId);
        if (room.participants.length === 0) {
          rooms.delete(roomId);
        } else {
          if (room.host === userId) {
            room.host = room.participants[0].id;
            // Clear file share if host leaves
            room.fileShare = null;
            // Notify about host change
            io.to(roomId).emit('host-changed', { newHost: room.host });
          }
          socket.to(roomId).emit('user-left', {
            participants: room.participants,
            user: { id: userId, username }
          });
        }
      });
      
      console.log(`🔌 User disconnected: ${username}`);
    });
  });

  return io;
}
