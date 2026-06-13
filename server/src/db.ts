import Database from 'better-sqlite3'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import type { PublicUser, ConversationSummary, MessagesResponse } from '../../shared/protocol.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.join(__dirname, '..', 'data')
fs.mkdirSync(dataDir, { recursive: true })

const db = new Database(path.join(dataDir, 'beacon.db'))
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
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
`)

interface UserRow {
  id: string
  username: string
  email: string
  password_hash: string
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
    email: row.email,
    isOnline: !!row.is_online,
    lastSeen: row.last_seen,
    createdAt: row.created_at,
  }
}

const insertUser = db.prepare(
  `INSERT INTO users (id, username, email, password_hash, is_online, last_seen, created_at)
   VALUES (?, ?, ?, ?, 0, ?, ?)`
)
const selectUserById = db.prepare(`SELECT * FROM users WHERE id = ?`)
const selectUserByEmail = db.prepare(`SELECT * FROM users WHERE email = ?`)
const selectUserByUsername = db.prepare(`SELECT * FROM users WHERE username = ?`)
const updateOnline = db.prepare(`UPDATE users SET is_online = ?, last_seen = ? WHERE id = ?`)
const searchUsersStmt = db.prepare(
  `SELECT * FROM users WHERE username LIKE ? ESCAPE '\\' ORDER BY username LIMIT 20`
)

export function createUser(username: string, email: string, password: string): UserRow {
  const now = Date.now()
  const row: UserRow = {
    id: randomUUID(),
    username: username.trim(),
    email: email.trim().toLowerCase(),
    password_hash: bcrypt.hashSync(password, 12),
    is_online: 0,
    last_seen: now,
    created_at: now,
  }
  insertUser.run(row.id, row.username, row.email, row.password_hash, now, now)
  return row
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
