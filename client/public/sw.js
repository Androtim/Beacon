// Beacon streaming service worker.
//
// Serves /p2p/<key> video URLs by forwarding HTTP Range requests to the page,
// which fetches the bytes from the watch-party host over a WebRTC data
// channel. This is what lets a participant start WATCHING seconds after the
// host shares a file, instead of waiting for a full multi-GB transfer: the
// browser's own demuxer issues range requests (including the moov probe at
// the end of non-faststart MP4s) and we satisfy them peer-to-peer.

const streams = new Map() // key -> { size, mime, clientId }
const MAX_WINDOW = 2 * 1024 * 1024 // cap each 206 response; browser follows up

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('message', (event) => {
  const { t } = event.data ?? {}
  if (t === 'register-stream') {
    const { key, size, mime } = event.data
    streams.set(key, { size, mime, clientId: event.source.id })
    event.source.postMessage({ t: 'stream-registered', key })
  } else if (t === 'unregister-stream') {
    streams.delete(event.data.key)
  }
})

async function fetchRangeFromClient(entry, key, start, end) {
  const client = await self.clients.get(entry.clientId)
  if (!client) throw new Error('stream client gone')
  return new Promise((resolve, reject) => {
    const channel = new MessageChannel()
    const timer = setTimeout(() => reject(new Error('range request timed out')), 30_000)
    channel.port1.onmessage = (event) => {
      clearTimeout(timer)
      if (event.data.ok) resolve(event.data.bytes)
      else reject(new Error(event.data.error ?? 'range request failed'))
    }
    client.postMessage({ t: 'range-request', key, start, end }, [channel.port2])
  })
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  if (!url.pathname.startsWith('/p2p/')) return
  const key = url.pathname.slice('/p2p/'.length)
  const entry = streams.get(key)
  if (!entry) {
    event.respondWith(new Response('stream not registered', { status: 404 }))
    return
  }

  const rangeHeader = event.request.headers.get('range')
  let start = 0
  let end = entry.size - 1
  if (rangeHeader) {
    const m = /bytes=(\d+)-(\d*)/.exec(rangeHeader)
    if (m) {
      start = Number(m[1])
      if (m[2]) end = Math.min(Number(m[2]), entry.size - 1)
    }
  }
  end = Math.min(end, start + MAX_WINDOW - 1, entry.size - 1)

  event.respondWith((async () => {
    try {
      const bytes = await fetchRangeFromClient(entry, key, start, end + 1)
      return new Response(bytes, {
        status: 206,
        headers: {
          'Content-Type': entry.mime || 'video/mp4',
          'Content-Length': String(bytes.byteLength),
          'Content-Range': `bytes ${start}-${start + bytes.byteLength - 1}/${entry.size}`,
          'Accept-Ranges': 'bytes',
        },
      })
    } catch (err) {
      return new Response(String(err), { status: 502 })
    }
  })())
})
