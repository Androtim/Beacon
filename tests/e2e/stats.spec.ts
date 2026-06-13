import { test, expect } from '@playwright/test'

const API = 'http://localhost:3001'
async function account(name: string) {
  const res = await fetch(`${API}/api/auth/signup`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: name, email: `${name.toLowerCase()}@stats.test`, password: 'hunter22' }),
  })
  return res.json() as Promise<{ token: string; user: { id: string } }>
}

test('activity accrues into stats, a profile, and the leaderboard', async ({ browser }) => {
  const tag = Date.now().toString(36).toUpperCase()
  const alice = await account(`Sa${tag}`)
  const bob = await account(`Sb${tag}`)

  const ctx = await browser.newContext()
  const a = await ctx.newPage()
  await a.addInitScript((t) => localStorage.setItem('token', t), alice.token)

  // Alice DMs Bob a couple of times → messages_sent.
  await a.goto('/messages')
  await a.getByPlaceholder('Search people…').fill(`Sb${tag}`)
  await a.getByText(`Sb${tag}`).first().click()
  for (const text of ['hi bob', 'you around?']) {
    await a.getByPlaceholder('Message…').fill(text)
    await a.getByPlaceholder('Message…').press('Enter')
  }

  // Alice starts a watch party → parties_started.
  await a.goto(`/party/PTY${tag}`)
  await expect(a).toHaveURL(new RegExp(`/party/PTY${tag}`))

  // Stats land server-side (events are async) — poll the profile API.
  await expect.poll(async () => {
    const res = await fetch(`${API}/api/users/${alice.user.id}/profile`, { headers: { Authorization: `Bearer ${alice.token}` } })
    const { stats } = await res.json()
    return stats.messagesSent
  }, { timeout: 10_000 }).toBeGreaterThanOrEqual(2)

  await expect.poll(async () => {
    const res = await fetch(`${API}/api/users/${alice.user.id}/profile`, { headers: { Authorization: `Bearer ${alice.token}` } })
    const { stats } = await res.json()
    return stats.partiesStarted
  }, { timeout: 10_000 }).toBeGreaterThanOrEqual(1)

  // Profile page renders the identity, stats and an earned badge.
  await a.goto(`/u/${alice.user.id}`)
  await expect(a.getByTestId('profile-username')).toContainText(`Sa${tag}`)
  await expect(a.getByTestId('profile-badge').filter({ hasText: 'First Light' })).toBeVisible()
  await expect(a.getByTestId('profile-badge').filter({ hasText: 'Host' })).toBeVisible()

  // Leaderboard lists Alice among the most talkative.
  await a.goto('/leaderboard')
  await expect(a.getByRole('link', { name: new RegExp(`Sa${tag}`) }).first()).toBeVisible({ timeout: 10_000 })

  await ctx.close()
})
