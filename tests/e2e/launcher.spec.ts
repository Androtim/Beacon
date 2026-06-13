import { test, expect } from '@playwright/test'

// The unified launcher: New → watch party / send files, and one code box that
// routes by code shape (6-char → party, 8-char → file share).
test.describe('unified launcher', () => {
  test('New → Watch party starts a room', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('launcher-hero').getByTestId('new-button').click()
    await page.getByTestId('new-party').click()
    await expect(page).toHaveURL(/\/party\/[A-Z0-9]{6}/)
    await expect(page.getByTestId('host-controls')).toBeVisible()
  })

  test('code box routes a 6-char code to a watch party', async ({ page }) => {
    // Unique code — rooms persist server-side, so a fixed code could already
    // exist with a different host.
    const code = ('A' + Date.now().toString(36).toUpperCase()).slice(-6)
    await page.goto('/')
    await page.getByTestId('launcher-hero').getByTestId('launcher-code').fill(code)
    await page.getByTestId('launcher-join').click()
    await expect(page).toHaveURL(new RegExp(`/party/${code}`))
    await expect(page.getByTestId('host-controls')).toBeVisible()
  })

  test('New → Send files creates a share and shows its code', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('launcher-file-input').first().setInputFiles({
      name: 'doc.bin', mimeType: 'application/octet-stream', buffer: Buffer.from('hello world'),
    })
    await expect(page).toHaveURL(/\/files/)
    await expect(page.getByTestId('fileshare-code')).toBeVisible()
  })

  test('the rail launcher appears off Home, not on Home', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/')
    await expect(page.getByTestId('launcher-rail')).toHaveCount(0)
    await page.goto('/messages')
    await expect(page.getByTestId('launcher-rail')).toBeVisible()
  })
})
