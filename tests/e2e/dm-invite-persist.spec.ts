import { test, expect } from '@playwright/test'

const API = 'http://localhost:3001'
async function account(name: string) {
  const res = await fetch(`${API}/api/auth/signup`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: name, email: `${name.toLowerCase()}@dmpersist.test`, password: 'hunter22' }),
  })
  return res.json() as Promise<{ token: string; user: { id: string } }>
}

// The reported bug: a recipient who is NOT in the chat when an invite/offer is
// sent never saw it. Invites are now persisted as messages, so they show up
// whenever the recipient next opens the conversation.
test('a watch-party invite is visible to a recipient who opens the chat later', async ({ browser }) => {
  const tag = Date.now().toString(36).toUpperCase()
  const alice = await account(`Ia${tag}`)
  const bob = await account(`Ib${tag}`)

  // Bob signs in but stays on Home — he never opens Messages while Alice sends.
  const ctxB = await browser.newContext()
  const b = await ctxB.newPage()
  await b.addInitScript((t) => localStorage.setItem('token', t), bob.token)
  await b.goto('/')
  await expect(b).toHaveURL(/\/$/)

  // Alice opens the DM with Bob and starts a watch party.
  const ctxA = await browser.newContext()
  const a = await ctxA.newPage()
  await a.addInitScript((t) => localStorage.setItem('token', t), alice.token)
  await a.goto('/messages')
  await a.getByPlaceholder('Search people…').fill(`Ib${tag}`)
  await a.getByText(`Ib${tag}`).first().click()
  await a.getByTestId('dm-start-party').click()
  await expect(a).toHaveURL(/\/party\/[A-Z0-9]{6}/)
  const roomId = a.url().split('/party/')[1]

  // Only NOW does Bob open Messages. The conversation and Join card are there.
  await b.goto('/messages')
  await expect(b.getByText(`Ia${tag}`).first()).toBeVisible({ timeout: 15_000 })
  await b.getByText(`Ia${tag}`).first().click()
  await expect(b.getByTestId('dm-party-join')).toBeVisible({ timeout: 15_000 })
  await b.getByTestId('dm-party-join').click()
  await expect(b).toHaveURL(new RegExp(`/party/${roomId}`))

  await ctxA.close()
  await ctxB.close()
})

test('a file offer is visible to a recipient who opens the chat later', async ({ browser }) => {
  const tag = Date.now().toString(36).toUpperCase()
  const alice = await account(`Fa${tag}`)
  const bob = await account(`Fb${tag}`)

  // Bob is signed in but sitting on Home, not Messages.
  const ctxB = await browser.newContext()
  const b = await ctxB.newPage()
  await b.addInitScript((t) => localStorage.setItem('token', t), bob.token)
  await b.goto('/')

  // Alice opens the DM and offers a file.
  const ctxA = await browser.newContext()
  const a = await ctxA.newPage()
  await a.addInitScript((t) => localStorage.setItem('token', t), alice.token)
  await a.goto('/messages')
  await a.getByPlaceholder('Search people…').fill(`Fb${tag}`)
  await a.getByText(`Fb${tag}`).first().click()
  await a.getByTestId('dm-attach-input').setInputFiles({
    name: 'late-hello.txt', mimeType: 'text/plain', buffer: Buffer.from('hello from the past'),
  })
  await expect(a.getByTestId('dm-file')).toBeVisible({ timeout: 15_000 })

  // Bob opens Messages afterwards and finds the offer waiting in history.
  await b.goto('/messages')
  await expect(b.getByText(`Fa${tag}`).first()).toBeVisible({ timeout: 15_000 })
  await b.getByText(`Fa${tag}`).first().click()
  const card = b.getByTestId('dm-file')
  await expect(card).toBeVisible({ timeout: 15_000 })
  await expect(card.getByText('late-hello.txt')).toBeVisible()
  await expect(b.getByTestId('dm-file-accept')).toBeVisible()

  await ctxA.close()
  await ctxB.close()
})
