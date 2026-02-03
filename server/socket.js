import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import Message from './models/Message.js';
import User from './models/User.js';
import inMemoryDb from './utils/inMemoryDb.js';

export default function initSocket(server, usingMongoDB) {
  const io = new Server(server, {
    cors: {
      origin: true,
      methods: ["GET", "POST"],
      credentials: true
    },
    transports: ['polling', 'websocket'],
    pingTimeout: 120000,
    pingInterval: 30000
  });

  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.query.token;
    if (!token) return next(new Error('Authentication error'));
    try {
      const secret = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';
      const decoded = jwt.verify(token, secret);
      let user = usingMongoDB ? await User.findById(decoded.userId) : await inMemoryDb.findUserById(decoded.userId);
      if (!user) return next(new Error('User not found'));
      socket.user = { id: (user._id || user.id).toString(), username: user.username, email: user.email };
      next();
    } catch (err) { next(new Error('Invalid token')); }
  });

  const rooms = new Map();
  const fileShares = new Map();
  const onlineUsers = new Map();

  io.on('connection', (socket) => {
    const { id: userId, username } = socket.user;
    onlineUsers.set(userId, { id: userId, username, socketId: socket.id, isOnline: true });
    io.emit('user-online', { id: userId, username });

    socket.on('join-room', (data) => {
      const { roomId } = data;
      if (!roomId) return;
      socket.join(roomId);
      if (!rooms.has(roomId)) {
        rooms.set(roomId, { participants: [], host: userId, videoState: { isPlaying: false, currentTime: 0, url: null }, fileShare: null });
      }
      const room = rooms.get(roomId);
      if (!room.participants.find(p => p.id === userId)) room.participants.push({ id: userId, username, socketId: socket.id });
      socket.emit('room-joined', { participants: room.participants, isHost: userId === room.host, videoState: room.videoState, fileShare: room.fileShare });
      socket.to(roomId).emit('user-joined', { participants: room.participants, user: { id: userId, username } });
    });

    socket.on('get-server-time', (cb) => { if (typeof cb === 'function') cb(Date.now()); });

    socket.on('video-url-set', (data) => {
      if (rooms.has(data.roomId)) {
        const room = rooms.get(data.roomId);
        room.videoState.url = data.url;
        io.to(data.roomId).emit('video-url-set', { url: data.url });
      }
    });

    socket.on('video-play', (data) => {
      if (rooms.has(data.roomId)) {
        const room = rooms.get(data.roomId);
        room.videoState.isPlaying = true;
        room.videoState.currentTime = data.currentTime;
        io.to(data.roomId).emit('video-play', { currentTime: data.currentTime, timestamp: Date.now() });
      }
    });
    
    socket.on('video-pause', (data) => {
      if (rooms.has(data.roomId)) {
        const room = rooms.get(data.roomId);
        room.videoState.isPlaying = false;
        room.videoState.currentTime = data.currentTime;
        io.to(data.roomId).emit('video-pause', { currentTime: data.currentTime });
      }
    });

    socket.on('private-message', async (data) => {
      const { to, message, timestamp } = data;
      try {
        if (usingMongoDB) await Message.create({ from: userId, to, message, timestamp });
        else await inMemoryDb.createMessage({ from: userId, to, message, timestamp });
      } catch (e) {}
      const rec = onlineUsers.get(to);
      if (rec) io.to(rec.socketId).emit('private-message', { from: { id: userId, username }, message, timestamp });
    });

    // Generic File Share
    socket.on('file-share-create', (data) => {
      const { code, files } = data;
      fileShares.set(code, { hostId: socket.id, files, expiresAt: Date.now() + 1800000 });
    });
    socket.on('file-share-join', (data) => {
      const share = fileShares.get(data.code);
      if (share && share.expiresAt > Date.now()) socket.emit('file-share-info', { files: share.files, hostId: share.hostId, code: data.code });
      else socket.emit('file-share-error', { message: 'Expired or invalid code' });
    });
    socket.on('file-share-request', (data) => { io.to(data.to).emit('file-share-request', { from: socket.id }); });
    socket.on('file-share-ready', (data) => { io.to(data.to).emit('file-share-ready', { from: socket.id, fileInfo: data.fileInfo }); });
    socket.on('file-share-signal', (data) => { io.to(data.to).emit('file-share-signal', { from: socket.id, signal: data.signal }); });

    // Video Party Share
    socket.on('video-file-share', (data) => {
      if (!rooms.has(data.roomId)) return;
      const room = rooms.get(data.roomId);
      room.fileShare = { fileInfo: data.fileInfo, hostId: socket.id };
      socket.to(data.roomId).emit('video-file-info', { fileInfo: data.fileInfo, hostId: socket.id });
    });
    socket.on('video-file-request', (data) => { io.to(data.to).emit('video-file-request', { from: socket.id }); });
    socket.on('video-file-ready', (data) => { io.to(data.to).emit('video-file-ready', { from: socket.id, fileInfo: data.fileInfo }); });
    socket.on('video-file-signal', (data) => { io.to(data.to).emit('video-file-signal', { from: socket.id, signal: data.signal }); });
    socket.on('video-file-cancel', (data) => { if (rooms.has(data.roomId)) { rooms.get(data.roomId).fileShare = null; socket.to(data.roomId).emit('video-file-cancel'); } });

    socket.on('disconnect', () => {
      onlineUsers.delete(userId); io.emit('user-offline', userId);
      rooms.forEach((room, rId) => {
        room.participants = room.participants.filter(p => p.id !== userId);
        if (room.participants.length === 0) rooms.delete(rId);
        else {
          if (room.host === userId) { room.host = room.participants[0].id; room.fileShare = null; io.to(rId).emit('host-changed', { newHost: room.host }); }
          socket.to(rId).emit('user-left', { participants: room.participants, user: { id: userId, username } });
        }
      });
    });
  });
  return io;
}
