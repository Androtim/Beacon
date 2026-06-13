import { test, expect } from '@playwright/test'
import { spawn, type ChildProcess } from 'child_process'
import { io, type Socket } from 'socket.io-client'
import path from 'path'
import fs from 'fs'
import os from 'os'

// Proves the headline Phase 1 claim: a watch party room (host + video state)
// survives a full server restart, and a reconnecting client gets it all back.
// Runs its own server instance on a throwaway port and database.

const PORT = 3210
const BASE = `http://localhost:${PORT}`
const ROOT = path.resolve(__dirname, '..', '..')
const SERVER_DIR = path.join(ROOT, 'server')
const TSX = path.join(SERVER_DIR, 'node_modules', 'tsx', 'dist', 'cli.mjs')

let serverProc: ChildProcess | null = null
let dbPath: string

function startServer(): Promise<void> {
  serverProc = spawn(process.execPath, [TSX, 'src/index.ts'], {
    cwd: SERVER_DIR,
    env: {
      ...process.env,
      PORT: String(PORT),
      JWT_SECRET: 'persistence-test-secret',
      DB_PATH: dbPath,
    },
    stdio: 'ignore',
  })
  return waitForHealth()
}

async function waitForHealth(): Promise<void> {
  for (let i = 0; i < 100; i++) {
    try {
      const res = await fetch(`${BASE}/api/health`)
      if (res.ok) return
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 200))
  }
  throw new Error('Server did not become healthy in time')
}

function stopServer(): Promise<void> {
  return new Promise((resolve) => {
    if (!serverProc) return resolve()
    serverProc.once('exit', () => resolve())
    serverProc.kill()
    serverProc = null
  })
}

function connect(token: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const s = io(BASE, { auth: { token }, transports: ['websocket'] })
    s.once('connect', () => resolve(s))
    s.once('connect_error', (e) => reject(e))
  })
}

function joinRoom(s: Socket, roomId: string): Promise<any> {
  return new Promise((resolve) => {
    s.once('room-joined', resolve)
    s.emit('join-room', { roomId })
  })
}

test.describe('room persistence across server restarts', () => {
  test.beforeAll(async () => {
    dbPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'beacon-test-')), 'test.db')
    await startServer()
  })

  test.afterAll(async () => {
    await stopServer()
  })

  test('host and video state survive a full restart', async () => {
    // Guest identity + room with a video URL set.
    const guestRes = await fetch(`${BASE}/api/auth/guest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    })
    expect(guestRes.status).toBe(201)
    const { token } = await guestRes.json()

    const roomId = 'PERSIST1'
    const socket = await connect(token)
    const joined = await joinRoom(socket, roomId)
    expect(joined.isHost).toBe(true)

    const urlSet = new Promise((resolve) => socket.once('video-url-set', resolve))
    socket.emit('video-url-set', { roomId, url: 'https://example.com/movie.mp4' })
    expect(await urlSet).toEqual({ url: 'https://example.com/movie.mp4' })
    socket.disconnect()

    // Full restart: in-memory state is gone, SQLite is not.
    await stopServer()
    await startServer()

    const socket2 = await connect(token)
    const rejoined = await joinRoom(socket2, roomId)
    socket2.disconnect()

    expect(rejoined.isHost).toBe(true) // host role persisted
    expect(rejoined.videoState.url).toBe('https://example.com/movie.mp4') // video state persisted
  })

  test('user accounts survive a restart (token still valid)', async () => {
    const res = await fetch(`${BASE}/api/auth/guest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    })
    const { token, user } = await res.json()

    await stopServer()
    await startServer()

    const me = await fetch(`${BASE}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
    expect(me.status).toBe(200)
    expect((await me.json()).user.id).toBe(user.id)
  })
})
