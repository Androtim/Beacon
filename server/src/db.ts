import Database from 'better-sqlite3'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import type {
  PublicUser, ConversationSummary, MessagesResponse, PlaybackState,
  GroupSummary, GroupMessagesResponse, UserStats, ProfileResponse, LeaderboardEntry,
} from '../../shared/protocol.js'

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
  // v3: E2E DM encryption — users publish an ECDH public key (JWK)
  `
  ALTER TABLE users ADD COLUMN public_key TEXT;
  `,
  // v4: typed messages — party invites and file offers persist as DMs so a
  // recipient sees them whenever they open the chat, even if they were offline
  // or on another page when it was sent. 'meta' holds the structured payload.
  `
  ALTER TABLE messages ADD COLUMN kind TEXT NOT NULL DEFAULT 'text';
  ALTER TABLE messages ADD COLUMN meta TEXT;
  `,
  // v5: group DMs. A group message body is an opaque per-member envelope map
  // ({ userId: ciphertext }) so the server stays zero-knowledge — same E2E
  // guarantee as 1:1 DMs, just encrypted once per recipient.
  `
  CREATE TABLE groups (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    created_by TEXT NOT NULL REFERENCES users(id),
    created_at INTEGER NOT NULL
  );
  CREATE TABLE group_members (
    group_id  TEXT NOT NULL REFERENCES groups(id),
    user_id   TEXT NOT NULL REFERENCES users(id),
    joined_at INTEGER NOT NULL,
    PRIMARY KEY (group_id, user_id)
  );
  CREATE INDEX idx_group_members_user ON group_members (user_id);
  CREATE TABLE group_messages (
    id        TEXT PRIMARY KEY,
    group_id  TEXT NOT NULL REFERENCES groups(id),
    from_id   TEXT NOT NULL REFERENCES users(id),
    body      TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    kind      TEXT NOT NULL DEFAULT 'text',
    meta      TEXT
  );
  CREATE INDEX idx_group_messages ON group_messages (group_id, timestamp);
  `,
  // v6: per-user activity stats for profiles + leaderboards.
  `
  CREATE TABLE user_stats (
    user_id         TEXT PRIMARY KEY REFERENCES users(id),
    messages_sent   INTEGER NOT NULL DEFAULT 0,
    parties_started INTEGER NOT NULL DEFAULT 0,
    watch_seconds   INTEGER NOT NULL DEFAULT 0,
    updated_at      INTEGER NOT NULL DEFAULT 0
  );
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
  public_key: string | null
}

interface MessageRow {
  id: string
  from_id: string
  to_id: string
  message: string
  timestamp: number
  read: number
  kind: string
  meta: string | null
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
    publicKey: row.public_key ?? undefined,
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
const updatePublicKeyStmt = db.prepare(`UPDATE users SET public_key = ? WHERE id = ?`)
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

export function setPublicKey(id: string, publicKeyJwk: string): void {
  updatePublicKeyStmt.run(publicKeyJwk, id)
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

export function setRoomPlayback(roomId: string, state: { url: string | null; isPlaying: boolean; position: number }): void {
  updateRoomVideo.run(state.url, state.isPlaying ? 1 : 0, state.position, Date.now(), Date.now(), roomId)
}

export function setRoomHost(roomId: string, hostId: string): void {
  updateRoomHost.run(hostId, Date.now(), roomId)
}

export function touchRoom(roomId: string): void {
  touchRoomStmt.run(Date.now(), roomId)
}

/** Authoritative playback state as stored — clients advance position themselves. */
export function roomPlaybackState(room: RoomRow): PlaybackState {
  return {
    url: room.video_url,
    isPlaying: !!room.is_playing,
    position: room.position,
    atServerTime: room.updated_at,
  }
}

const ROOM_TTL_MS = 24 * 60 * 60 * 1000

export function cleanupStaleRooms(): number {
  return deleteStaleRooms.run(Date.now() - ROOM_TTL_MS).changes
}

// ---------- Messages ----------

const insertMessage = db.prepare(
  `INSERT INTO messages (id, from_id, to_id, message, timestamp, read, kind, meta) VALUES (?, ?, ?, ?, ?, 0, ?, ?)`
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

export function createMessage(
  fromId: string,
  toId: string,
  message: string,
  timestamp: number,
  kind: string = 'text',
  meta: Record<string, unknown> | null = null,
): MessageRow {
  const metaStr = meta ? JSON.stringify(meta) : null
  const row: MessageRow = { id: randomUUID(), from_id: fromId, to_id: toId, message, timestamp, read: 0, kind, meta: metaStr }
  insertMessage.run(row.id, row.from_id, row.to_id, row.message, row.timestamp, kind, metaStr)
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
    kind: r.kind ?? 'text',
    meta: r.meta ? (JSON.parse(r.meta) as Record<string, unknown>) : undefined,
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
      user: { id: other.id, username: other.username, publicKey: other.public_key ?? undefined },
      lastMessage: { message: r.message, timestamp: r.timestamp },
      unreadCount: unread,
    }]
  })
}

// ---------- Groups ----------

export interface GroupRow {
  id: string
  name: string
  created_by: string
  created_at: number
}

interface GroupMessageRow {
  id: string
  group_id: string
  from_id: string
  body: string
  timestamp: number
  kind: string
  meta: string | null
}

const insertGroup = db.prepare(`INSERT INTO groups (id, name, created_by, created_at) VALUES (?, ?, ?, ?)`)
const insertGroupMember = db.prepare(
  `INSERT OR IGNORE INTO group_members (group_id, user_id, joined_at) VALUES (?, ?, ?)`
)
const selectGroupById = db.prepare(`SELECT * FROM groups WHERE id = ?`)
const selectGroupMemberIds = db.prepare(`SELECT user_id FROM group_members WHERE group_id = ?`)
const selectGroupsForUser = db.prepare(
  `SELECT g.* FROM groups g
   JOIN group_members gm ON gm.group_id = g.id
   WHERE gm.user_id = ?
   ORDER BY g.created_at DESC`
)
const isMemberStmt = db.prepare(`SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?`)
const insertGroupMessage = db.prepare(
  `INSERT INTO group_messages (id, group_id, from_id, body, timestamp, kind, meta) VALUES (?, ?, ?, ?, ?, ?, ?)`
)
const selectGroupMessages = db.prepare(
  `SELECT * FROM group_messages WHERE group_id = ? ORDER BY timestamp ASC LIMIT 200`
)
const selectLastGroupMessage = db.prepare(
  `SELECT * FROM group_messages WHERE group_id = ? ORDER BY timestamp DESC LIMIT 1`
)

function groupMembers(groupId: string): PublicUser[] {
  const ids = (selectGroupMemberIds.all(groupId) as { user_id: string }[]).map((r) => r.user_id)
  return ids.flatMap((id) => {
    const u = findUserById(id)
    return u ? [toPublicUser(u)] : []
  })
}

function groupSummary(row: GroupRow): GroupSummary {
  const last = selectLastGroupMessage.get(row.id) as GroupMessageRow | undefined
  return {
    id: row.id,
    name: row.name,
    members: groupMembers(row.id).map((m) => ({ id: m.id, username: m.username, publicKey: m.publicKey })),
    lastMessage: last ? { from: last.from_id, timestamp: last.timestamp, kind: last.kind } : null,
  }
}

export function isGroupMember(groupId: string, userId: string): boolean {
  return !!isMemberStmt.get(groupId, userId)
}

/** Member ids for fan-out (raw, not PublicUser). */
export function groupMemberIds(groupId: string): string[] {
  return (selectGroupMemberIds.all(groupId) as { user_id: string }[]).map((r) => r.user_id)
}

export function createGroup(name: string, creatorId: string, memberIds: string[]): GroupSummary {
  const id = randomUUID()
  const now = Date.now()
  const create = db.transaction(() => {
    insertGroup.run(id, name.trim() || 'Group', creatorId, now)
    // Creator is always a member; ignore any member id that isn't a real account.
    const ids = new Set([creatorId, ...memberIds])
    for (const uid of ids) {
      const u = findUserById(uid)
      if (u && !u.is_guest) insertGroupMember.run(id, uid, now)
    }
  })
  create()
  return groupSummary(selectGroupById.get(id) as GroupRow)
}

export function getGroup(groupId: string): GroupSummary | null {
  const row = selectGroupById.get(groupId) as GroupRow | undefined
  return row ? groupSummary(row) : null
}

export function getGroupsForUser(userId: string): GroupSummary[] {
  const rows = selectGroupsForUser.all(userId) as GroupRow[]
  return rows.map(groupSummary)
}

export function createGroupMessage(
  groupId: string,
  fromId: string,
  body: string,
  timestamp: number,
  kind: string = 'text',
  meta: Record<string, unknown> | null = null,
): GroupMessagesResponse['messages'][number] {
  const id = randomUUID()
  const metaStr = meta ? JSON.stringify(meta) : null
  insertGroupMessage.run(id, groupId, fromId, body, timestamp, kind, metaStr)
  const u = findUserById(fromId)
  return {
    id,
    from: { id: fromId, username: u?.username ?? 'unknown' },
    body,
    timestamp,
    kind,
    meta: meta ?? undefined,
  }
}

export function getGroupMessages(groupId: string): GroupMessagesResponse['messages'] {
  const rows = selectGroupMessages.all(groupId) as GroupMessageRow[]
  const cache = new Map<string, string>()
  const name = (id: string) => {
    let n = cache.get(id)
    if (!n) {
      n = findUserById(id)?.username ?? 'unknown'
      cache.set(id, n)
    }
    return n
  }
  return rows.map((r) => ({
    id: r.id,
    from: { id: r.from_id, username: name(r.from_id) },
    body: r.body,
    timestamp: r.timestamp,
    kind: r.kind ?? 'text',
    meta: r.meta ? (JSON.parse(r.meta) as Record<string, unknown>) : undefined,
  }))
}

// ---------- Stats (profiles + leaderboards) ----------

export const STAT_FIELDS = ['messages_sent', 'parties_started', 'watch_seconds'] as const
export type StatField = typeof STAT_FIELDS[number]

const bumpStmts = {} as Record<StatField, import('better-sqlite3').Statement>
const topStmts = {} as Record<StatField, import('better-sqlite3').Statement>
for (const f of STAT_FIELDS) {
  bumpStmts[f] = db.prepare(
    `INSERT INTO user_stats (user_id, ${f}, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET ${f} = ${f} + excluded.${f}, updated_at = excluded.updated_at`
  )
  topStmts[f] = db.prepare(
    `SELECT u.id AS id, u.username AS username, s.${f} AS value
     FROM user_stats s JOIN users u ON u.id = s.user_id
     WHERE u.is_guest = 0 AND s.${f} > 0
     ORDER BY s.${f} DESC LIMIT ?`
  )
}
const selectStats = db.prepare(`SELECT * FROM user_stats WHERE user_id = ?`)

interface StatsRow {
  user_id: string
  messages_sent: number
  parties_started: number
  watch_seconds: number
  updated_at: number
}

export function bumpStat(userId: string, field: StatField, delta: number): void {
  if (delta <= 0) return
  bumpStmts[field].run(userId, delta, Date.now())
}

export function getStats(userId: string): UserStats {
  const row = selectStats.get(userId) as StatsRow | undefined
  return {
    messagesSent: row?.messages_sent ?? 0,
    partiesStarted: row?.parties_started ?? 0,
    watchSeconds: row?.watch_seconds ?? 0,
  }
}

export function getProfile(userId: string): ProfileResponse | null {
  const u = findUserById(userId)
  if (!u) return null
  return { user: toPublicUser(u), stats: getStats(userId) }
}

export function topUsers(field: StatField, limit: number): LeaderboardEntry[] {
  return topStmts[field].all(limit) as LeaderboardEntry[]
}

export default db
