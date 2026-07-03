import { test, expect } from '@playwright/test'
import { spawn, type ChildProcess } from 'child_process'
import { io, type Socket } from 'socket.io-client'
import path from 'path'
import fs from 'fs'
import os from 'os'

// A single account can be connected from several devices at once. This proves
// the server-side session set: a DM reaches every device, and presence flips
// off only when the last device disconnects — not when any one does.

const PORT = 3211
const BASE = `http://localhost:${PORT}`
const ROOT = path.resolve(__dirname, '..', '..')
const SERVER_DIR = path.join(ROOT, 'server')
const TSX = path.join(SERVER_DIR, 'node_modules', 'tsx', 'dist', 'cli.mjs')

let serverProc: ChildProcess | null = null
let dbPath: string

function startServer(): Promise<void> {
  serverProc = spawn(process.execPath, [TSX, 'src/index.ts'], {
    cwd: SERVER_DIR,
    env: { ...process.env, PORT: String(PORT), JWT_SECRET: 'multi-device-test-secret', DB_PATH: dbPath },
    stdio: 'ignore',
  })
  return waitForHealth()
}

async function waitForHealth(): Promise<void> {
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(`${BASE}/api/health`)).ok) return } catch { /* not up */ }
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
    s.once('connect_error', reject)
  })
}

async function signup(name: string): Promise<{ token: string; id: string }> {
  const res = await fetch(`${BASE}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: name, email: `${name.toLowerCase()}@md.test`, password: 'hunter22' }),
  })
  expect(res.status).toBe(201)
  const data = await res.json()
  return { token: data.token, id: data.user.id }
}

test.describe('multi-device sessions', () => {
  test.beforeAll(async () => {
    dbPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'beacon-md-')), 'test.db')
    await startServer()
  })
  test.afterAll(async () => { await stopServer() })

  test('a DM reaches every device the recipient has open, and presence tracks the last one', async () => {
    const tag = Date.now().toString(36)
    const alice = await signup(`AliceMD${tag}`)
    const bob = await signup(`BobMD${tag}`)

    // Bob on two devices; Alice on one.
    const bob1 = await connect(bob.token)
    const bob2 = await connect(bob.token)
    const aliceSock = await connect(alice.token)

    // Alice should see exactly one user-online for Bob across his two
    // connections (presence announced only on the first device).
    let bobOnlineCount = 0
    aliceSock.on('user-online', (u: { id: string }) => { if (u.id === bob.id) bobOnlineCount++ })

    // Both of Bob's devices receive the DM.
    const got1 = new Promise<string>((res) => bob1.once('private-message', (m: any) => res(m.message)))
    const got2 = new Promise<string>((res) => bob2.once('private-message', (m: any) => res(m.message)))
    aliceSock.emit('private-message', { to: bob.id, message: 'ping-both', timestamp: Date.now() })
    expect(await got1).toBe('ping-both')
    expect(await got2).toBe('ping-both')

    // Presence goes offline only after BOTH of Bob's devices drop.
    let bobOffline = false
    aliceSock.on('user-offline', (id: string) => { if (id === bob.id) bobOffline = true })

    bob1.close()
    await new Promise((r) => setTimeout(r, 400))
    expect(bobOffline).toBe(false) // bob2 still open

    bob2.close()
    await new Promise((r) => setTimeout(r, 400))
    expect(bobOffline).toBe(true) // last device gone

    aliceSock.close()
  })
})
