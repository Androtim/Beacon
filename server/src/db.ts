import Database from 'better-sqlite3'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import type { PublicUser, ConversationSummary, MessagesResponse, VideoState } from '../../shared/protocol.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

let dbPath = process.env.DB_PATH
if (!dbPath) {
  const dataDir = path.join(__dirname, '..', 'data')
  fs.mkdirSync(dataDir, { recursive: true })
  dbPath = path.join(dataDir, 'beacon.db')
} else {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true })
}

const db = new Database(dbPath)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

// ---------- Migrations (PRAGMA user_version) ----------

const MIGRATIONS: string[] = [
  // v1: initial schema
  `
  CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    username      TEXT NOT NULL UNIQUE COLLATE NOCASE,
    email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    is_online     INTEGER NOT NULL DEFAULT 0,
    last_seen     INTEGER NOT NULL,
    created_at    INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS messages (
    id        TEXT PRIMARY KEY,
    from_id   TEXT NOT NULL REFERENCES users(id),
    to_id     TEXT NOT NULL REFERENCES users(id),
    message   TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    read      INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_messages_pair ON messages (from_id, to_id, timestamp);
  CREATE INDEX IF NOT EXISTS idx_messages_to   ON messages (to_id, timestamp);
  `,
  // v2: guest users (email/password optional) + persistent rooms
  `
  CREATE TABLE users_v2 (
    id            TEXT PRIMARY KEY,
    username      TEXT NOT NULL UNIQUE COLLATE NOCASE,
    email         TEXT UNIQUE COLLATE NOCASE,
    password_hash TEXT,
    is_guest      INTEGER NOT NULL DEFAULT 0,
    is_online     INTEGER NOT NULL DEFAULT 0,
    last_seen     INTEGER NOT NULL,
    created_at    INTEGER NOT NULL
  );
  INSERT INTO users_v2 (id, username, email, password_hash, is_guest, is_online, last_seen, created_at)
    SELECT id, username, email, password_hash, 0, is_online, last_seen, created_at FROM users;
  DROP TABLE users;
  ALTER TABLE users_v2 RENAME TO users;

  CREATE TABLE rooms (
    id          TEXT PRIMARY KEY,
    host_id     TEXT NOT NULL,
    video_url   TEXT,
    is_playing  INTEGER NOT NULL DEFAULT 0,
    position    REAL NOT NULL DEFAULT 0,
    updated_at  INTEGER NOT NULL,
    created_at  INTEGER NOT NULL,
    last_active INTEGER NOT NULL
  );
  CREATE INDEX idx_rooms_last_active ON rooms (last_active);
  `,
]

const migrate = db.transaction(() => {
  const current = db.pragma('user_version', { simple: true }) as number
  for (let v = current; v < MIGRATIONS.length; v++) {
    db.exec(MIGRATIONS[v])
    db.pragma(`user_version = ${v + 1}`)
  }
})
migrate()

// ---------- Users ----------

export interface UserRow {
  id: string
  username: string
  email: string | null
  password_hash: string | null
  is_guest: number
  is_online: number
  last_seen: number
  created_at: number
}

interface MessageRow {
  id: string
  from_id: string
  to_id: string
  message: string
  timestamp: number
  read: number
}

export function toPublicUser(row: UserRow): PublicUser {
  return {
    id: row.id,
    username: row.username,
    email: row.email ?? undefined,
    isGuest: !!row.is_guest,
    isOnline: !!row.is_online,
    lastSeen: row.last_seen,
    createdAt: row.created_at,
  }
}

