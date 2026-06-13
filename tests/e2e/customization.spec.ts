import { test, expect } from '@playwright/test'

// The 3-mode customization engine: preset switch persists, accent changes a
// CSS token live, motion toggle flips the data attribute, custom CSS is
// validated, and the reset escape hatch restores defaults.

async function accentVar(page: any) {
  return page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim())
}

test('switching preset changes tokens and persists across reload', async ({ page }) => {
  await page.goto('/settings')
  await page.getByTestId('preset-midnight').click()
  const midnight = await accentVar(page)
  expect(midnight).toBe('139 110 209') // midnight accent

  await page.reload()
  await page.getByTestId('appearance-mode-easy').waitFor()
  expect(await accentVar(page)).toBe('139 110 209') // survived reload
})

test('accent picker updates the live token', async ({ page }) => {
  await page.goto('/settings')
  await page.getByTestId('preset-crystal').click()
  // Set accent via the color input (fires input event).
  await page.getByTestId('accent-picker').evaluate((el: HTMLInputElement) => {
    // Use the native value setter so React's change tracker registers it.
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!
    setter.call(el, '#00ff00')
    el.dispatchEvent(new Event('input', { bubbles: true }))
  })
  expect(await accentVar(page)).toBe('0 255 0')
})

test('motion toggle flips the document attribute', async ({ page }) => {
  await page.goto('/settings')
  await page.getByTestId('motion-toggle').uncheck()
  expect(await page.evaluate(() => document.documentElement.dataset.motion)).toBe('off')
})

test('tinkerer custom CSS is validated before applying', async ({ page }) => {
  await page.goto('/settings')
  await page.getByTestId('appearance-mode-tinkerer').click()
  await page.getByTestId('custom-css').fill('.glass-card { color: red ') // unbalanced brace
  await page.getByTestId('apply-css').click()
  await expect(page.getByTestId('css-error')).toBeVisible()
})

test('reset escape hatch restores the default theme', async ({ page }) => {
  await page.goto('/settings')
  await page.getByTestId('preset-ember').click()
  expect(await accentVar(page)).not.toBe('242 126 114')
  // The shadow-DOM reset button lives at the document level.
  await page.evaluate(() => {
    const host = [...document.body.children].find((el) => el.shadowRoot?.querySelector('button'))
    host?.shadowRoot?.querySelector('button')?.click()
  })
  await expect.poll(() => accentVar(page)).toBe('242 126 114') // back to Crystal
})
