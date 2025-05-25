import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import authRoutes from './routes/auth.js';
import { authenticateToken } from './middleware/auth.js';
import User from './models/User.js';
import inMemoryDb from './utils/inMemoryDb.js';

dotenv.config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/beacon';

let usingMongoDB = false;

console.log('🚀 Beacon Server starting...');

// Try to connect to MongoDB, fallback to in-memory if it fails
try {
  await mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 5000 // 5 second timeout
  });
  console.log('✅ Connected to MongoDB');
  usingMongoDB = true;
} catch (error) {
  console.log('⚠️  MongoDB not available, using in-memory database');
  console.log('💡 To use MongoDB: Install MongoDB or set MONGODB_URI in .env');
}

// Make database type available to routes
app.locals.usingMongoDB = usingMongoDB;

app.use('/api/auth', authRoutes);

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'Server is running!',
    database: usingMongoDB ? 'MongoDB' : 'In-memory',
    timestamp: new Date().toISOString()
  });
});

// Search users endpoint
app.get('/api/users/search', authenticateToken, async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query || query.trim().length === 0) {
      return res.status(400).json({ message: 'Search query is required' });
    }

    const searchQuery = query.trim().toLowerCase();
    let users;

    if (usingMongoDB) {
      // MongoDB search with case-insensitive regex
      users = await User.find({
        username: { $regex: searchQuery, $options: 'i' }
      }).select('-password');
    } else {
      // In-memory database search
      const allUsers = Array.from(inMemoryDb.users.values());
      users = allUsers
        .filter(user => user.username.toLowerCase().includes(searchQuery))
        .map(user => inMemoryDb.toJSON(user));
    }

    // Add online status from the Socket.io onlineUsers map
    const enhancedUsers = users.map(user => {
      const userId = user.id || user._id;
      const isCurrentlyOnline = Array.from(onlineUsers.values())
        .some(onlineUser => onlineUser.id === userId.toString());
      
      return {
        ...user,
        id: userId,
        isOnline: isCurrentlyOnline
      };
    });

    res.json({ users: enhancedUsers });
  } catch (error) {
    console.error('Error searching users:', error);
    res.status(500).json({ message: 'Error searching users' });
  }
});

// Store active rooms and their state
const rooms = new Map();

// Store active file shares
const fileShares = new Map();

