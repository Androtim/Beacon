import { Server, type Socket } from 'socket.io'
import type { Server as HttpServer } from 'http'
import type { z } from 'zod'
import type { ServerToClientEvents, RoomFileShare, FileInfo } from '../../shared/protocol.js'
import { findUserById, createMessage, getRoom } from './db.js'
import { verifyToken } from './middleware.js'
import { schemas, type SchemaMap } from './validation.js'
import * as rooms from './rooms.js'

interface SocketUser {
  id: string
  username: string
  isGuest: boolean
}

type BeaconServer = Server<Record<string, never>, ServerToClientEvents>
type BeaconSocket = Socket<Record<string, never>, ServerToClientEvents> & { data: { user: SocketUser } }

interface FileShareSession {
  hostSocketId: string
  files: FileInfo[]
  expiresAt: number
  participants: Set<string>
}

// Ephemeral by nature (they reference live sockets / in-browser blobs).
const fileShares = new Map<string, FileShareSession>()
const roomFileShares = new Map<string, RoomFileShare>()
const onlineUsers = new Map<string, { socketId: string; username: string }>()

const FILE_SHARE_TTL_MS = 30 * 60 * 1000

export default function initSocket(server: HttpServer, allowOrigin: (origin: string | undefined) => boolean) {
  const io: BeaconServer = new Server(server, {
    cors: {
      origin: (origin, cb) => cb(null, allowOrigin(origin ?? undefined)),
      methods: ['GET', 'POST'],
      credentials: true,
    },
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
      socket.data.user = { id: user.id, username: user.username, isGuest: !!user.is_guest } satisfies SocketUser
      next()
    } catch {
      next(new Error('Invalid token'))
    }
  })

  io.on('connection', (rawSocket) => {
    const socket = rawSocket as BeaconSocket
    const { id: userId, username, isGuest } = socket.data.user
    onlineUsers.set(userId, { socketId: socket.id, username })
    io.emit('user-online', { id: userId, username })

    /** Register a handler whose payload is validated against its zod schema first. */
    function on<E extends keyof SchemaMap>(event: E, handler: (data: z.infer<SchemaMap[E]>) => void) {
      socket.on(event as string, (raw: unknown) => {
        const parsed = schemas[event].safeParse(raw)
        if (!parsed.success) return
        try {
          handler(parsed.data as z.infer<SchemaMap[E]>)
        } catch (e) {
          console.error(`Handler error for ${String(event)}:`, e)
        }
      })
    }

    socket.on('get-server-time', (cb: unknown) => {
      if (typeof cb === 'function') cb(Date.now())
    })

    // ---- Rooms ----

    on('join-room', ({ roomId }) => {
      socket.join(roomId)
      const result = rooms.joinRoom(roomId, { id: userId, username }, socket.id)
      socket.emit('room-joined', {
        participants: result.participants,
        isHost: result.isHost,
        videoState: result.videoState,
        fileShare: roomFileShares.get(roomId) ?? null,
      })
      if (result.rejoined) {
        socket.to(roomId).emit('participants-updated', { participants: result.participants })
      } else {
        socket.to(roomId).emit('user-joined', { participants: result.participants, user: { id: userId, username } })
      }
    })

    on('leave-room', ({ roomId }) => {
      socket.leave(roomId)
      const result = rooms.leaveRoom(roomId, userId)
      if (!result) return
      io.to(roomId).emit('user-left', { participants: result.participants, user: { id: userId, username } })
      if (result.newHostId) io.to(roomId).emit('host-changed', { newHost: result.newHostId })
    })

    // ---- Video state (host-controlled) ----

    on('video-url-set', ({ roomId, url }) => {
      if (!rooms.isHost(roomId, userId)) return
      const state = rooms.updateVideoState(roomId, { url, isPlaying: false, currentTime: 0 })
      if (state) io.to(roomId).emit('video-url-set', { url })
    })

    on('video-play', ({ roomId, currentTime }) => {
      if (!rooms.isHost(roomId, userId)) return
      const state = rooms.updateVideoState(roomId, { isPlaying: true, currentTime })
      if (state) io.to(roomId).emit('video-play', { currentTime, timestamp: Date.now() })
    })

    on('video-pause', ({ roomId, currentTime }) => {
      if (!rooms.isHost(roomId, userId)) return
      const state = rooms.updateVideoState(roomId, { isPlaying: false, currentTime })
      if (state) io.to(roomId).emit('video-pause', { currentTime })
    })

    on('video-seek', ({ roomId, currentTime }) => {
      if (!rooms.isHost(roomId, userId)) return
      const state = rooms.updateVideoState(roomId, { currentTime })
      if (state) io.to(roomId).emit('video-seek', { currentTime })
    })

    // ---- Chat ----

    on('chat-message', ({ roomId, message }) => {
      if (!rooms.liveParticipant(roomId, userId)) return
      // Identity comes from the authenticated socket, never from the payload.
      io.to(roomId).emit('chat-message', { username, message, timestamp: Date.now() })
    })

    on('private-message', ({ to, message, timestamp }) => {
      if (isGuest) return // DMs need a persistent identity
      const recipient = findUserById(to)
      if (!recipient || recipient.is_guest) return
      const ts = typeof timestamp === 'number' ? timestamp : Date.now()
      try {
        createMessage(userId, to, message, ts)
      } catch (e) {
        console.error('Failed to persist private message:', e)
      }
      const rec = onlineUsers.get(to)
      if (rec) io.to(rec.socketId).emit('private-message', { from: { id: userId, username }, message, timestamp: ts })
    })

    // ---- Generic P2P file share (share codes) ----

    on('file-share-create', ({ code, files }) => {
      const existing = fileShares.get(code)
      if (existing && existing.hostSocketId !== socket.id && existing.expiresAt > Date.now()) return
      fileShares.set(code, {
        hostSocketId: socket.id,
        files,
        expiresAt: Date.now() + FILE_SHARE_TTL_MS,
        participants: new Set([socket.id]),
      })
    })

    on('file-share-join', ({ code }) => {
      const share = fileShares.get(code)
      if (share && share.expiresAt > Date.now()) {
        share.participants.add(socket.id)
        socket.emit('file-share-info', { files: share.files, hostId: share.hostSocketId, code })
      } else {
        socket.emit('file-share-error', { message: 'Expired or invalid code' })
      }
    })

    on('file-share-request', ({ to }) => {
      if (!sharesWith(socket.id, to)) return
      io.to(to).emit('file-share-request', { from: socket.id })
    })

    on('file-share-ready', ({ to, fileInfo }) => {
      if (!sharesWith(socket.id, to)) return
      io.to(to).emit('file-share-ready', { from: socket.id, fileInfo: (fileInfo ?? null) as FileInfo[] | null })
    })

    on('file-share-signal', ({ to, signal }) => {
      if (!sharesWith(socket.id, to)) return
      io.to(to).emit('file-share-signal', { from: socket.id, signal })
    })

    on('file-share-cancel', ({ code }) => {
      const share = fileShares.get(code)
      if (share?.hostSocketId === socket.id) fileShares.delete(code)
    })

    // ---- Watch party video file share ----

    on('video-file-share', ({ roomId, fileInfo }) => {
      if (!rooms.isHost(roomId, userId) || !getRoom(roomId)) return
      roomFileShares.set(roomId, { fileInfo, hostId: socket.id })
      socket.to(roomId).emit('video-file-info', { fileInfo, hostId: socket.id })
    })

    on('video-file-request', ({ to }) => {
      if (!rooms.inSameRoom(socket.id, to)) return
      io.to(to).emit('video-file-request', { from: socket.id })
    })

    on('video-file-ready', ({ to, fileInfo }) => {
      if (!rooms.inSameRoom(socket.id, to)) return
      io.to(to).emit('video-file-ready', { from: socket.id, fileInfo: fileInfo ?? null })
    })

    on('video-file-signal', ({ to, signal }) => {
      if (!rooms.inSameRoom(socket.id, to)) return
      io.to(to).emit('video-file-signal', { from: socket.id, signal })
    })

    on('video-file-cancel', ({ roomId }) => {
      const share = roomFileShares.get(roomId)
      if (!share || share.hostId !== socket.id) return
      roomFileShares.delete(roomId)
      socket.to(roomId).emit('video-file-cancel')
    })

    // ---- Disconnect ----

    socket.on('disconnect', () => {
      if (onlineUsers.get(userId)?.socketId === socket.id) {
        onlineUsers.delete(userId)
        io.emit('user-offline', userId)
      }
      rooms.handleDisconnect(
        userId,
        socket.id,
        (roomId, participants) => {
          io.to(roomId).emit('user-left', { participants, user: { id: userId, username } })
          const share = roomFileShares.get(roomId)
          if (share?.hostId === socket.id) {
            roomFileShares.delete(roomId)
            io.to(roomId).emit('video-file-cancel')
          }
        },
        (roomId, newHostId) => {
          io.to(roomId).emit('host-changed', { newHost: newHostId })
        },
      )
      for (const [code, share] of fileShares) {
        if (share.hostSocketId === socket.id) fileShares.delete(code)
        else share.participants.delete(socket.id)
      }
    })
  })

  function sharesWith(a: string, b: string): boolean {
    for (const share of fileShares.values()) {
      if (share.expiresAt > Date.now() && share.participants.has(a) && share.participants.has(b)) return true
    }
    return false
  }

  rooms.startRoomCleanup()
  setInterval(() => {
    const now = Date.now()
    for (const [code, share] of fileShares) {
      if (share.expiresAt <= now) fileShares.delete(code)
    }
  }, 10 * 60 * 1000)
  return io
}
