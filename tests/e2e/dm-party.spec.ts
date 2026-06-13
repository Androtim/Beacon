import { test, expect } from '@playwright/test'

const API = 'http://localhost:3001'
async function account(name: string) {
  const res = await fetch(`${API}/api/auth/signup`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: name, email: `${name.toLowerCase()}@dmp.test`, password: 'hunter22' }),
  })
  return res.json() as Promise<{ token: string; user: { id: string } }>
}

test('starting a watch party from a DM sends a Join card the peer can use', async ({ browser }) => {
  const tag = Date.now().toString(36).toUpperCase()
  const alice = await account(`Pa${tag}`)
  const bob = await account(`Pb${tag}`)

  const ctxA = await browser.newContext()
  const ctxB = await browser.newContext()
  const a = await ctxA.newPage()
  const b = await ctxB.newPage()
  await a.addInitScript((t) => localStorage.setItem('token', t), alice.token)
  await b.addInitScript((t) => localStorage.setItem('token', t), bob.token)

  await b.goto('/messages')
  await expect(b.getByPlaceholder('Search people…')).toBeVisible()
  await a.goto('/messages')
  await a.getByPlaceholder('Search people…').fill(`Pb${tag}`)
  await a.getByText(`Pb${tag}`).first().click()

  // Alice starts a watch party from the DM → she lands in the party.
  await a.getByTestId('dm-start-party').click()
  await expect(a).toHaveURL(/\/party\/[A-Z0-9]{6}/)
  const roomId = a.url().split('/party/')[1]

  // Bob sees the invite card and joins the same room.
  await expect(b.getByText(`Pa${tag}`).first()).toBeVisible({ timeout: 15_000 })
  await b.getByText(`Pa${tag}`).first().click()
  await expect(b.getByTestId('dm-party-join')).toBeVisible({ timeout: 15_000 })
  await b.getByTestId('dm-party-join').click()
  await expect(b).toHaveURL(new RegExp(`/party/${roomId}`))
  // Both are now in the room together.
  await expect(a.getByTestId('participant-count')).toHaveText('2', { timeout: 15_000 })

  await ctxA.close()
  await ctxB.close()
})
