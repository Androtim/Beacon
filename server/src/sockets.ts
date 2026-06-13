import { Server, type Socket } from 'socket.io'
import type { Server as HttpServer } from 'http'
import type {
  ClientToServerEvents, ServerToClientEvents,
  Participant, VideoState, RoomFileShare, FileInfo,
} from '../../shared/protocol.js'
import { findUserById, createMessage } from './db.js'
import { verifyToken } from './middleware.js'

interface SocketData {
  user: { id: string; username: string }
}

type BeaconSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>

interface Room {
  participants: Participant[]
  host: string
  videoState: VideoState
  fileShare: RoomFileShare | null
}

interface FileShareSession {
  hostId: string
  files: FileInfo[]
  expiresAt: number
  participants: Set<string>
}

// NOTE: rooms/file shares are in-memory for now; Phase 1 moves room state to
// SQLite so sessions survive server restarts.
const rooms = new Map<string, Room>()
const fileShares = new Map<string, FileShareSession>()
const onlineUsers = new Map<string, { socketId: string; username: string }>()

export default function initSocket(server: HttpServer) {
  const io = new Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>(server, {
    cors: { origin: true, methods: ['GET', 'POST'], credentials: true },
    transports: ['polling', 'websocket'],
    pingTimeout: 120000,
    pingInterval: 30000,
  })

  io.use((socket, next) => {
    // Auth token only via handshake.auth — never query strings (they end up in logs).
    const token = socket.handshake.auth.token
    if (typeof token !== 'string') return next(new Error('Authentication error'))
    try {
      const decoded = verifyToken(token)
      const user = findUserById(decoded.userId)
      if (!user) return next(new Error('User not found'))
      socket.data.user = { id: user.id, username: user.username }
      next()
    } catch {
      next(new Error('Invalid token'))
    }
  })

  io.on('connection', (socket: BeaconSocket) => {
    const { id: userId, username } = socket.data.user
    onlineUsers.set(userId, { socketId: socket.id, username })
    io.emit('user-online', { id: userId, username })

    socket.on('join-room', ({ roomId }) => {
      if (typeof roomId !== 'string' || !roomId) return
      socket.join(roomId)
      let room = rooms.get(roomId)
      if (!room) {
        room = {
          participants: [],
          host: userId,
          videoState: { isPlaying: false, currentTime: 0, url: null },
          fileShare: null,
        }
        rooms.set(roomId, room)
      }
      const existing = room.participants.find((p) => p.id === userId)
      if (existing) existing.socketId = socket.id
      else room.participants.push({ id: userId, username, socketId: socket.id })

      socket.emit('room-joined', {
        participants: room.participants,
        isHost: userId === room.host,
        videoState: room.videoState,
        fileShare: room.fileShare,
      })
      socket.to(roomId).emit('user-joined', { participants: room.participants, user: { id: userId, username } })
    })

    socket.on('get-server-time', (cb) => {
      if (typeof cb === 'function') cb(Date.now())
    })

    socket.on('video-url-set', ({ roomId, url }) => {
      const room = rooms.get(roomId)
      if (!room || typeof url !== 'string') return
      room.videoState.url = url
      io.to(roomId).emit('video-url-set', { url })
    })

    socket.on('video-play', ({ roomId, currentTime }) => {
      const room = rooms.get(roomId)
      if (!room || typeof currentTime !== 'number') return
      room.videoState.isPlaying = true
      room.videoState.currentTime = currentTime
      io.to(roomId).emit('video-play', { currentTime, timestamp: Date.now() })
    })

    socket.on('video-pause', ({ roomId, currentTime }) => {
      const room = rooms.get(roomId)
      if (!room || typeof currentTime !== 'number') return
      room.videoState.isPlaying = false
      room.videoState.currentTime = currentTime
      io.to(roomId).emit('video-pause', { currentTime })
    })

    socket.on('video-seek', ({ roomId, currentTime }) => {
      const room = rooms.get(roomId)
      if (!room || typeof currentTime !== 'number') return
      room.videoState.currentTime = currentTime
      io.to(roomId).emit('video-seek', { currentTime })
    })

    socket.on('chat-message', ({ roomId, message, timestamp }) => {
      if (typeof message !== 'string' || !rooms.has(roomId)) return
      // Username comes from the authenticated socket, never from the payload.
      io.to(roomId).emit('chat-message', { username, message, timestamp })
    })

    socket.on('leave-room', ({ roomId }) => {
      if (!roomId) return
      socket.leave(roomId)
      removeFromRoom(roomId, userId)
    })

    socket.on('private-message', ({ to, message, timestamp }) => {
      if (typeof to !== 'string' || typeof message !== 'string') return
      const ts = typeof timestamp === 'number' ? timestamp : Date.now()
      if (!findUserById(to)) return
      try {
        createMessage(userId, to, message, ts)
      } catch (e) {
        console.error('Failed to persist private message:', e)
      }
      const rec = onlineUsers.get(to)
      if (rec) io.to(rec.socketId).emit('private-message', { from: { id: userId, username }, message, timestamp: ts })
    })

    // ---- Generic P2P file share (8-char codes) ----
    socket.on('file-share-create', ({ code, files }) => {
      if (typeof code !== 'string' || !Array.isArray(files)) return
      fileShares.set(code, { hostId: socket.id, files, expiresAt: Date.now() + 1800000, participants: new Set([socket.id]) })
    })

    socket.on('file-share-join', ({ code }) => {
      const share = fileShares.get(code)
      if (share && share.expiresAt > Date.now()) {
        share.participants.add(socket.id)
        socket.emit('file-share-info', { files: share.files, hostId: share.hostId, code })
      } else {
        socket.emit('file-share-error', { message: 'Expired or invalid code' })
      }
    })

    socket.on('file-share-request', ({ to }) => { io.to(to).emit('file-share-request', { from: socket.id }) })
    socket.on('file-share-ready', ({ to, fileInfo }) => { io.to(to).emit('file-share-ready', { from: socket.id, fileInfo }) })

    socket.on('file-share-signal', ({ to, signal }) => {
      for (const share of fileShares.values()) {
        if (share.participants.has(socket.id) && share.participants.has(to)) {
          io.to(to).emit('file-share-signal', { from: socket.id, signal })
          return
        }
      }
    })

    socket.on('file-share-cancel', ({ code }) => {
      const share = fileShares.get(code)
      if (share?.hostId === socket.id) fileShares.delete(code)
    })

    // ---- Watch party video file share ----
    socket.on('video-file-share', ({ roomId, fileInfo }) => {
      const room = rooms.get(roomId)
      if (!room) return
      room.fileShare = { fileInfo, hostId: socket.id }
      socket.to(roomId).emit('video-file-info', { fileInfo, hostId: socket.id })
    })

    socket.on('video-file-request', ({ to }) => { io.to(to).emit('video-file-request', { from: socket.id }) })
    socket.on('video-file-ready', ({ to, fileInfo }) => { io.to(to).emit('video-file-ready', { from: socket.id, fileInfo }) })

    socket.on('video-file-signal', ({ to, signal }) => {
      for (const room of rooms.values()) {
        const sender = room.participants.some((p) => p.socketId === socket.id)
        const receiver = room.participants.some((p) => p.socketId === to)
        if (sender && receiver) {
          io.to(to).emit('video-file-signal', { from: socket.id, signal })
          return
        }
      }
    })

    socket.on('video-file-cancel', ({ roomId }) => {
      const room = rooms.get(roomId)
      if (!room) return
      room.fileShare = null
      socket.to(roomId).emit('video-file-cancel')
    })

    socket.on('disconnect', () => {
      onlineUsers.delete(userId)
      io.emit('user-offline', userId)
      for (const [roomId, room] of rooms) {
        if (room.participants.some((p) => p.id === userId)) {
          removeFromRoom(roomId, userId)
        }
      }
    })

    function removeFromRoom(roomId: string, leavingUserId: string) {
      const room = rooms.get(roomId)
      if (!room) return
      const leaving = room.participants.find((p) => p.id === leavingUserId)
      room.participants = room.participants.filter((p) => p.id !== leavingUserId)

      if (room.participants.length === 0) {
        rooms.delete(roomId)
        return
      }
      if (room.host === leavingUserId) {
        room.host = room.participants[0].id
        room.fileShare = null
        io.to(roomId).emit('host-changed', { newHost: room.host })
      }
      io.to(roomId).emit('user-left', {
        participants: room.participants,
        user: { id: leavingUserId, username: leaving?.username ?? 'unknown' },
      })
    }
  })

  return io
}
