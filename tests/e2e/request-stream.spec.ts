import { test, expect, type BrowserContext, type Page } from '@playwright/test'

// A non-host suggests a video; the host approves; it plays for everyone.
const roomId = `REQ${Date.now().toString(36).toUpperCase()}`

test.describe('request to stream (owner authorization)', () => {
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

  test.afterAll(async () => { await ctxA.close(); await ctxB.close() })

  test('guest suggestion needs host approval before it plays', async () => {
    // Guest suggests a video.
    await guest.getByTestId('suggest-input').fill('/samples/sync-test.mp4')
    await guest.getByTestId('suggest-submit').click()
    await expect(guest.getByTestId('suggest-pending')).toBeVisible()

    // Nothing is playing yet on the host side (no video element).
    await expect(host.locator('video')).toHaveCount(0)

    // Host sees the request and approves.
    await expect(host.getByTestId('stream-requests')).toBeVisible()
    await host.getByTestId('approve-request').click()

    // Now both have the video.
    await expect(host.locator('video')).toBeAttached()
    await expect(guest.locator('video')).toBeAttached()
  })

  test('host can deny a suggestion', async () => {
    await guest.getByTestId('suggest-input').fill('/samples/sync-test.mp4')
    await guest.getByTestId('suggest-submit').click()
    await expect(host.getByTestId('stream-requests')).toBeVisible()
    await host.getByText('Deny').click()
    await expect(guest.getByTestId('suggest-denied')).toBeVisible()
  })
})
