import { test, expect } from '@playwright/test'
import { createHash, randomBytes } from 'crypto'
import fs from 'fs'

const sha256 = (b: Buffer | Uint8Array) => createHash('sha256').update(b).digest('hex')

// A share must keep running after the sender leaves the Files page — the whole
// point of "background sessions". The sender starts a share, navigates to Home,
// the sidebar shows it live, and a receiver can still download it.
test('file share survives navigation and stays in the sidebar', async ({ browser }) => {
  const ctxA = await browser.newContext()
  const ctxB = await browser.newContext()
  const sender = await ctxA.newPage()
  const receiver = await ctxB.newPage()

  const payload = randomBytes(1_500_000)
  await sender.goto('/files')
  await sender.getByTestId('fileshare-input').setInputFiles({ name: 'bg.bin', mimeType: 'application/octet-stream', buffer: payload })
  const code = (await sender.getByTestId('fileshare-code').innerText()).replace(/\s+/g, '')
  expect(code).toHaveLength(8)

  // Sender leaves Files for Home via in-app navigation (no reload) — the
  // transfer must NOT die, and shows live in the sidebar.
  await sender.getByRole('link', { name: 'Watch' }).click()
  await expect(sender.getByTestId('create-party')).toBeVisible() // we're on Home now
  await expect(sender.getByTestId('rail-transfer')).toBeVisible()

  // Receiver downloads while the sender sits on Home.
  await receiver.goto('/files')
  await receiver.getByTestId('fileshare-code-input').fill(code)
  await receiver.getByTestId('fileshare-join').click()
  await expect(receiver.getByTestId('fileshare-accept')).toBeVisible()
  const [download] = await Promise.all([
    receiver.waitForEvent('download'),
    receiver.getByTestId('fileshare-accept').click(),
  ])
  const got = fs.readFileSync((await download.path())!)
  expect(sha256(got)).toBe(sha256(payload)) // byte-identical, served from a backgrounded sender

  await ctxA.close()
  await ctxB.close()
})
