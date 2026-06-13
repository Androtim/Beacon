import { test, expect } from '@playwright/test'

test('sidebar collapses/expands and tracks open parties', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })

  // Visit a party so it gets recorded as "open".
  const room = `SB${Date.now().toString(36).toUpperCase()}`
  await page.goto(`/party/${room}`)
  await page.getByTestId('host-controls').waitFor()

  // Back to home; the rail should list the party we just visited.
  await page.goto('/')
  await expect(page.getByRole('link', { name: new RegExp(room) })).toBeVisible()

  // Collapse the rail, then expand it again.
  await page.getByTestId('rail-collapse').click()
  await expect(page.getByTestId('rail-expand')).toBeVisible()
  // Collapsed state persists across reload.
  await page.reload()
  await expect(page.getByTestId('rail-expand')).toBeVisible()
  await page.getByTestId('rail-expand').click()
  await expect(page.getByTestId('rail-collapse')).toBeVisible()
})
