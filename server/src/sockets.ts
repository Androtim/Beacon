import { Server, type Socket } from 'socket.io'
import type { Server as HttpServer } from 'http'
import { randomUUID } from 'crypto'
import type { z } from 'zod'
import type { ServerToClientEvents, RoomFileShare, FileInfo } from '../../shared/protocol.js'
import { findUserById, createMessage, getRoom, isGroupMember, createGroupMessage, groupMemberIds } from './db.js'
import type { GroupSummary } from '../../shared/protocol.js'
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
const voiceRooms = new Map<string, Map<string, string>>() // roomId -> socketId -> username
const streamRequests = new Map<string, { roomId: string; url: string; fromUserId: string }>() // requestId -> request

const FILE_SHARE_TTL_MS = 30 * 60 * 1000

// Module-level handle so REST routes (e.g. group creation) can push live
// notifications to connected members without owning the socket server.
let ioRef: BeaconServer | null = null

/** Emit an event to each listed user's connected socket (skips offline users). */
export function emitToUsers<E extends keyof ServerToClientEvents>(
  userIds: string[],
  event: E,
  ...args: Parameters<ServerToClientEvents[E]>
): void {
  if (!ioRef) return
  const seen = new Set<string>()
  for (const uid of userIds) {
    const sid = onlineUsers.get(uid)?.socketId
    if (sid && !seen.has(sid)) {
      seen.add(sid)
      ioRef.to(sid).emit(event, ...args)
    }
  }
}

