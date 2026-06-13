import { test, expect } from '@playwright/test'

// Regression: when a video ends, the room must pause at the end and NOT loop
// the final frame, and seeking back must stick (the old bug yanked you to the
// end repeatedly).
test('video end pauses cleanly and you can seek back', async ({ page }) => {
  const roomId = `END${Date.now().toString(36).toUpperCase()}`
  await page.goto(`/party/${roomId}`)
  await page.getByTestId('host-controls').waitFor()
  await page.getByTestId('video-url-input').fill('/samples/sync-test.mp4')
  await page.getByTestId('video-url-submit').click()

  const video = page.locator('video')
  await expect(video).toBeAttached()
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.duration > 0)).toBe(true)

  // Jump near the end and play it out.
  await video.evaluate((v: HTMLVideoElement) => { v.currentTime = v.duration - 0.4; v.play() })
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.ended || v.paused), { timeout: 10_000 }).toBe(true)

  // It must settle at the end, not loop.
  await page.waitForTimeout(1500)
  const atEnd = await video.evaluate((v: HTMLVideoElement) => ({ t: v.currentTime, dur: v.duration, paused: v.paused }))
  expect(atEnd.paused).toBe(true)
  expect(atEnd.t).toBeGreaterThan(atEnd.dur - 1)

  // Seek back to the start — it must STAY there (the loop no longer drags it to the end).
  await video.evaluate((v: HTMLVideoElement) => { v.currentTime = 4 })
  await page.waitForTimeout(1500)
  const after = await video.evaluate((v: HTMLVideoElement) => v.currentTime)
  expect(after).toBeLessThan(10)
})
