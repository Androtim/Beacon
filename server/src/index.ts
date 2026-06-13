import 'dotenv/config'
import express from 'express'
import { createServer } from 'http'
import cors from 'cors'
import authRoutes from './auth.js'
import { authenticateToken } from './middleware.js'
import { getMessagesBetween, getConversations, searchUsers } from './db.js'
import initSocket from './sockets.js'

if (!process.env.JWT_SECRET) {
  console.error('❌ ERROR: JWT_SECRET is not set. The server cannot start without it.')
  process.exit(1)
}

const app = express()
const server = createServer(app)

app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}))
app.use(express.json())

const PORT = Number(process.env.PORT) || 3001

app.use('/api/auth', authRoutes)

app.get('/api/health', (_req, res) => {
  res.json({ status: 'Server is running!', database: 'SQLite', timestamp: new Date().toISOString() })
})

app.get('/api/ice-servers', authenticateToken, (_req, res) => {
  const iceServers: Array<{ urls: string; username?: string; credential?: string }> = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ]
  if (process.env.TURN_SERVER_URL) {
    iceServers.push({
      urls: process.env.TURN_SERVER_URL,
      username: process.env.TURN_SERVER_USERNAME,
      credential: process.env.TURN_SERVER_PASSWORD,
    })
  }
  res.json({ iceServers })
})

app.get('/api/messages/:userId', authenticateToken, (req, res) => {
  res.json({ messages: getMessagesBetween(req.user!.id, req.params.userId) })
})

app.get('/api/conversations', authenticateToken, (req, res) => {
  res.json({ conversations: getConversations(req.user!.id) })
})

app.get('/api/users/search', authenticateToken, (req, res) => {
  const query = typeof req.query.query === 'string' ? req.query.query.trim() : ''
  if (!query) return res.status(400).json({ message: 'Search query required' })
  res.json({ users: searchUsers(query) })
})

initSocket(server)

server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Beacon Server running on port ${PORT} (SQLite)`)
})
