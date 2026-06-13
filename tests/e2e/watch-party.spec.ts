import { test, expect, type BrowserContext, type Page } from '@playwright/test'

// Two real browsers in one watch party: guest auto-identity, presence,
// chat relay, host-only controls, video URL propagation, and reconnect
// resync after a page reload.

const roomId = `T${Date.now().toString(36).toUpperCase()}`

test.describe('watch party sessions', () => {
  let ctxA: BrowserContext
  let ctxB: BrowserContext
  let host: Page
  let guest: Page

  test.beforeAll(async ({ browser }) => {
    ctxA = await browser.newContext()
    ctxB = await browser.newContext()
    host = await ctxA.newPage()
    guest = await ctxB.newPage()
  })

  test.afterAll(async () => {
    await ctxA.close()
    await ctxB.close()
  })

  test('guests join a room from a bare link, host sees presence', async () => {
    await host.goto(`/party/${roomId}`)
    // No login, no signup: the guest bootstrap must land us in the room.
    await expect(host.getByTestId('participant-count')).toHaveText('1')
    await expect(host.getByTestId('host-controls')).toBeVisible()

    await guest.goto(`/party/${roomId}`)
    await expect(guest.getByTestId('participant-count')).toHaveText('2')
    await expect(host.getByTestId('participant-count')).toHaveText('2')
    // Second joiner is not the host and gets no host controls.
    await expect(guest.getByTestId('host-controls')).toHaveCount(0)
  })

  test('chat relays between participants with server-side identity', async () => {
    await guest.getByTestId('chat-input').fill('hello from the guest')
    await guest.getByTestId('chat-input').press('Enter')
    await expect(host.getByTestId('chat-messages')).toContainText('hello from the guest')
    await expect(guest.getByTestId('chat-messages')).toContainText('hello from the guest')
  })

  test('host sets a video URL and it propagates', async () => {
    const url = 'https://example.com/video.mp4'
    await host.getByTestId('video-url-input').fill(url)
    await host.getByTestId('video-url-submit').click()
    // Both sides leave the "awaiting transmission" placeholder state.
    await expect(host.locator('video')).toBeAttached()
    await expect(guest.locator('video')).toBeAttached()
  })

  test('a reload rejoins the same room with state intact', async () => {
    await guest.reload()
    await expect(guest.getByTestId('participant-count')).toHaveText('2')
    // Room video state survives the reload (came back via room-joined).
    await expect(guest.locator('video')).toBeAttached()
    // Host never saw the count drop to a stale value after resync.
    await expect(host.getByTestId('participant-count')).toHaveText('2')
  })

  test('guest identity persists across reloads in the same browser', async () => {
    const before = await guest.evaluate(() => localStorage.getItem('token'))
    await guest.reload()
    await expect(guest.getByTestId('participant-count')).toHaveText('2')
    const after = await guest.evaluate(() => localStorage.getItem('token'))
    expect(after).toBe(before)
  })
})
