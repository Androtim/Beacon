import { test, expect } from '@playwright/test'

// Guests need an easy, obvious way to sign in / create an account.
test('guests get a sign-in affordance in the rail and on the DM gate', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/')
  // Sidebar sign-in (guest by default).
  await expect(page.getByTestId('rail-signin')).toBeVisible()

  // DM gate offers both Log in and Create account.
  await page.goto('/messages')
  await expect(page.getByRole('link', { name: 'Log in' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Create an account' })).toBeVisible()
})
