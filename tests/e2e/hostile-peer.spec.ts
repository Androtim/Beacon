import { test, expect } from '@playwright/test'

// Regression tests for the receiver-side defenses against a hostile sending
// peer (see the P2P hardening in client/src/lib/p2p/transfer.js and
// streaming.js). Each test drives the REAL receiver with a hand-rolled
// malicious sender over a loopback RTCPeerConnection pair — no UI — and
// asserts the receiver rejects the abuse instead of acting on it.

test('receiver rejects a manifest whose chunk geometry does not match its size', async ({ page }) => {
  await page.goto('/')

  const outcome = await page.evaluate(async () => {
    const { createReceiver } = await import('/src/lib/p2p/transfer.js')

    const a = new RTCPeerConnection()
    const b = new RTCPeerConnection()
    a.onicecandidate = (e) => e.candidate && b.addIceCandidate(e.candidate)
    b.onicecandidate = (e) => e.candidate && a.addIceCandidate(e.candidate)
    const sendCh = a.createDataChannel('transfer')
    const remote: Promise<RTCDataChannel> = new Promise((res) => { b.ondatachannel = (e) => res(e.channel) })
    await a.setLocalDescription()
    await b.setRemoteDescription(a.localDescription!)
    await b.setLocalDescription()
    await a.setRemoteDescription(b.localDescription!)
    const recvCh = await remote
    await new Promise<void>((res) => { sendCh.readyState === 'open' ? res() : (sendCh.onopen = () => res()) })

    let errored = false
    let resumeSeen = false
    recvCh.onmessage = (e) => { if (typeof e.data === 'string' && JSON.parse(e.data).t === 'resume') resumeSeen = true }

    const transferId = 'mal-manifest'
    createReceiver({
      channel: recvCh,
      transferId,
      onError: () => { errored = true },
    })

    // A tiny file (1 chunk) but a totalChunks claiming 1,000,000 — the geometry
    // an attacker would use to write chunks at huge offsets.
    sendCh.send(JSON.stringify({
      t: 'manifest', id: transferId,
      files: [{ i: 0, name: 'evil.bin', size: 100, type: 'application/octet-stream', chunkSize: 65536, totalChunks: 1_000_000 }],
    }))
    await new Promise((r) => setTimeout(r, 300))
    a.close(); b.close()
    return { errored, resumeSeen }
  })

  expect(outcome.errored).toBe(true)   // receiver flagged the manifest
  expect(outcome.resumeSeen).toBe(false) // and never answered with a resume (never allocated a store)
})

test('receiver drops a chunk written past the declared totalChunks', async ({ page }) => {
  await page.goto('/')

  const outcome = await page.evaluate(async () => {
    const { createReceiver, cleanupTransfer, CHUNK_SIZE } = await import('/src/lib/p2p/transfer.js')

    const a = new RTCPeerConnection()
    const b = new RTCPeerConnection()
    a.onicecandidate = (e) => e.candidate && b.addIceCandidate(e.candidate)
    b.onicecandidate = (e) => e.candidate && a.addIceCandidate(e.candidate)
    const sendCh = a.createDataChannel('transfer')
    sendCh.binaryType = 'arraybuffer'
    const remote: Promise<RTCDataChannel> = new Promise((res) => { b.ondatachannel = (e) => res(e.channel) })
    await a.setLocalDescription()
    await b.setRemoteDescription(a.localDescription!)
    await b.setLocalDescription()
    await a.setRemoteDescription(b.localDescription!)
    const recvCh = await remote
    await new Promise<void>((res) => { sendCh.readyState === 'open' ? res() : (sendCh.onopen = () => res()) })

    const transferId = 'mal-oob-' + Math.random().toString(36).slice(2)
    // A legitimate 2-chunk file.
    const size = CHUNK_SIZE + 100
    const totalChunks = 2
    let completedSize = -1
    let errored = false
    let errMsg = ''
    let done = false

    await new Promise<void>((resolve) => {
      createReceiver({
        channel: recvCh,
        transferId,
        onFileComplete: (file: File) => { completedSize = file.size; done = true; resolve() },
        // Ignore the channel-close error that fires after we tear the pair down.
        onError: (e: Error) => { if (done) return; errored = true; errMsg = String(e?.message ?? e); resolve() },
      })

      // createReceiver owns recvCh.onmessage; we only drive the sender side.
      sendCh.onmessage = (e) => {
        if (typeof e.data !== 'string') return
        const msg = JSON.parse(e.data)
        if (msg.t !== 'resume') return
        // Send an out-of-range chunk FIRST (index 999 » totalChunks) — must be ignored.
        const oob = new Uint8Array(8 + 10)
        new DataView(oob.buffer).setUint32(0, 0, true)
        new DataView(oob.buffer).setUint32(4, 999, true)
        sendCh.send(oob)
        // Then the two real chunks in order.
        for (let i = 0; i < totalChunks; i++) {
          const bytes = i === 0 ? CHUNK_SIZE : 100
          const frame = new Uint8Array(8 + bytes)
          const dv = new DataView(frame.buffer)
          dv.setUint32(0, 0, true)
          dv.setUint32(4, i, true)
          sendCh.send(frame)
        }
      }
      sendCh.send(JSON.stringify({
        t: 'manifest', id: transferId,
        files: [{ i: 0, name: 'ok.bin', size, type: 'application/octet-stream', chunkSize: CHUNK_SIZE, totalChunks }],
      }))
    })

    a.close(); b.close()
    await cleanupTransfer(transferId).catch(() => {})
    return { completedSize, size, errored, errMsg }
  })

  // The out-of-range chunk was ignored; the file still completes at its true size.
  expect(outcome.errored, `unexpected error: ${outcome.errMsg}`).toBe(false)
  expect(outcome.completedSize).toBe(outcome.size)
})
