import type { Participant, PlaybackState } from '../../shared/protocol.js'
import { targetPosition } from '../../shared/sync.js'
import {
  getOrCreateRoom, getRoom, setRoomPlayback, setRoomHost,
  touchRoom, roomPlaybackState, cleanupStaleRooms, type RoomRow,
} from './db.js'

// Room state is persisted in SQLite (survives server restarts); live
// participant presence is in-memory (rebuilt as sockets reconnect and rejoin).

export interface LiveParticipant {
  id: string // userId
  username: string
  socketId: string
}

const live = new Map<string, Map<string, LiveParticipant>>() // roomId -> userId -> participant
const hostGraceTimers = new Map<string, NodeJS.Timeout>()

const HOST_GRACE_MS = 30_000

export function participantsOf(roomId: string): Participant[] {
  return [...(live.get(roomId)?.values() ?? [])]
}

export function liveParticipant(roomId: string, userId: string): LiveParticipant | undefined {
  return live.get(roomId)?.get(userId)
}

/** Both socket ids present in the same room — used to authorize WebRTC signal relay. */
export function inSameRoom(socketIdA: string, socketIdB: string): boolean {
  for (const room of live.values()) {
    let a = false, b = false
    for (const p of room.values()) {
      if (p.socketId === socketIdA) a = true
      if (p.socketId === socketIdB) b = true
    }
    if (a && b) return true
  }
  return false
}

export interface JoinResult {
  room: RoomRow
  participants: Participant[]
  isHost: boolean
  playback: PlaybackState
  rejoined: boolean
}

export function joinRoom(roomId: string, user: { id: string; username: string }, socketId: string): JoinResult {
  const room = getOrCreateRoom(roomId, user.id)
  let map = live.get(roomId)
  if (!map) {
    map = new Map()
    live.set(roomId, map)
  }
  const rejoined = map.has(user.id)
  map.set(user.id, { id: user.id, username: user.username, socketId })
  touchRoom(roomId)

  // Host came back within the grace window — cancel pending migration.
  if (room.host_id === user.id) {
    const timer = hostGraceTimers.get(roomId)
    if (timer) {
      clearTimeout(timer)
      hostGraceTimers.delete(roomId)
    }
  }

  return {
    room,
    participants: participantsOf(roomId),
    isHost: room.host_id === user.id,
    playback: roomPlaybackState(room),
    rejoined,
  }
}

export interface LeaveResult {
  participants: Participant[]
  newHostId?: string
}

/** Explicit leave: remove immediately and migrate host right away if needed. */
export function leaveRoom(roomId: string, userId: string): LeaveResult | null {
  const map = live.get(roomId)
  if (!map?.has(userId)) return null
  map.delete(userId)
  if (map.size === 0) live.delete(roomId)
  touchRoom(roomId)

  const room = getRoom(roomId)
  let newHostId: string | undefined
  if (room && room.host_id === userId) {
    const next = map.values().next().value as LiveParticipant | undefined
    if (next) {
      setRoomHost(roomId, next.id)
      newHostId = next.id
    }
    // No one left online: host keeps the room (they may come back to it).
  }
  return { participants: participantsOf(roomId), newHostId }
}

/**
 * Disconnect (network blip, refresh, sleep): remove presence now, but give the
 * host a grace window to come back before migrating host to someone else.
 * Returns the rooms the user was in; onHostMigrated fires later if the grace
 * window expires.
 */
export function handleDisconnect(
  userId: string,
  socketId: string,
  onLeft: (roomId: string, participants: Participant[]) => void,
  onHostMigrated: (roomId: string, newHostId: string) => void,
): void {
  for (const [roomId, map] of live) {
    const p = map.get(userId)
    if (!p || p.socketId !== socketId) continue // a newer socket owns this user's presence
    map.delete(userId)
    if (map.size === 0) live.delete(roomId)
    touchRoom(roomId)
    onLeft(roomId, participantsOf(roomId))

    const room = getRoom(roomId)
    if (room && room.host_id === userId && map.size > 0 && !hostGraceTimers.has(roomId)) {
      const timer = setTimeout(() => {
        hostGraceTimers.delete(roomId)
        const current = getRoom(roomId)
        const stillLive = live.get(roomId)
        if (!current || !stillLive || stillLive.size === 0) return
        if (stillLive.has(current.host_id)) return // host returned
        const next = stillLive.values().next().value as LiveParticipant
        setRoomHost(roomId, next.id)
        onHostMigrated(roomId, next.id)
      }, HOST_GRACE_MS)
      hostGraceTimers.set(roomId, timer)
    }
  }
}

/**
 * Apply a host intent and return the new authoritative state.
 * `position` defaults to the position the room would be at right now
 * (so a bare pause/play intent without a position is still coherent).
 */
export function applyPlaybackIntent(
  roomId: string,
  intent: { url?: string | null; isPlaying?: boolean; position?: number },
): PlaybackState | null {
  const room = getRoom(roomId)
  if (!room) return null
  const current = roomPlaybackState(room)
  const next = {
    url: intent.url !== undefined ? intent.url : current.url,
    isPlaying: intent.isPlaying !== undefined ? intent.isPlaying : current.isPlaying,
    position: intent.position !== undefined ? intent.position : targetPosition(current, Date.now()),
  }
  setRoomPlayback(roomId, next)
  return roomPlaybackState(getRoom(roomId)!)
}

export function isHost(roomId: string, userId: string): boolean {
  return getRoom(roomId)?.host_id === userId
}

export function startRoomCleanup(): NodeJS.Timeout {
  return setInterval(() => {
    const removed = cleanupStaleRooms()
    if (removed > 0) console.log(`🧹 Cleaned up ${removed} stale room(s)`)
  }, 60 * 60 * 1000)
}