const insertUser = db.prepare(
  `INSERT INTO users (id, username, email, password_hash, is_guest, is_online, last_seen, created_at)
   VALUES (?, ?, ?, ?, ?, 0, ?, ?)`
)
const selectUserById = db.prepare(`SELECT * FROM users WHERE id = ?`)
const selectUserByEmail = db.prepare(`SELECT * FROM users WHERE email = ?`)
const selectUserByUsername = db.prepare(`SELECT * FROM users WHERE username = ?`)
const updateOnline = db.prepare(`UPDATE users SET is_online = ?, last_seen = ? WHERE id = ?`)
const updateUsernameStmt = db.prepare(`UPDATE users SET username = ? WHERE id = ?`)
const upgradeGuestStmt = db.prepare(
  `UPDATE users SET username = ?, email = ?, password_hash = ?, is_guest = 0 WHERE id = ?`
)
const searchUsersStmt = db.prepare(
  `SELECT * FROM users WHERE username LIKE ? ESCAPE '\\' AND is_guest = 0 ORDER BY username LIMIT 20`
)

export function createUser(username: string, email: string, password: string): UserRow {
  const now = Date.now()
  const id = randomUUID()
  insertUser.run(id, username.trim(), email.trim().toLowerCase(), bcrypt.hashSync(password, 12), 0, now, now)
  return findUserById(id)!
}