export function notifyGroupCreated(group: GroupSummary): void {
  emitToUsers(group.members.map((m) => m.id), 'group-created', { group })
}

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
  ioRef = io

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
        playback: result.playback,
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

    // ---- Video state ----
    // Playback control (play/pause/seek) is shared: any participant in the room
    // can drive it. Setting the source (video-url-set) stays host-only — that's
    // the owner-authorized "what are we watching" decision.

    function applyAndBroadcast(roomId: string, intent: Parameters<typeof rooms.applyPlaybackIntent>[1]) {
      const playback = rooms.applyPlaybackIntent(roomId, intent)
      if (playback) io.to(roomId).emit('video-state', { playback })
    }

    on('video-url-set', ({ roomId, url }) => {
      if (!rooms.isHost(roomId, userId)) return
      applyAndBroadcast(roomId, { url, isPlaying: false, position: 0 })
    })
    on('video-play', ({ roomId, currentTime }) => {
      if (!rooms.liveParticipant(roomId, userId)) return
      applyAndBroadcast(roomId, { isPlaying: true, position: currentTime })
    })
    on('video-pause', ({ roomId, currentTime }) => {
      if (!rooms.liveParticipant(roomId, userId)) return
      applyAndBroadcast(roomId, { isPlaying: false, position: currentTime })
    })
    on('video-seek', ({ roomId, currentTime }) => {
      if (!rooms.liveParticipant(roomId, userId)) return
      applyAndBroadcast(roomId, { position: currentTime })
    })

    // ---- Request to stream (owner authorization) ----
    // Any participant can suggest a video URL. If they're the host it just
    // plays; otherwise the host gets an approval prompt.
    on('stream-request', ({ roomId, url }) => {
      if (!rooms.liveParticipant(roomId, userId)) return
      if (rooms.isHost(roomId, userId)) {
        applyAndBroadcast(roomId, { url, isPlaying: false, position: 0 })
        return
      }
      const room = getRoom(roomId)
      if (!room) return
      const hostLive = rooms.liveParticipant(roomId, room.host_id)
      if (!hostLive) return // no host online to approve
      const requestId = randomUUID()
      streamRequests.set(requestId, { roomId, url, fromUserId: userId })
      io.to(hostLive.socketId).emit('stream-request', { requestId, from: { id: userId, username }, url })
    })

    on('stream-respond', ({ roomId, requestId, approve }) => {
      if (!rooms.isHost(roomId, userId)) return
      const req = streamRequests.get(requestId)
      if (!req || req.roomId !== roomId) return
      streamRequests.delete(requestId)
      if (approve) applyAndBroadcast(roomId, { url: req.url, isPlaying: false, position: 0 })
      const requester = rooms.liveParticipant(roomId, req.fromUserId)
      if (requester) io.to(requester.socketId).emit('stream-request-resolved', { requestId, approved: approve, url: req.url })
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

    // ---- File-in-DM (P2P transfer between two accounts, relayed by userId) ----
    function dmRecipientSocket(to: string): string | null {
      if (isGuest) return null
      const recipient = findUserById(to)
      if (!recipient || recipient.is_guest) return null
      return onlineUsers.get(to)?.socketId ?? null
    }
    on('dm-file-offer', ({ to, transferId, fileInfo }) => {
      if (isGuest) return
      const recipient = findUserById(to)
      if (!recipient || recipient.is_guest) return
      // Persist as a typed message so the offer is visible whenever they open
      // the chat — even if they were offline or elsewhere when it was sent.
      try {
        createMessage(userId, to, `📎 ${fileInfo.name}`, Date.now(), 'file-offer', { transferId, fileInfo })
      } catch (e) {
        console.error('Failed to persist file offer:', e)
      }
      const sid = onlineUsers.get(to)?.socketId
      if (sid) io.to(sid).emit('dm-file-offer', { from: userId, fromUsername: username, transferId, fileInfo })
    })
    on('dm-file-request', ({ to, transferId }) => {
      const sid = dmRecipientSocket(to)
      if (sid) io.to(sid).emit('dm-file-request', { from: userId, transferId })
    })
    on('dm-file-decline', ({ to, transferId }) => {
      const sid = dmRecipientSocket(to)
      if (sid) io.to(sid).emit('dm-file-decline', { from: userId, transferId })
    })
    on('dm-file-signal', ({ to, signal }) => {
      const sid = dmRecipientSocket(to)
      if (sid) io.to(sid).emit('dm-file-signal', { from: userId, signal })
    })
    on('dm-party-invite', ({ to, roomId }) => {
      if (isGuest) return
      const recipient = findUserById(to)
      if (!recipient || recipient.is_guest) return
      // Persist so the invite survives offline/late opens. The roomId is stable,
      // so the Join card works any time after — not just while both are online.
      try {
        createMessage(userId, to, '📺 Watch party', Date.now(), 'party-invite', { roomId })
      } catch (e) {
        console.error('Failed to persist party invite:', e)
      }
      const sid = onlineUsers.get(to)?.socketId
      if (sid) io.to(sid).emit('dm-party-invite', { from: userId, fromUsername: username, roomId })
    })

    // ---- Group DMs ----
    on('group-message', ({ groupId, body, timestamp, kind, meta }) => {
      if (isGuest) return
      // Only members may post; this also rejects stale/forged group ids.
      if (!isGroupMember(groupId, userId)) return
      const ts = typeof timestamp === 'number' ? timestamp : Date.now()
      let saved
      try {
        saved = createGroupMessage(groupId, userId, body, ts, kind ?? 'text', meta ?? null)
      } catch (e) {
        console.error('Failed to persist group message:', e)
        return
      }
      const payload = {
        groupId,
        id: saved.id,
        from: { id: userId, username },
        body,
        timestamp: ts,
        kind: saved.kind,
        meta: saved.meta,
      }
      // Fan out to every member except the sender (their client echoes locally).
      const recipients = groupMemberIds(groupId).filter((id) => id !== userId)
      emitToUsers(recipients, 'group-message', payload)
    })

    // Group file transfer handshake (1:1 between sharer and each downloader),
    // relayed by userId on its own channel so it never collides with dm-file-*.
    on('group-file-request', ({ to, transferId }) => {
      const sid = dmRecipientSocket(to)
      if (sid) io.to(sid).emit('group-file-request', { from: userId, transferId })
    })
    on('group-file-signal', ({ to, signal }) => {
      const sid = dmRecipientSocket(to)
      if (sid) io.to(sid).emit('group-file-signal', { from: userId, signal })
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

    // ---- Voice chat ----

    on('voice-join', ({ roomId }) => {
      if (!rooms.liveParticipant(roomId, userId)) return
      let members = voiceRooms.get(roomId)
      if (!members) {
        members = new Map()
        voiceRooms.set(roomId, members)
      }
      // The joiner dials everyone already in voice.
      socket.emit('voice-members', {
        members: [...members.entries()].map(([sid, name]) => ({ socketId: sid, username: name })),
      })
      members.set(socket.id, username)
      socket.to(roomId).emit('voice-peer-joined', { socketId: socket.id, username })
    })

    on('voice-leave', ({ roomId }) => leaveVoice(roomId))

    on('voice-signal', ({ to, signal }) => {
      if (!rooms.inSameRoom(socket.id, to)) return
      io.to(to).emit('voice-signal', { from: socket.id, signal })
    })

    function leaveVoice(roomId: string) {
      const members = voiceRooms.get(roomId)
      if (!members?.has(socket.id)) return
      members.delete(socket.id)
      if (members.size === 0) voiceRooms.delete(roomId)
      socket.to(roomId).emit('voice-peer-left', { socketId: socket.id })
    }

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
      for (const [roomId, members] of voiceRooms) {
        if (members.delete(socket.id)) {
          if (members.size === 0) voiceRooms.delete(roomId)
          socket.to(roomId).emit('voice-peer-left', { socketId: socket.id })
        }
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
