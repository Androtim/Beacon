import { test, expect } from '@playwright/test'

// The customization engine: dark/light are separate saved themes, edits are a
// draft (preview-only) until Save, and the shadow-DOM reset restores defaults.

const accentVar = (page: any) =>
  page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim())
const bgVar = (page: any) =>
  page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--bg-primary').trim())

test('light mode applies a genuinely light palette', async ({ page }) => {
  await page.goto('/settings')
  await page.getByTestId('mode-dark').click()
  const darkBg = await bgVar(page)
  await page.getByTestId('mode-light').click()
  const lightBg = await bgVar(page)
  expect(lightBg).not.toBe(darkBg)
  expect(lightBg.toLowerCase()).toBe('#faf8ff') // Daylight background
})

test('editing is preview-only until Save, then it persists', async ({ page }) => {
  await page.goto('/settings')
  await page.getByTestId('mode-dark').click()
  expect(await accentVar(page)).toBe('242 126 114') // default Crystal

  // Pick Midnight — global must NOT change yet (draft/preview only).
  await page.getByTestId('preset-midnight').click()
  expect(await accentVar(page)).toBe('242 126 114') // still Crystal globally

  // Save — now it applies and survives reload.
  await page.getByTestId('save-theme').click()
  expect(await accentVar(page)).toBe('139 110 209')
  await page.reload()
  await page.getByTestId('appearance-mode-easy').waitFor()
  expect(await accentVar(page)).toBe('139 110 209')
})

test('dark and light themes are independent', async ({ page }) => {
  await page.goto('/settings')
  // Edit + save the light theme's accent.
  await page.getByTestId('mode-light').click()
  await page.getByTestId('accent-picker').evaluate((el: HTMLInputElement) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!
    setter.call(el, '#00ff00')
    el.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await page.getByTestId('save-theme').click()
  expect(await accentVar(page)).toBe('0 255 0')

  // Dark theme is untouched.
  await page.getByTestId('mode-dark').click()
  expect(await accentVar(page)).not.toBe('0 255 0')
})

test('motion toggle flips the document attribute (immediately)', async ({ page }) => {
  await page.goto('/settings')
  await page.getByTestId('motion-toggle').uncheck()
  expect(await page.evaluate(() => document.documentElement.dataset.motion)).toBe('off')
})

test('tinkerer custom CSS is validated before applying', async ({ page }) => {
  await page.goto('/settings')
  await page.getByTestId('appearance-mode-tinkerer').click()
  await page.getByTestId('custom-css').fill('.glass-card { color: red ')
  await page.getByTestId('apply-css').click()
  await expect(page.getByTestId('css-error')).toBeVisible()
})

test('reset escape hatch restores the default theme', async ({ page }) => {
  await page.goto('/settings')
  await page.getByTestId('mode-dark').click()
  await page.getByTestId('preset-ember').click()
  await page.getByTestId('save-theme').click()
  expect(await accentVar(page)).not.toBe('242 126 114')
  await page.evaluate(() => {
    const host = [...document.body.children].find((el) => el.shadowRoot?.querySelector('button'))
    host?.shadowRoot?.querySelector('button')?.click()
  })
  await expect.poll(() => accentVar(page)).toBe('242 126 114')
})