export function createGuest(username?: string): UserRow {
  const now = Date.now()
  const id = randomUUID()
  for (let attempt = 0; attempt < 10; attempt++) {
    const name = username && attempt === 0
      ? username.trim()
      : `Guest-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
    try {
      insertUser.run(id, name, null, null, 1, now, now)
      return findUserById(id)!
    } catch (e: any) {
      if (!String(e.message).includes('UNIQUE')) throw e
    }
  }
  throw new Error('Could not allocate a unique guest username')
}

export function upgradeGuestToAccount(id: string, username: string, email: string, password: string): UserRow {
  upgradeGuestStmt.run(username.trim(), email.trim().toLowerCase(), bcrypt.hashSync(password, 12), id)
  return findUserById(id)!
}

export function updateUsername(id: string, username: string): UserRow {
  updateUsernameStmt.run(username.trim(), id)
  return findUserById(id)!
}

export function findUserById(id: string): UserRow | undefined {
  return selectUserById.get(id) as UserRow | undefined
}

export function findUserByEmail(email: string): UserRow | undefined {
  return selectUserByEmail.get(email.trim().toLowerCase()) as UserRow | undefined
}

export function findUserByUsername(username: string): UserRow | undefined {
  return selectUserByUsername.get(username.trim()) as UserRow | undefined
}

export function verifyPassword(user: UserRow, password: string): boolean {
  if (!user.password_hash) return false
  return bcrypt.compareSync(password, user.password_hash)
}

export function setUserOnline(id: string, isOnline: boolean): void {
  updateOnline.run(isOnline ? 1 : 0, Date.now(), id)
}

export function searchUsers(query: string): PublicUser[] {
  const escaped = query.replace(/[\\%_]/g, (c) => `\\${c}`)
  const rows = searchUsersStmt.all(`%${escaped}%`) as UserRow[]
  return rows.map(toPublicUser)
}

// ---------- Rooms ----------

export interface RoomRow {
  id: string
  host_id: string
  video_url: string | null
  is_playing: number
  position: number
  updated_at: number
  created_at: number
  last_active: number
}

const insertRoom = db.prepare(
  `INSERT INTO rooms (id, host_id, video_url, is_playing, position, updated_at, created_at, last_active)
   VALUES (?, ?, NULL, 0, 0, ?, ?, ?)`
)
const selectRoom = db.prepare(`SELECT * FROM rooms WHERE id = ?`)
const updateRoomVideo = db.prepare(
  `UPDATE rooms SET video_url = ?, is_playing = ?, position = ?, updated_at = ?, last_active = ? WHERE id = ?`
)
const updateRoomHost = db.prepare(`UPDATE rooms SET host_id = ?, last_active = ? WHERE id = ?`)
const touchRoomStmt = db.prepare(`UPDATE rooms SET last_active = ? WHERE id = ?`)
const deleteStaleRooms = db.prepare(`DELETE FROM rooms WHERE last_active < ?`)

export function getOrCreateRoom(roomId: string, hostId: string): RoomRow {
  const existing = selectRoom.get(roomId) as RoomRow | undefined
  if (existing) return existing
  const now = Date.now()
  insertRoom.run(roomId, hostId, now, now, now)
  return selectRoom.get(roomId) as RoomRow
}

export function getRoom(roomId: string): RoomRow | undefined {
  return selectRoom.get(roomId) as RoomRow | undefined
}

export function setRoomVideoState(roomId: string, state: VideoState): void {
  updateRoomVideo.run(state.url, state.isPlaying ? 1 : 0, state.currentTime, Date.now(), Date.now(), roomId)
}

export function setRoomHost(roomId: string, hostId: string): void {
  updateRoomHost.run(hostId, Date.now(), roomId)
}

export function touchRoom(roomId: string): void {
  touchRoomStmt.run(Date.now(), roomId)
}

/** Current playback state, advancing position by elapsed wall-clock time if playing. */
export function roomVideoState(room: RoomRow): VideoState {
  let currentTime = room.position
  if (room.is_playing) currentTime += (Date.now() - room.updated_at) / 1000
  return { url: room.video_url, isPlaying: !!room.is_playing, currentTime }
}

const ROOM_TTL_MS = 24 * 60 * 60 * 1000

export function cleanupStaleRooms(): number {
  return deleteStaleRooms.run(Date.now() - ROOM_TTL_MS).changes
}

// ---------- Messages ----------

const insertMessage = db.prepare(
  `INSERT INTO messages (id, from_id, to_id, message, timestamp, read) VALUES (?, ?, ?, ?, ?, 0)`
)
const selectMessagesBetween = db.prepare(
  `SELECT * FROM messages
   WHERE (from_id = @a AND to_id = @b) OR (from_id = @b AND to_id = @a)
   ORDER BY timestamp ASC LIMIT 100`
)
const markRead = db.prepare(
  `UPDATE messages SET read = 1 WHERE from_id = ? AND to_id = ? AND read = 0`
)
const selectConversations = db.prepare(
  `SELECT m.* FROM messages m
   JOIN (
     SELECT CASE WHEN from_id = @me THEN to_id ELSE from_id END AS other,
            MAX(timestamp) AS max_ts
     FROM messages WHERE from_id = @me OR to_id = @me
     GROUP BY other
   ) latest
   ON ((m.from_id = @me AND m.to_id = latest.other) OR (m.from_id = latest.other AND m.to_id = @me))
      AND m.timestamp = latest.max_ts
   ORDER BY m.timestamp DESC`
)
const countUnreadFrom = db.prepare(
  `SELECT COUNT(*) AS n FROM messages WHERE from_id = ? AND to_id = ? AND read = 0`
)

export function createMessage(fromId: string, toId: string, message: string, timestamp: number): MessageRow {
  const row: MessageRow = { id: randomUUID(), from_id: fromId, to_id: toId, message, timestamp, read: 0 }
  insertMessage.run(row.id, row.from_id, row.to_id, row.message, row.timestamp)
  return row
}

export function getMessagesBetween(meId: string, otherId: string): MessagesResponse['messages'] {
  const rows = selectMessagesBetween.all({ a: meId, b: otherId }) as MessageRow[]
  markRead.run(otherId, meId)
  const userCache = new Map<string, { id: string; username: string }>()
  const userRef = (id: string) => {
    let u = userCache.get(id)
    if (!u) {
      const row = findUserById(id)
      u = { id, username: row?.username ?? 'unknown' }
      userCache.set(id, u)
    }
    return u
  }
  return rows.map((r) => ({
    id: r.id,
    from: userRef(r.from_id),
    to: userRef(r.to_id),
    message: r.message,
    timestamp: r.timestamp,
    read: !!r.read,
  }))
}

export function getConversations(meId: string): ConversationSummary[] {
  const rows = selectConversations.all({ me: meId }) as MessageRow[]
  return rows.flatMap((r) => {
    const otherId = r.from_id === meId ? r.to_id : r.from_id
    const other = findUserById(otherId)
    if (!other) return []
    const unread = (countUnreadFrom.get(otherId, meId) as { n: number }).n
    return [{
      user: { id: other.id, username: other.username },
      lastMessage: { message: r.message, timestamp: r.timestamp },
      unreadCount: unread,
    }]
  })
}

export default db
