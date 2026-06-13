import { test, expect, type BrowserContext, type Page } from '@playwright/test'

// The sync engine, measured for real: two browsers play an actual 30s video
// and we assert their playback positions stay within tolerance, that
// pause/seek propagate, and that late joiners land mid-playback in sync.

const roomId = `SYNC${Date.now().toString(36).toUpperCase()}`
const VIDEO_URL = '/samples/sync-test.mp4'
// Generous bound for CI noise; the engine's own target is ±0.3s.
const MAX_DRIFT_S = 1.0

async function videoTime(page: Page): Promise<number> {
  return page.locator('video').evaluate((v: HTMLVideoElement) => v.currentTime)
}

async function videoPaused(page: Page): Promise<boolean> {
  return page.locator('video').evaluate((v: HTMLVideoElement) => v.paused)
}

test.describe('video synchronization', () => {
  let ctxA: BrowserContext
  let ctxB: BrowserContext
  let host: Page
  let guest: Page

  test.beforeAll(async ({ browser }) => {
    ctxA = await browser.newContext()
    ctxB = await browser.newContext()
    host = await ctxA.newPage()
    guest = await ctxB.newPage()
    await host.goto(`/party/${roomId}`)
    await expect(host.getByTestId('host-controls')).toBeVisible()
    await guest.goto(`/party/${roomId}`)
    await expect(guest.getByTestId('participant-count')).toHaveText('2')
  })

  test.afterAll(async () => {
    await ctxA.close()
    await ctxB.close()
  })

  test('host sets video; both load it', async () => {
    await host.getByTestId('video-url-input').fill(VIDEO_URL)
    await host.getByTestId('video-url-submit').click()
    await expect(host.locator('video')).toBeAttached()
    await expect(guest.locator('video')).toBeAttached()
  })

  test('host play propagates and drift stays within tolerance', async () => {
    await host.locator('video').evaluate((v: HTMLVideoElement) => v.play())

    // Both must actually be progressing.
    await expect.poll(() => videoPaused(guest), { timeout: 10_000 }).toBe(false)
    await expect.poll(() => videoTime(host)).toBeGreaterThan(0.5)
    await expect.poll(() => videoTime(guest)).toBeGreaterThan(0.5)

    // Let the drift loop settle, then measure repeatedly.
    await host.waitForTimeout(3000)
    for (let i = 0; i < 3; i++) {
      const [tHost, tGuest] = await Promise.all([videoTime(host), videoTime(guest)])
      expect(Math.abs(tHost - tGuest), `drift check #${i + 1}`).toBeLessThan(MAX_DRIFT_S)
      await host.waitForTimeout(1000)
    }
  })

  test('host pause propagates and positions match', async () => {
    await host.locator('video').evaluate((v: HTMLVideoElement) => v.pause())
    await expect.poll(() => videoPaused(guest), { timeout: 10_000 }).toBe(true)
    const [tHost, tGuest] = await Promise.all([videoTime(host), videoTime(guest)])
    expect(Math.abs(tHost - tGuest)).toBeLessThan(MAX_DRIFT_S)
  })

  test('host seek while paused converges everyone', async () => {
    await host.locator('video').evaluate((v: HTMLVideoElement) => { v.currentTime = 15 })
    await expect.poll(() => videoTime(guest), { timeout: 10_000 }).toBeGreaterThan(14)
    expect(await videoPaused(guest)).toBe(true)
  })

  test('late joiner lands mid-playback in sync', async () => {
    await host.locator('video').evaluate((v: HTMLVideoElement) => v.play())
    await expect.poll(() => videoPaused(guest), { timeout: 10_000 }).toBe(false)

    const ctxC = await ctxA.browser()!.newContext()
    const late = await ctxC.newPage()
    await late.goto(`/party/${roomId}`)
    await expect(late.locator('video')).toBeAttached()

    // Joined while playing: should be playing, well past the start, near others.
    await expect.poll(() => videoPaused(late), { timeout: 10_000 }).toBe(false)
    await expect.poll(() => videoTime(late), { timeout: 10_000 }).toBeGreaterThan(14)
    await late.waitForTimeout(2000)
    const [tHost, tLate] = await Promise.all([videoTime(host), videoTime(late)])
    expect(Math.abs(tHost - tLate)).toBeLessThan(MAX_DRIFT_S)
    await ctxC.close()
  })

  test('non-host play attempts are overruled by the room state', async () => {
    await host.locator('video').evaluate((v: HTMLVideoElement) => v.pause())
    await expect.poll(() => videoPaused(guest), { timeout: 10_000 }).toBe(true)

    // Guest tries to play; they are not the host, so the engine pulls them back.
    await guest.locator('video').evaluate((v: HTMLVideoElement) => v.play())
    await expect.poll(() => videoPaused(guest), { timeout: 10_000 }).toBe(true)
    expect(await videoPaused(host)).toBe(true)
  })
})
