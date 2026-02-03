import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import authRoutes from './routes/auth.js';
import { authenticateToken } from './middleware/auth.js';
import User from './models/User.js';
import Message from './models/Message.js';
import inMemoryDb from './utils/inMemoryDb.js';
import initSocket from './socket.js';

dotenv.config();

// Security: Check for JWT_SECRET
if (!process.env.JWT_SECRET) {
  console.warn('⚠️  WARNING: JWT_SECRET is not set in environment variables.');
  console.warn('⚠️  Falling back to a default secret for development. CHANGE THIS IN PRODUCTION!');
  process.env.JWT_SECRET = 'your-super-secret-jwt-key-change-this-in-production';
}

const app = express();
const server = createServer(app);

app.use(cors({
  origin: ['http://localhost:3000', 'http://172.18.191.100:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

const PORT = process.env.PORT || 3001;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/beacon';

let usingMongoDB = false;

console.log('🚀 Beacon Server starting...');

try {
  await mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 5000
  });
  console.log('✅ Connected to MongoDB');
  usingMongoDB = true;
} catch (error) {
  console.log('⚠️  MongoDB not available, using in-memory database');
}

app.locals.usingMongoDB = usingMongoDB;

// Routes
app.use('/api/auth', authRoutes);

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'Server is running!',
    database: usingMongoDB ? 'MongoDB' : 'In-memory',
    timestamp: new Date().toISOString()
  });
});

// Get ICE servers configuration (STUN/TURN)
app.get('/api/ice-servers', authenticateToken, (req, res) => {
  // In a real production app, these would come from environment variables
  // or a service like Twilio/Xirsys/Metered.ca with dynamic credentials
  res.json({
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
      { urls: 'stun:stun.services.mozilla.com' },
      { urls: 'stun:stun.stunprotocol.org:3478' },
      {
        urls: process.env.TURN_SERVER_URL || 'turn:openrelay.metered.ca:80',
        username: process.env.TURN_SERVER_USERNAME || 'openrelayproject',
        credential: process.env.TURN_SERVER_PASSWORD || 'openrelayproject'
      }
    ]
  });
});

app.get('/api/messages/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user._id || req.user.id;
    
    let messages;
    if (usingMongoDB) {
      messages = await Message.find({
        $or: [
          { from: currentUserId, to: userId },
          { from: userId, to: currentUserId }
        ]
      })
      .sort({ timestamp: 1 })
      .limit(100)
      .populate('from to', 'username email');
    } else {
      messages = await inMemoryDb.getMessages(currentUserId.toString(), userId);
      messages = messages.map(msg => {
        const fromUser = inMemoryDb.findUserById(msg.from);
        const toUser = inMemoryDb.findUserById(msg.to);
        return {
          ...msg,
          from: fromUser ? { id: fromUser._id, username: fromUser.username } : null,
          to: toUser ? { id: toUser._id, username: toUser.username } : null
        };
      });
    }
    res.json({ messages });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching messages' });
  }
});

app.get('/api/conversations', authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    let conversations;
    if (usingMongoDB) {
      const userObjectId = new mongoose.Types.ObjectId(userId);
      conversations = await Message.aggregate([
        { $match: { $or: [{ from: userObjectId }, { to: userObjectId }] } },
        { $sort: { timestamp: -1 } },
        { $group: {
          _id: { $cond: [{ $eq: ['$from', userObjectId] }, '$to', '$from'] },
          lastMessage: { $first: '$$ROOT' },
          unreadCount: { $sum: { $cond: [{ $and: [{ $eq: ['$to', userObjectId] }, { $eq: ['$read', false] }] }, 1, 0] } }
        }},
        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
        { $unwind: '$user' },
        { $project: { user: { id: '$user._id', username: '$user.username' }, lastMessage: 1, unreadCount: 1 } }
      ]);
    } else {
      conversations = await inMemoryDb.getConversations(userId.toString());
      conversations = conversations.map(conv => {
        const user = inMemoryDb.findUserById(conv.userId);
        return {
          user: user ? { id: user._id, username: user.username } : null,
          lastMessage: conv.lastMessage,
          unreadCount: conv.unreadCount
        };
      });
    }
    res.json({ conversations: conversations.filter(c => c.user) });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching conversations' });
  }
});

app.get('/api/users/search', authenticateToken, async (req, res) => {
  const { query } = req.query;
  const searchQuery = query?.trim().toLowerCase();
  if (!searchQuery) return res.status(400).json({ message: 'Search query required' });

  let users;
  if (usingMongoDB) {
    users = await User.find({ username: { $regex: searchQuery, $options: 'i' } }).select('-password');
  } else {
    users = Array.from(inMemoryDb.users.values())
      .filter(u => u.username.toLowerCase().includes(searchQuery))
      .map(u => inMemoryDb.toJSON(u));
  }
  res.json({ users });
});

// Initialize Socket.io
initSocket(server, usingMongoDB);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Beacon Server running on port ${PORT}`);
});
