import { test, expect } from '@playwright/test'

// Cinema mode must NOT remount the player — entering/exiting should keep the
// same <video> playing (the bug: it used to unmount and kill the stream).
test('cinema toggle keeps the video playing (no remount)', async ({ page }) => {
  const roomId = `CIN${Date.now().toString(36).toUpperCase()}`
  await page.goto(`/party/${roomId}`)
  await page.getByTestId('host-controls').waitFor()
  await page.getByTestId('video-url-input').fill('/samples/sync-test.mp4')
  await page.getByTestId('video-url-submit').click()

  const video = page.locator('video')
  await expect(video).toBeAttached()
  await video.evaluate((v: HTMLVideoElement) => v.play())
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime)).toBeGreaterThan(0.5)

  // Enter cinema.
  await page.getByTestId('cinema-toggle').click()
  await expect(page.getByTestId('cinema-stage')).toBeVisible()
  // Same element, still playing and advancing.
  await expect(video).toBeAttached()
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => !v.paused)).toBe(true)
  const tIn = await video.evaluate((v: HTMLVideoElement) => v.currentTime)
  await page.waitForTimeout(800)
  expect(await video.evaluate((v: HTMLVideoElement) => v.currentTime)).toBeGreaterThan(tIn)

  // Exit cinema — still playing.
  await page.getByTestId('cinema-toggle').click()
  await expect(page.getByTestId('video-pane')).toBeVisible()
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => !v.paused)).toBe(true)
})