// Store online users (socketId -> user info)
const onlineUsers = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  // Handle user authentication for messaging
  socket.on('authenticate', (userData) => {
    if (userData && userData.id) {
      onlineUsers.set(socket.id, {
        ...userData,
        socketId: socket.id,
        isOnline: true
      });
      
      // Notify all users about new online user
      io.emit('user-online', userData);
      console.log(`User ${userData.username} is now online`);
    }
  });
  
  // Join room
  socket.on('join-room', (data) => {
    const { roomId, user } = data;
    
    // Leave any previous rooms
    Array.from(socket.rooms).forEach(room => {
      if (room !== socket.id) {
        socket.leave(room);
      }
    });
    
    // Join the new room
    socket.join(roomId);
    
    // Initialize room if it doesn't exist
    if (!rooms.has(roomId)) {
      rooms.set(roomId, {
        participants: [],
        host: user.id,
        videoState: {
          isPlaying: false,
          currentTime: 0,
          duration: 0,
          url: null
        }
      });
    }
    
    const room = rooms.get(roomId);
    
    // Join the Socket.io room
    socket.join(roomId);
    
    // Add user to participants if not already present
    const existingParticipant = room.participants.find(p => p.id === user.id);
    if (!existingParticipant) {
      room.participants.push({ ...user, socketId: socket.id });
    } else {
      existingParticipant.socketId = socket.id;
    }
    
    // Send room state to the joining user
    socket.emit('room-joined', {
      participants: room.participants,
      isHost: user.id === room.host,
      videoState: room.videoState
    });
    
    // Notify other users in the room
    socket.to(roomId).emit('user-joined', {
      participants: room.participants,
      user
    });
    
    console.log(`User ${user.username} joined room ${roomId}`);
  });
  
  // Leave room
  socket.on('leave-room', (data) => {
    const { roomId, userId } = data;
    
    if (rooms.has(roomId)) {
      const room = rooms.get(roomId);
      const leavingUser = room.participants.find(p => p.id === userId);
      room.participants = room.participants.filter(p => p.id !== userId);
      
      // If no participants left, delete the room
      if (room.participants.length === 0) {
        rooms.delete(roomId);
      } else {
        // If host left, assign new host
        if (room.host === userId && room.participants.length > 0) {
          room.host = room.participants[0].id;
        }
        
        // Notify remaining users
        socket.to(roomId).emit('user-left', {
          participants: room.participants,
          user: leavingUser || { id: userId }
        });
      }
    }
    
    socket.leave(roomId);
    console.log(`User ${userId} left room ${roomId}`);
  });
  
  // Video controls
  socket.on('video-url-set', (data) => {
    const { roomId, url } = data;
    
    if (rooms.has(roomId)) {
      const room = rooms.get(roomId);
      room.videoState.url = url;
      
      // Broadcast to all users in the room
      io.to(roomId).emit('video-url-set', { url });
    }
  });

  socket.on('video-play', (data) => {
    const { roomId, currentTime } = data;
    
    if (rooms.has(roomId)) {
      const room = rooms.get(roomId);
      room.videoState.isPlaying = true;
      room.videoState.currentTime = currentTime;
      
      // Broadcast to all users in the room
      io.to(roomId).emit('video-play', { currentTime });
    }
  });
  
  socket.on('video-pause', (data) => {
    const { roomId, currentTime } = data;
    
    if (rooms.has(roomId)) {
      const room = rooms.get(roomId);
      room.videoState.isPlaying = false;
      room.videoState.currentTime = currentTime;
      
      // Broadcast to all users in the room
      io.to(roomId).emit('video-pause', { currentTime });
    }
  });
  
  socket.on('video-seek', (data) => {
    const { roomId, currentTime } = data;
    
    if (rooms.has(roomId)) {
      const room = rooms.get(roomId);
      room.videoState.currentTime = currentTime;
      
      // Broadcast to all users in the room
      io.to(roomId).emit('video-seek', { currentTime });
    }
  });
  
  // Chat
  socket.on('chat-message', (data) => {
    const { roomId, username, message, timestamp } = data;
    
    // Broadcast message to all users in the room
    io.to(roomId).emit('chat-message', {
      username,
      message,
      timestamp
    });
  });
  
  // File sharing events
  socket.on('file-share-create', (data) => {
    const { code, files } = data;
    
    fileShares.set(code, {
      hostId: socket.id,
      files,
      createdAt: Date.now(),
      expiresAt: Date.now() + 30 * 60 * 1000 // 30 minutes
    });
    
    console.log(`File share created with code: ${code}`);
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
  
  socket.on('file-share-request', (data) => {
    const { to, fileInfo } = data;
    io.to(to).emit('file-share-request', { from: socket.id, fileInfo });
  });
  
  socket.on('file-share-ready', (data) => {
    const { to, fileInfo } = data;
    io.to(to).emit('file-share-ready', { from: socket.id, fileInfo });
  });
  
  socket.on('file-share-signal', (data) => {
    const { to, signal } = data;
    io.to(to).emit('file-share-signal', { from: socket.id, signal });
  });

  // Video file sharing events
  socket.on('video-file-share', (data) => {
    const { roomId, fileInfo } = data;
    
    console.log(`\n=== VIDEO FILE SHARE EVENT ===`);
    console.log(`From socket: ${socket.id}`);
    console.log(`Room ID: ${roomId}`);
    console.log('File info:', fileInfo);
    
    // Check if socket is in the room
    const socketRooms = Array.from(socket.rooms);
    console.log(`Socket ${socket.id} is in rooms:`, socketRooms);
    
    // Get room participants
    const roomSockets = io.sockets.adapter.rooms.get(roomId);
    console.log('Room sockets:', roomSockets ? Array.from(roomSockets) : 'No room found');
    
    if (!socketRooms.includes(roomId)) {
      console.log('WARNING: Socket is not in the specified room!');
    }
    
    // Broadcast to all participants except the sender
    const result = socket.to(roomId).emit('video-file-info', {
      fileInfo,
      hostId: socket.id
    });
    
    console.log(`Broadcast sent to room ${roomId}`);
    console.log(`=== END VIDEO FILE SHARE EVENT ===\n`);
  });
  
  socket.on('video-file-request', (data) => {
    const { to } = data;
    io.to(to).emit('video-file-request', { from: socket.id });
  });
  
  socket.on('video-file-ready', (data) => {
    const { to, fileInfo } = data;
    io.to(to).emit('video-file-ready', { from: socket.id, fileInfo });
  });
  
  socket.on('video-file-signal', (data) => {
    const { to, signal } = data;
    io.to(to).emit('video-file-signal', { from: socket.id, signal });
  });
  
  socket.on('video-file-cancel', (data) => {
    const { roomId } = data;
    // Broadcast cancellation to all users in the room
    socket.to(roomId).emit('video-file-cancel');
    console.log(`File transfer cancelled in room ${roomId}`);
  });
  
  // Private messaging handlers
  socket.on('get-online-users', () => {
    // Send list of all online users
    const users = Array.from(onlineUsers.values());
    socket.emit('online-users', users);
  });
  
  socket.on('private-message', (data) => {
    const { to, message, timestamp } = data;
    const fromUser = onlineUsers.get(socket.id);
    
    if (!fromUser) {
      console.log('User not authenticated for messaging');
      return;
    }
    
    // Find recipient's socket ID
    const recipientSocket = Array.from(onlineUsers.entries())
      .find(([socketId, user]) => user.id === to)?.[0];
    
    if (recipientSocket) {
      // Send message to recipient
      io.to(recipientSocket).emit('private-message', {
        from: fromUser,
        message,
        timestamp
      });
      console.log(`Message from ${fromUser.username} to user ${to}`);
    } else {
      console.log(`Recipient ${to} not online`);
    }
  });
  
  // Handle disconnection
  socket.on('disconnect', () => {
    // Clean up user from all rooms
    rooms.forEach((room, roomId) => {
      const userIndex = room.participants.findIndex(p => p.socketId === socket.id);
      if (userIndex !== -1) {
        const user = room.participants[userIndex];
        room.participants.splice(userIndex, 1);
        
        // If no participants left, delete the room
        if (room.participants.length === 0) {
          rooms.delete(roomId);
        } else {
          // If host disconnected, assign new host
          if (room.host === user.id && room.participants.length > 0) {
            room.host = room.participants[0].id;
          }
          
          // Notify remaining users
          socket.to(roomId).emit('user-left', {
            participants: room.participants,
            user
          });
        }
      }
    });
    
    // Clean up expired file shares
    fileShares.forEach((share, code) => {
      if (share.hostId === socket.id || share.expiresAt < Date.now()) {
        fileShares.delete(code);
      }
    });
    
    // Remove from online users
    const disconnectedUser = onlineUsers.get(socket.id);
    if (disconnectedUser) {
      onlineUsers.delete(socket.id);
      // Notify all users about offline user
      io.emit('user-offline', disconnectedUser.id);
      console.log(`User ${disconnectedUser.username} went offline`);
    }
    
    console.log('User disconnected:', socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`🌐 Frontend: http://localhost:3000`);
  console.log(`🔧 Backend: http://localhost:${PORT}`);
  console.log(`📊 Database: ${usingMongoDB ? 'MongoDB' : 'In-memory'}`);
});