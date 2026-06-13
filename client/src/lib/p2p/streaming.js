// Stream-while-downloading over WebRTC.
//
// Host side: serveFileOverChannel answers byte-range requests from its local
// File. Receiver side: createStreamUrl registers /p2p/<key> with the service
// worker and bridges the SW's range requests onto the data channel. The
// <video> element then plays the URL like any HTTP source — the browser's
// demuxer drives which bytes are fetched, so playback starts immediately and
// seeking works even into parts that were never downloaded.
//
// Range wire format (channel label 'stream'):
//   receiver -> host: {t:'range', reqId, start, end}    (end exclusive)
//   host -> receiver: binary frames [uint32 reqId][bytes...] in order,
//                     then {t:'range-end', reqId, total}

const FRAME_HEADER = 4
const CHUNK = 64 * 1024

// ---------- Host ----------

export function serveFileOverChannel(channel, file) {
  channel.binaryType = 'arraybuffer'
  let stopped = false

  channel.onmessage = async (event) => {
    if (stopped || typeof event.data !== 'string') return
    let msg
    try { msg = JSON.parse(event.data) } catch { return }
    if (msg.t !== 'range') return

    const start = Math.max(0, msg.start | 0)
    const end = Math.min(file.size, msg.end)
    try {
      for (let off = start; off < end; off += CHUNK) {
        if (stopped || channel.readyState !== 'open') return
        const slice = await file.slice(off, Math.min(off + CHUNK, end)).arrayBuffer()
        const frame = new Uint8Array(FRAME_HEADER + slice.byteLength)
        new DataView(frame.buffer).setUint32(0, msg.reqId, true)
        frame.set(new Uint8Array(slice), FRAME_HEADER)
        if (channel.bufferedAmount > 4 * 1024 * 1024) {
          await new Promise((resolve) => {
            channel.bufferedAmountLowThreshold = 512 * 1024
            channel.addEventListener('bufferedamountlow', resolve, { once: true })
          })
        }
        channel.send(frame)
      }
      if (channel.readyState === 'open') {
        channel.send(JSON.stringify({ t: 'range-end', reqId: msg.reqId, total: end - start }))
      }
    } catch (err) {
      console.error('range serve failed:', err)
    }
  }

  return { stop: () => { stopped = true } }
}

// ---------- Receiver ----------

let swReady = null
function ensureServiceWorker() {
  if (swReady) return swReady
  swReady = navigator.serviceWorker.register('/sw.js').then(async () => {
    await navigator.serviceWorker.ready
    // Make sure THIS page is controlled (first-ever load isn't until reload
    // unless the SW claims clients — ours does, but give it a beat).
    if (!navigator.serviceWorker.controller) {
      await new Promise((resolve) => {
        navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true })
        setTimeout(resolve, 1500)
      })
    }
    return navigator.serviceWorker.controller ?? navigator.serviceWorker.ready.then((r) => r.active)
  })
  return swReady
}

/**
 * Wire a 'stream' data channel to the service worker and return a URL the
 * <video> element can play. `meta` = {size, type}.
 */
export async function createStreamUrl(channel, key, meta) {
  channel.binaryType = 'arraybuffer'
  await ensureServiceWorker()

  // In-flight range requests: reqId -> {parts, received, resolve, reject}
  const inflight = new Map()
  let nextReqId = 1

  channel.onmessage = (event) => {
    if (typeof event.data === 'string') {
      let msg
      try { msg = JSON.parse(event.data) } catch { return }
      if (msg.t === 'range-end') {
        const req = inflight.get(msg.reqId)
        if (!req) return
        inflight.delete(msg.reqId)
        const out = new Uint8Array(req.received)
        let off = 0
        for (const part of req.parts) {
          out.set(new Uint8Array(part), off)
          off += part.byteLength
        }
        req.resolve(out.buffer)
      }
      return
    }
    const reqId = new DataView(event.data).getUint32(0, true)
    const req = inflight.get(reqId)
    if (!req) return
    const body = event.data.slice(FRAME_HEADER)
    req.parts.push(body)
    req.received += body.byteLength
  }

  channel.onclose = () => {
    for (const req of inflight.values()) req.reject(new Error('stream channel closed'))
    inflight.clear()
  }

  function requestRange(start, end) {
    return new Promise((resolve, reject) => {
      if (channel.readyState !== 'open') return reject(new Error('stream channel not open'))
      const reqId = nextReqId++
      inflight.set(reqId, { parts: [], received: 0, resolve, reject })
      channel.send(JSON.stringify({ t: 'range', reqId, start, end }))
      setTimeout(() => {
        if (inflight.delete(reqId)) reject(new Error('range timed out'))
      }, 25_000)
    })
  }

  // Answer the service worker's range requests for our key.
  const onSwMessage = async (event) => {
    const msg = event.data
    if (msg?.t !== 'range-request' || msg.key !== key) return
    const port = event.ports[0]
    try {
      const bytes = await requestRange(msg.start, msg.end)
      port.postMessage({ ok: true, bytes }, [bytes])
    } catch (err) {
      port.postMessage({ ok: false, error: String(err?.message ?? err) })
    }
  }
  navigator.serviceWorker.addEventListener('message', onSwMessage)

  // Register the stream and wait for the ack so the URL is servable.
  const sw = navigator.serviceWorker.controller
    ?? (await navigator.serviceWorker.ready).active
  await new Promise((resolve) => {
    const onAck = (event) => {
      if (event.data?.t === 'stream-registered' && event.data.key === key) {
        navigator.serviceWorker.removeEventListener('message', onAck)
        resolve()
      }
    }
    navigator.serviceWorker.addEventListener('message', onAck)
    sw.postMessage({ t: 'register-stream', key, size: meta.size, mime: meta.type })
    setTimeout(resolve, 2000)
  })

  return {
    url: `/p2p/${key}`,
    destroy: () => {
      navigator.serviceWorker.removeEventListener('message', onSwMessage)
      navigator.serviceWorker.controller?.postMessage({ t: 'unregister-stream', key })
    },
  }
}
