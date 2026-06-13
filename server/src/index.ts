import 'dotenv/config'
import express from 'express'
import { createServer } from 'http'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import authRoutes from './auth.js'
import { authenticateToken, requireAccount } from './middleware.js'
import { getMessagesBetween, getConversations, searchUsers } from './db.js'
import initSocket from './sockets.js'

if (!process.env.JWT_SECRET) {
  console.error('❌ ERROR: JWT_SECRET is not set. The server cannot start without it.')
  process.exit(1)
}

const app = express()
const server = createServer(app)

// CORS allowlist. Defaults cover local dev and cloudflare quick tunnels;
// production sets ALLOWED_ORIGINS to its real origins.
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:3000')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

export function allowOrigin(origin: string | undefined): boolean {
  if (!origin) return true // same-origin requests and non-browser clients
  if (allowedOrigins.includes(origin)) return true
  try {
    return new URL(origin).hostname.endsWith('.trycloudflare.com')
  } catch {
    return false
  }
}

app.use(cors({
  origin: (origin, cb) => cb(null, allowOrigin(origin ?? undefined)),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}))
app.use(express.json({ limit: '64kb' }))

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 50, // signup/login/guest attempts per IP
  standardHeaders: true,
  legacyHeaders: false,
})
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 1000,
  standardHeaders: true,
  legacyHeaders: false,
})

const PORT = Number(process.env.PORT) || 3001

app.use('/api/', apiLimiter)
app.use('/api/auth/signup', authLimiter)
app.use('/api/auth/login', authLimiter)
app.use('/api/auth/guest', authLimiter)
app.use('/api/auth', authRoutes)

app.get('/api/health', (_req, res) => {
  res.json({ status: 'Server is running!', database: 'SQLite', timestamp: new Date().toISOString() })
})

type IceServer = { urls: string; username?: string; credential?: string }

// TURN config is resolved once and cached. The client only ever sees the
// resolved server list (never the API key) via this endpoint.
let turnCache: { servers: IceServer[]; at: number } | null = null
const TURN_CACHE_MS = 60 * 60 * 1000 // 1h

async function resolveTurnServers(): Promise<IceServer[]> {
  // 1. Static single-server config wins if present (self-hosted coturn, etc.).
  if (process.env.TURN_SERVER_URL) {
    return [{
      urls: process.env.TURN_SERVER_URL,
      username: process.env.TURN_SERVER_USERNAME,
      credential: process.env.TURN_SERVER_PASSWORD,
    }]
  }
  // 2. Provider REST API (e.g. Metered) — returns the full server list.
  const apiUrl = process.env.TURN_CREDENTIAL_API_URL
  if (!apiUrl) return []
  if (turnCache && Date.now() - turnCache.at < TURN_CACHE_MS) return turnCache.servers
  try {
    const res = await fetch(apiUrl)
    if (!res.ok) throw new Error(`TURN API responded ${res.status}`)
    const servers = await res.json()
    if (Array.isArray(servers)) {
      turnCache = { servers, at: Date.now() }
      return servers
    }
    return turnCache?.servers ?? []
  } catch (err) {
    console.error('Failed to fetch TURN credentials:', err)
    return turnCache?.servers ?? [] // serve stale on transient failure
  }
}

app.get('/api/ice-servers', authenticateToken, async (_req, res) => {
  // Keep the list short and Firefox-friendly: Firefox warns and degrades ICE
  // discovery with 5+ servers. One STUN + the two best TURN transports
  // (preferring :443, which traverses firewalls) is plenty.
  const resolved = await resolveTurnServers()
  const turnOnly = resolved.filter((s) => /^turns?:/.test(s.urls))
  turnOnly.sort((a, b) => Number(b.urls.includes(':443')) - Number(a.urls.includes(':443')))
  const iceServers: IceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    ...turnOnly.slice(0, 2),
  ]
  res.json({ iceServers })
})

// DMs need a persistent identity — guests get 403 with a clear message.
app.get('/api/messages/:userId', authenticateToken, requireAccount, (req, res) => {
  res.json({ messages: getMessagesBetween(req.user!.id, req.params.userId) })
})

app.get('/api/conversations', authenticateToken, requireAccount, (req, res) => {
  res.json({ conversations: getConversations(req.user!.id) })
})

app.get('/api/users/search', authenticateToken, requireAccount, (req, res) => {
  const query = typeof req.query.query === 'string' ? req.query.query.trim() : ''
  if (!query) return res.status(400).json({ message: 'Search query required' })
  res.json({ users: searchUsers(query) })
})

initSocket(server, allowOrigin)

server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Beacon Server running on port ${PORT} (SQLite)`)
})
