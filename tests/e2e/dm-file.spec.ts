import { test, expect } from '@playwright/test'
import { createHash, randomBytes } from 'crypto'
import fs from 'fs'

const API = 'http://localhost:3001'
const sha256 = (b: Buffer | Uint8Array) => createHash('sha256').update(b).digest('hex')

async function account(name: string) {
  const res = await fetch(`${API}/api/auth/signup`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: name, email: `${name.toLowerCase()}@dmf.test`, password: 'hunter22' }),
  })
  return res.json() as Promise<{ token: string; user: { id: string } }>
}

test('a file can be sent and received inside a DM (P2P)', async ({ browser }) => {
  const tag = Date.now().toString(36).toUpperCase()
  const alice = await account(`Al${tag}`)
  const bob = await account(`Bo${tag}`)

  const ctxA = await browser.newContext()
  const ctxB = await browser.newContext()
  const a = await ctxA.newPage()
  const b = await ctxB.newPage()
  await a.addInitScript((t) => localStorage.setItem('token', t), alice.token)
  await b.addInitScript((t) => localStorage.setItem('token', t), bob.token)

  // Both open Messages (publishes keys, connects sockets).
  await b.goto('/messages')
  await expect(b.getByPlaceholder('Search people…')).toBeVisible()
  await a.goto('/messages')
  await a.getByPlaceholder('Search people…').fill(`Bo${tag}`)
  await a.getByText(`Bo${tag}`).first().click()

  // Alice attaches a file.
  const payload = randomBytes(800_000)
  await a.getByTestId('dm-attach-input').setInputFiles({ name: 'secret.bin', mimeType: 'application/octet-stream', buffer: payload })
  await expect(a.getByTestId('dm-file')).toBeVisible()

  // Bob opens the conversation and sees the incoming file, accepts it.
  await expect(b.getByText(`Al${tag}`).first()).toBeVisible({ timeout: 15_000 })
  await b.getByText(`Al${tag}`).first().click()
  await expect(b.getByTestId('dm-file-accept')).toBeVisible({ timeout: 15_000 })
  const [download] = await Promise.all([
    b.waitForEvent('download'),
    b.getByTestId('dm-file-accept').click(),
  ])
  expect(download.suggestedFilename()).toBe('secret.bin')
  const got = fs.readFileSync((await download.path())!)
  expect(sha256(got)).toBe(sha256(payload))

  // Both sides reflect completion.
  await expect(b.getByTestId('dm-file-done')).toBeVisible({ timeout: 15_000 })
  await ctxA.close()
  await ctxB.close()
})
