import { test, expect } from '@playwright/test'
import { createHash, randomBytes } from 'crypto'
import fs from 'fs'
import path from 'path'

// P2P transfer engine tests:
// 1. Protocol-level resume over a real loopback WebRTC pair, interrupting the
//    channel mid-transfer and asserting the second attempt starts where the
//    first stopped and the bytes come out identical (exercises the OPFS
//    worker persistence for real).
// 2. Full share-code UX flow between two browser contexts, byte-identical.
// 3. Watch-party video file share to a participant.

function sha256(buf: Buffer | Uint8Array): string {
  return createHash('sha256').update(buf).digest('hex')
}

test('transfer protocol resumes after a dropped connection (loopback)', async ({ page }) => {
  await page.goto('/')

  const result = await page.evaluate(async () => {
    const { createSender, createReceiver, cleanupTransfer, CHUNK_SIZE } =
      await import('/src/lib/p2p/transfer.js')

    const transferId = `loopback-${Math.random().toString(36).slice(2)}`
    // 4MB of pseudo-random data (crypto.getRandomValues caps at 64KB per call).
    const data = new Uint8Array(4 * 1024 * 1024)
    for (let off = 0; off < data.length; off += 65536) {
      crypto.getRandomValues(data.subarray(off, Math.min(off + 65536, data.length)))
    }
    const file = new File([data], 'resume-test.bin', { type: 'application/octet-stream' })
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE)

    async function pairUp() {
      const a = new RTCPeerConnection()
      const b = new RTCPeerConnection()
      a.onicecandidate = (e) => e.candidate && b.addIceCandidate(e.candidate)
      b.onicecandidate = (e) => e.candidate && a.addIceCandidate(e.candidate)
      const channel = a.createDataChannel('transfer')
      const remoteChannel = new Promise((resolve) => { b.ondatachannel = (e) => resolve(e.channel) })
      await a.setLocalDescription()
      await b.setRemoteDescription(a.localDescription)
      await b.setLocalDescription()
      await a.setRemoteDescription(b.localDescription)
      return { a, b, channel, remoteChannel: await remoteChannel }
    }

    // ---- Attempt 1: kill the connection partway through ----
    const first = await pairUp()
    const killAfter = Math.floor(totalChunks / 3)
    let sent = 0
    const origSend = first.channel.send.bind(first.channel)
    first.channel.send = (frame) => {
      origSend(frame)
      if (typeof frame !== 'string' && ++sent >= killAfter) {
        // Simulate the network dying mid-transfer.
        setTimeout(() => { first.a.close(); first.b.close() }, 0)
        first.channel.send = () => { throw new Error('closed') }
      }
    }

    await new Promise((resolve) => {
      const receiver = createReceiver({
        channel: first.remoteChannel,
        transferId,
        onError: () => {},
      })
      const sender = createSender({
        channel: first.channel, transferId, files: [file],
        onError: () => {},
      })
      sender.start()
      // Give the doomed attempt time to die.
      setTimeout(async () => {
        await receiver.stop?.()
        resolve(null)
      }, 3000)
    })

    // ---- Attempt 2: fresh pair, same transferId -> must resume ----
    const second = await pairUp()
    let resumedFrom = -1
    const origSend2 = second.remoteChannel.send.bind(second.remoteChannel)
    second.remoteChannel.send = (msg) => {
      if (typeof msg === 'string') {
        const parsed = JSON.parse(msg)
        if (parsed.t === 'resume') resumedFrom = parsed.have?.[0] ?? 0
      }
      origSend2(msg)
    }

    const received: File = await new Promise((resolve, reject) => {
      createReceiver({
        channel: second.remoteChannel,
        transferId,
        onFileComplete: (f) => resolve(f),
        onError: reject,
      })
      const sender = createSender({
        channel: second.channel, transferId, files: [file],
        onError: reject,
      })
      sender.start()
      setTimeout(() => reject(new Error('transfer timed out')), 30_000)
    })

    const [origHash, gotHash] = await Promise.all([
      crypto.subtle.digest('SHA-256', data),
      crypto.subtle.digest('SHA-256', await received.arrayBuffer()),
    ])
    const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('')

    await cleanupTransfer(transferId)
    second.a.close(); second.b.close()

    return {
      resumedFrom,
      totalChunks,
      identical: hex(origHash) === hex(gotHash),
      size: received.size,
    }
  })

  expect(result.identical, 'received bytes must equal sent bytes').toBe(true)
  expect(result.size).toBe(4 * 1024 * 1024)
  // The whole point: attempt 2 did NOT start from zero.
  expect(result.resumedFrom).toBeGreaterThan(0)
  expect(result.resumedFrom).toBeLessThan(result.totalChunks)
})

