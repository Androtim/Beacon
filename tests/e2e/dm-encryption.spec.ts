import { test, expect } from '@playwright/test'

// E2E-encrypted DMs: two real accounts exchange a message through the UI;
// both read plaintext, while the API (what the server stores and could ever
// hand over) shows only an AES-GCM envelope.

const API = 'http://localhost:3001'

async function createAccount(name: string) {
  const res = await fetch(`${API}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: name, email: `${name.toLowerCase()}@e2e.test`, password: 'hunter22' }),
  })
  expect(res.status).toBe(201)
  return res.json() as Promise<{ token: string; user: { id: string } }>
}

test('DMs are end-to-end encrypted: users read plaintext, server stores ciphertext', async ({ browser }) => {
  const tag = Date.now().toString(36).toUpperCase()
  const alice = await createAccount(`Alice${tag}`)
  const bob = await createAccount(`Bob${tag}`)

  const ctxA = await browser.newContext()
  const ctxB = await browser.newContext()
  const a = await ctxA.newPage()
  const b = await ctxB.newPage()

  // Log both in by token, then open Messages so each device generates and
  // publishes its encryption key.
  await a.addInitScript((t) => localStorage.setItem('token', t), alice.token)
  await b.addInitScript((t) => localStorage.setItem('token', t), bob.token)
  await b.goto('/messages')
  await expect(b.getByPlaceholder('Search people…')).toBeVisible()
  // Bob's key must be published before Alice looks him up. Generous timeout:
  // this spec runs in parallel with the other heavy P2P/voice specs.
  await expect.poll(async () => {
    const res = await fetch(`${API}/api/users/search?query=Bob${tag}`, {
      headers: { Authorization: `Bearer ${alice.token}` },
    })
    const data = await res.json()
    return data.users?.[0]?.publicKey ? 'published' : 'pending'
  }, { timeout: 30_000 }).toBe('published')

  await a.goto('/messages')
  await a.getByPlaceholder('Search people…').fill(`Bob${tag}`)
  await a.getByText(`Bob${tag}`).first().click()

  const secret = `the cave entrance is behind the waterfall ${tag}`
  await a.getByPlaceholder('Message…').fill(secret)
  await a.getByPlaceholder('Message…').press('Enter')
  await expect(a.getByText(secret)).toBeVisible({ timeout: 15_000 })

  // Bob reads the plaintext through his client...
  await expect(b.getByText(`Alice${tag}`).first()).toBeVisible({ timeout: 15_000 })
  await b.getByText(`Alice${tag}`).first().click()
  await expect(b.getByText(secret)).toBeVisible({ timeout: 15_000 })

  // ...but the server-side record is an opaque envelope: no plaintext.
  const raw = await fetch(`${API}/api/messages/${alice.user.id}`, {
    headers: { Authorization: `Bearer ${bob.token}` },
  }).then((r) => r.json())
  expect(raw.messages.length).toBeGreaterThan(0)
  const stored = raw.messages[raw.messages.length - 1].message
  expect(stored).not.toContain('waterfall')
  const envelope = JSON.parse(stored)
  expect(envelope.v).toBe(1)
  expect(typeof envelope.iv).toBe('string')
  expect(typeof envelope.ct).toBe('string')

  await ctxA.close()
  await ctxB.close()
})
