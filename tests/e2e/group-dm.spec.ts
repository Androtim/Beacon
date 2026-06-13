import { test, expect } from '@playwright/test'

const API = 'http://localhost:3001'
async function account(name: string) {
  const res = await fetch(`${API}/api/auth/signup`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: name, email: `${name.toLowerCase()}@grp.test`, password: 'hunter22' }),
  })
  return res.json() as Promise<{ token: string; user: { id: string } }>
}

test('a group DM delivers an end-to-end encrypted message to every member', async ({ browser }) => {
  const tag = Date.now().toString(36).toUpperCase()
  const alice = await account(`Ga${tag}`)
  const bob = await account(`Gb${tag}`)

  const ctxA = await browser.newContext()
  const ctxB = await browser.newContext()
  const a = await ctxA.newPage()
  const b = await ctxB.newPage()
  await a.addInitScript((t) => localStorage.setItem('token', t), alice.token)
  await b.addInitScript((t) => localStorage.setItem('token', t), bob.token)

  // Bob opens Messages first so his ECDH public key is published before Alice
  // builds the group (otherwise she can't encrypt to him).
  await b.goto('/messages')
  await expect(b.getByPlaceholder('Search people…')).toBeVisible()
  await b.waitForTimeout(1500)

  // Alice creates a group with Bob.
  await a.goto('/messages')
  await a.getByTestId('new-group').click()
  await expect(a.getByTestId('new-group-modal')).toBeVisible()
  await a.getByTestId('new-group-name').fill(`Crew${tag}`)
  await a.getByTestId('new-group-search').fill(`Gb${tag}`)
  await a.getByTestId('new-group-result').first().click()
  await a.getByTestId('new-group-create').click()
  await expect(a.getByTestId('group-title')).toHaveText(`Crew${tag}`)

  // Alice sends a message into the group.
  await a.getByTestId('group-input').fill('hello crew')
  await a.getByTestId('group-send').click()
  await expect(a.getByTestId('group-message').filter({ hasText: 'hello crew' })).toBeVisible()

  // Bob sees the group appear, opens it, and reads the decrypted message.
  await b.getByText(`Crew${tag}`).first().click({ timeout: 15_000 })
  await expect(b.getByTestId('group-message').filter({ hasText: 'hello crew' })).toBeVisible({ timeout: 15_000 })

  // Bob replies; Alice receives his decrypted message live.
  await b.getByTestId('group-input').fill('hey alice')
  await b.getByTestId('group-send').click()
  await expect(a.getByTestId('group-message').filter({ hasText: 'hey alice' })).toBeVisible({ timeout: 15_000 })

  await ctxA.close()
  await ctxB.close()
})

test('the group message body on the wire is ciphertext, not plaintext', async ({ browser }) => {
  const tag = Date.now().toString(36).toUpperCase()
  const alice = await account(`Ca${tag}`)
  const bob = await account(`Cb${tag}`)

  const ctxA = await browser.newContext()
  const ctxB = await browser.newContext()
  const a = await ctxA.newPage()
  const b = await ctxB.newPage()
  await a.addInitScript((t) => localStorage.setItem('token', t), alice.token)
  await b.addInitScript((t) => localStorage.setItem('token', t), bob.token)

  await b.goto('/messages')
  await expect(b.getByPlaceholder('Search people…')).toBeVisible()
  await b.waitForTimeout(1500)

  await a.goto('/messages')
  await a.getByTestId('new-group').click()
  await a.getByTestId('new-group-search').fill(`Cb${tag}`)
  await a.getByTestId('new-group-result').first().click()
  await a.getByTestId('new-group-create').click()
  await expect(a.getByTestId('group-title')).toBeVisible()

  const secret = `topsecret-${tag}`
  await a.getByTestId('group-input').fill(secret)
  await a.getByTestId('group-send').click()
  await expect(a.getByTestId('group-message').filter({ hasText: secret })).toBeVisible()

  // The server only ever stored an envelope map — the plaintext must not appear
  // in what it returns. Fetch the group's messages as Bob and check the body.
  const groupsRes = await fetch(`${API}/api/groups`, { headers: { Authorization: `Bearer ${bob.token}` } })
  const { groups } = await groupsRes.json()
  expect(groups.length).toBeGreaterThan(0)
  const msgsRes = await fetch(`${API}/api/groups/${groups[0].id}/messages`, { headers: { Authorization: `Bearer ${bob.token}` } })
  const { messages } = await msgsRes.json()
  const raw = JSON.stringify(messages)
  expect(raw).not.toContain(secret)

  await ctxA.close()
  await ctxB.close()
})