test('share-code flow transfers a file byte-identical between two browsers', async ({ browser }) => {
  const ctxA = await browser.newContext()
  const ctxB = await browser.newContext()
  const sender = await ctxA.newPage()
  const receiver = await ctxB.newPage()

  const payload = randomBytes(2 * 1024 * 1024 + 12345) // deliberately not chunk-aligned
  const payloadHash = sha256(payload)

  await sender.goto('/files')
  await sender.getByTestId('fileshare-input').setInputFiles({
    name: 'identical-check.bin',
    mimeType: 'application/octet-stream',
    buffer: payload,
  })
  const code = (await sender.getByTestId('fileshare-code').innerText()).replace(/\s+/g, '')
  expect(code).toHaveLength(8)

  await receiver.goto('/files')
  await receiver.getByTestId('fileshare-code-input').fill(code)
  await receiver.getByTestId('fileshare-join').click()
  await expect(receiver.getByTestId('fileshare-accept')).toBeVisible()

  const [download] = await Promise.all([
    receiver.waitForEvent('download'),
    receiver.getByTestId('fileshare-accept').click(),
  ])
  expect(download.suggestedFilename()).toBe('identical-check.bin')
  const saved = await download.path()
  const got = fs.readFileSync(saved!)
  expect(got.length).toBe(payload.length)
  expect(sha256(got)).toBe(payloadHash)

  await expect(receiver.getByTestId('fileshare-complete')).toBeVisible()
  await ctxA.close()
  await ctxB.close()
})

test('multiple files arrive as a zip', async ({ browser }) => {
  const ctxA = await browser.newContext()
  const ctxB = await browser.newContext()
  const sender = await ctxA.newPage()
  const receiver = await ctxB.newPage()

  await sender.goto('/files')
  await sender.getByTestId('fileshare-input').setInputFiles([
    { name: 'one.bin', mimeType: 'application/octet-stream', buffer: randomBytes(300_000) },
    { name: 'two.bin', mimeType: 'application/octet-stream', buffer: randomBytes(500_000) },
  ])
  const code = (await sender.getByTestId('fileshare-code').innerText()).replace(/\s+/g, '')

  await receiver.goto('/files')
  await receiver.getByTestId('fileshare-code-input').fill(code)
  await receiver.getByTestId('fileshare-join').click()
  await expect(receiver.getByTestId('fileshare-accept')).toBeVisible()

  const [download] = await Promise.all([
    receiver.waitForEvent('download'),
    receiver.getByTestId('fileshare-accept').click(),
  ])
  expect(download.suggestedFilename()).toMatch(/\.zip$/)
  const saved = await download.path()
  expect(fs.statSync(saved!).size).toBeGreaterThan(100_000)

  await ctxA.close()
  await ctxB.close()
})

test('watch party: host shares a video file P2P and participant can play it', async ({ browser }) => {
  const roomId = `P2P${Date.now().toString(36).toUpperCase()}`
  const ctxA = await browser.newContext()
  const ctxB = await browser.newContext()
  const host = await ctxA.newPage()
  const guest = await ctxB.newPage()

  await host.goto(`/party/${roomId}`)
  await expect(host.getByTestId('host-controls')).toBeVisible()
  await guest.goto(`/party/${roomId}`)
  await expect(guest.getByTestId('participant-count')).toHaveText('2')

  // Host switches to P2P file mode and broadcasts a real video file.
  await host.getByTestId('source-mode-file').click()
  const videoBytes = fs.readFileSync(path.resolve(__dirname, '../../client/public/samples/sync-test.mp4'))
  await host.getByTestId('party-file-input').setInputFiles({
    name: 'movie.mp4',
    mimeType: 'video/mp4',
    buffer: videoBytes,
  })
  await host.getByTestId('party-broadcast').click()

  // Host plays its own copy immediately (blob URL).
  await expect(host.locator('video')).toBeAttached()

  // Participant accepts and gets a STREAMING source within seconds — bytes
  // are pulled from the host on demand via the service worker, no full
  // download before playback.
  await expect(guest.getByTestId('party-accept')).toBeVisible()
  await guest.getByTestId('party-accept').click()
  await expect(guest.getByTestId('party-file-ready')).toBeVisible({ timeout: 30_000 })
  await expect(guest.locator('video')).toBeAttached()
  const src = await guest.locator('video').getAttribute('src')
  expect(src).toMatch(/^\/p2p\//)

  // The streamed source must actually decode: metadata (duration) arrives
  // over the P2P range protocol.
  await expect.poll(
    () => guest.locator('video').evaluate((v: HTMLVideoElement) => v.duration || 0),
    { timeout: 15_000 },
  ).toBeGreaterThan(25) // the sample is ~30s

  // And the synced playback machinery drives the participant's streamed copy.
  await host.locator('video').evaluate((v: HTMLVideoElement) => v.play())
  await expect.poll(
    () => guest.locator('video').evaluate((v: HTMLVideoElement) => !v.paused && v.currentTime > 0.2),
    { timeout: 15_000 },
  ).toBe(true)

  await ctxA.close()
  await ctxB.close()
})
