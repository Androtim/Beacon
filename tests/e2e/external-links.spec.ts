import { test, expect } from '@playwright/test'

test('home footer links out to Flexarion and the GitHub repo', async ({ page }) => {
  await page.goto('/')
  const footer = page.getByTestId('home-footer')
  await expect(footer.getByRole('link', { name: /Flexarion/ })).toHaveAttribute(
    'href',
    'https://flexarion.alwaysdata.net/',
  )
  await expect(footer.getByRole('link', { name: /GitHub/ })).toHaveAttribute(
    'href',
    'https://github.com/Androtim/Beacon',
  )
})
