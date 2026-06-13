import { test, expect } from '@playwright/test'
import { createHash, randomBytes } from 'crypto'
import fs from 'fs'

const API = 'http://localhost:3001'
const sha256 = (b: Buffer | Uint8Array) => createHash('sha256').update(b).digest('hex')

async function account(name: string) {
  const res = await fetch(`${API}/api/auth/signup`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: name, email: `${name.toLowerCase()}@gf.test`, password: 'hunter22' }),
  })
  return res.json() as Promise<{ token: string; user: { id: string } }>
}

test('a file shared in a group downloads byte-identically and shows aggregate status', async ({ browser }) => {
  const tag = Date.now().toString(36).toUpperCase()
  const alice = await account(`Fa${tag}`)
  const bob = await account(`Fb${tag}`)

  const ctxA = await browser.newContext()
  const ctxB = await browser.newContext()
  const a = await ctxA.newPage()
  const b = await ctxB.newPage()
  await a.addInitScript((t) => localStorage.setItem('token', t), alice.token)
  await b.addInitScript((t) => localStorage.setItem('token', t), bob.token)

  // Bob opens Messages first so his key is published before the group forms.
  await b.goto('/messages')
  await expect(b.getByPlaceholder('Search people…')).toBeVisible()
  await b.waitForTimeout(1500)

  // Alice creates a group with Bob.
  await a.goto('/messages')
  await a.getByTestId('new-group').click()
  await a.getByTestId('new-group-name').fill(`Files${tag}`)
  await a.getByTestId('new-group-search').fill(`Fb${tag}`)
  await a.getByTestId('new-group-result').first().click()
  await a.getByTestId('new-group-create').click()
  await expect(a.getByTestId('group-title')).toHaveText(`Files${tag}`)

  // Alice shares a file into the group.
  const payload = randomBytes(800_000)
  await a.getByTestId('group-attach-input').setInputFiles({ name: 'group.bin', mimeType: 'application/octet-stream', buffer: payload })
  await expect(a.getByTestId('group-file')).toBeVisible()

  // Bob opens the group, sees the file offer, downloads it.
  await b.getByText(`Files${tag}`).first().click({ timeout: 15_000 })
  await expect(b.getByTestId('group-file-download')).toBeVisible({ timeout: 15_000 })
  const [download] = await Promise.all([
    b.waitForEvent('download'),
    b.getByTestId('group-file-download').click(),
  ])
  expect(download.suggestedFilename()).toBe('group.bin')
  const got = fs.readFileSync((await download.path())!)
  expect(sha256(got)).toBe(sha256(payload))

  // Bob's side shows Saved; Alice's card reflects the download in its status.
  await expect(b.getByTestId('group-file-done')).toBeVisible({ timeout: 15_000 })
  await expect(a.getByTestId('group-file-status')).not.toHaveText(/waiting/i, { timeout: 15_000 })

  await ctxA.close()
  await ctxB.close()
})
