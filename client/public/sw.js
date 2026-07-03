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

// App-shell cache, so an installed PWA opens offline. Bump the version to
// invalidate old entries on the next activate. Hashed build assets are
// immutable, so caching them is safe; the HTML shell is refreshed
// network-first below.
const SHELL_CACHE = 'beacon-shell-v1'
const SHELL_URLS = ['/', '/index.html', '/favicon.svg', '/manifest.webmanifest']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((c) => c.addAll(SHELL_URLS)).catch(() => {}).then(() => self.skipWaiting()),
  )
})
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

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

  // App-shell caching for same-origin GETs — but never the P2P stream, the
  // API, or the socket transport, which must always hit the live server/peer.
  if (
    event.request.method === 'GET' &&
    url.origin === self.location.origin &&
    !url.pathname.startsWith('/p2p/') &&
    !url.pathname.startsWith('/api/') &&
    !url.pathname.startsWith('/socket.io/')
  ) {
    if (event.request.mode === 'navigate') {
      // Network-first for navigations so a fresh shell wins when online, with
      // the cached shell as the offline fallback.
      event.respondWith(
        fetch(event.request).catch(() => caches.match('/index.html').then((r) => r ?? Response.error())),
      )
      return
    }
    // Cache-first only for content-hashed build assets — never media, and
    // never a Range request (partial responses would corrupt the cache and
    // break video seeking).
    const isAsset = /\.(js|mjs|css|woff2?|svg|png|ico|webmanifest)$/.test(url.pathname)
    if (isAsset && !event.request.headers.has('range')) {
      event.respondWith(
        caches.match(event.request).then((hit) =>
          hit ?? fetch(event.request).then((res) => {
            if (res.ok && res.type === 'basic') {
              const copy = res.clone()
              caches.open(SHELL_CACHE).then((c) => c.put(event.request, copy)).catch(() => {})
            }
            return res
          }),
        ),
      )
    }
    return
  }

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
      // The mime comes from the sharing peer — only honor real media types so
      // a peer can't serve arbitrary typed content from this origin.
      const mime = /^(video|audio)\/[\w.+-]+$/.test(entry.mime) ? entry.mime : 'video/mp4'
      return new Response(bytes, {
        status: 206,
        headers: {
          'Content-Type': mime,
          'Content-Length': String(bytes.byteLength),
          'Content-Range': `bytes ${start}-${start + bytes.byteLength - 1}/${entry.size}`,
          'Accept-Ranges': 'bytes',
          'X-Content-Type-Options': 'nosniff',
        },
      })
    } catch (err) {
      return new Response(String(err), { status: 502 })
    }
  })())
})
