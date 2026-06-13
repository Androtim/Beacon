import { test, expect } from '@playwright/test'

// Voice chat e2e with Chromium's fake audio devices: two participants join
// voice in a party and each receives the other's live audio track over a
// real WebRTC connection.

test.use({
  launchOptions: {
    args: [
      '--autoplay-policy=no-user-gesture-required',
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
    ],
  },
})

test('two participants connect in voice and receive each other\'s audio', async ({ browser }) => {
  const roomId = `VOICE${Date.now().toString(36).toUpperCase()}`
  const ctxA = await browser.newContext({ permissions: ['microphone'] })
  const ctxB = await browser.newContext({ permissions: ['microphone'] })
  const a = await ctxA.newPage()
  const b = await ctxB.newPage()

  await a.goto(`/party/${roomId}`)
  await expect(a.getByTestId('voice-panel')).toBeVisible()
  await b.goto(`/party/${roomId}`)
  await expect(b.getByTestId('participant-count')).toHaveText('2')

  await a.getByTestId('voice-join').click()
  await expect(a.getByTestId('voice-mute')).toBeVisible()
  await b.getByTestId('voice-join').click()
  await expect(b.getByTestId('voice-mute')).toBeVisible()

  // Both sides must end up with a live remote audio element.
  for (const page of [a, b]) {
    await expect.poll(async () => page.locator('audio').count(), { timeout: 15_000 }).toBeGreaterThan(0)
    await expect.poll(
      () => page.locator('audio').first().evaluate((el: HTMLAudioElement) => {
        const stream = el.srcObject as MediaStream | null
        return stream ? stream.getAudioTracks().filter((t) => t.readyState === 'live').length : 0
      }),
      { timeout: 15_000 },
    ).toBeGreaterThan(0)
    await expect(page.getByTestId('voice-connected-count')).toContainText('1 connected')
  }

  // Mute flips the local track without dropping the connection.
  await a.getByTestId('voice-mute').click()
  await expect(b.getByTestId('voice-connected-count')).toContainText('1 connected')

  // Leaving tears down cleanly on the other side.
  await a.getByTestId('voice-leave').click()
  await expect(b.getByTestId('voice-connected-count')).toHaveCount(0, { timeout: 10_000 })

  await ctxA.close()
  await ctxB.close()
})
