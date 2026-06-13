// Player adapters give the sync engine one interface over different player
// technologies. Every adapter distinguishes USER actions (which become host
// intents) from PROGRAMMATIC actions issued by the engine (which must never
// echo back as intents) via a suppression window.

const SUPPRESS_MS = 500

function createSuppressor() {
  let until = 0
  return {
    guard(fn) {
      until = Date.now() + SUPPRESS_MS
      return fn()
    },
    active: () => Date.now() < until,
  }
}

/** Adapter over a native HTML5 <video> element (mp4/webm/mov/blob). */
export function createHtml5Adapter(video, callbacks = {}) {
  const suppress = createSuppressor()

  const onPlay = () => { if (!suppress.active()) callbacks.onUserPlay?.(video.currentTime) }
  const onPause = () => {
    // 'pause' also fires at the very end of the media — not a user intent.
    if (!suppress.active() && !video.ended) callbacks.onUserPause?.(video.currentTime)
  }
  const onSeeked = () => { if (!suppress.active()) callbacks.onUserSeek?.(video.currentTime) }
  const onEnded = () => callbacks.onEnded?.(video.duration || video.currentTime)

  video.addEventListener('play', onPlay)
  video.addEventListener('pause', onPause)
  video.addEventListener('seeked', onSeeked)
  video.addEventListener('ended', onEnded)

  return {
    kind: 'html5',
    allowedRates: null, // continuous rates supported
    getCurrentTime: () => video.currentTime,
    getDuration: () => (Number.isFinite(video.duration) ? video.duration : 0),
    isPaused: () => video.paused,
    setRate: (r) => { if (video.playbackRate !== r) video.playbackRate = r },
    seek: (t) => suppress.guard(() => { video.currentTime = t }),
    play: () => suppress.guard(() => video.play().catch(() => {
      // Autoplay with sound blocked: retry muted so sync still works, and let
      // the UI offer an unmute control.
      video.muted = true
      callbacks.onAutoplayMuted?.()
      return video.play().catch(() => {})
    })),
    pause: () => suppress.guard(() => video.pause()),
    destroy: () => {
      video.removeEventListener('play', onPlay)
      video.removeEventListener('pause', onPause)
      video.removeEventListener('seeked', onSeeked)
      video.removeEventListener('ended', onEnded)
    },
  }
}

// ---------- YouTube (official IFrame Player API) ----------

let ytApiPromise = null

function loadYouTubeApi() {
  if (ytApiPromise) return ytApiPromise
  ytApiPromise = new Promise((resolve) => {
    if (window.YT?.Player) return resolve(window.YT)
    const prev = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      prev?.()
      resolve(window.YT)
    }
    const tag = document.createElement('script')
    tag.src = 'https://www.youtube.com/iframe_api'
    document.head.appendChild(tag)
  })
  return ytApiPromise
}

export function getYouTubeVideoId(url) {
  try {
    const u = new URL(url)
    if (u.hostname === 'youtu.be') return u.pathname.slice(1).split('/')[0] || null
    if (u.hostname.endsWith('youtube.com')) {
      if (u.pathname === '/watch') return u.searchParams.get('v')
      const m = u.pathname.match(/^\/(embed|shorts|live)\/([\w-]{6,})/)
      if (m) return m[2]
    }
  } catch {
    return null
  }
  return null
}

/**
 * Adapter over the YouTube IFrame Player API. Contrary to project folklore,
 * YouTube CAN be synced: the API exposes play/pause/seek/getCurrentTime.
 * Seeks have no dedicated event, so user seeks are detected by polling for
 * time jumps that playback alone cannot explain.
 */
export async function createYouTubeAdapter(container, videoId, callbacks = {}) {
  const YT = await loadYouTubeApi()
  const suppress = createSuppressor()
  let destroyed = false
  let lastPolled = { time: 0, at: Date.now(), rate: 1 }

  const player = await new Promise((resolve, reject) => {
    // YT.Player gives no rejection path of its own — guard against a player
    // that never becomes ready (bad video id, blocked embed, network failure).
    const failsafe = setTimeout(() => reject(new Error('YouTube player never became ready')), 15_000)
    const p = new YT.Player(container, {
      videoId,
      width: '100%',
      height: '100%',
      playerVars: { controls: 1, rel: 0, disablekb: 0, playsinline: 1 },
      events: {
        onReady: () => {
          clearTimeout(failsafe)
          resolve(p)
        },
        onError: (e) => {
          clearTimeout(failsafe)
          reject(new Error(`YouTube player error ${e.data}`))
        },
        onStateChange: (e) => {
          if (e.data === YT.PlayerState.ENDED) { callbacks.onEnded?.(p.getDuration?.() ?? 0); return }
          if (suppress.active() || destroyed) return
          if (e.data === YT.PlayerState.PLAYING) callbacks.onUserPlay?.(p.getCurrentTime())
          else if (e.data === YT.PlayerState.PAUSED) callbacks.onUserPause?.(p.getCurrentTime())
        },
      },
    })
  })

  // User-seek detection: a time jump larger than elapsed-playback allows.
  const seekPoll = setInterval(() => {
    if (destroyed) return
    const now = Date.now()
    const time = player.getCurrentTime?.() ?? 0
    const playing = player.getPlayerState?.() === YT.PlayerState.PLAYING
    const expected = lastPolled.time + (playing ? ((now - lastPolled.at) / 1000) * lastPolled.rate : 0)
    if (!suppress.active() && Math.abs(time - expected) > 1.5) {
      callbacks.onUserSeek?.(time)
    }
    lastPolled = { time, at: now, rate: player.getPlaybackRate?.() ?? 1 }
  }, 700)

  return {
    kind: 'youtube',
    allowedRates: player.getAvailablePlaybackRates?.() ?? [1],
    getCurrentTime: () => player.getCurrentTime?.() ?? 0,
    getDuration: () => player.getDuration?.() ?? 0,
    isPaused: () => player.getPlayerState?.() !== YT.PlayerState.PLAYING,
    setRate: (r) => { if (player.getPlaybackRate?.() !== r) player.setPlaybackRate?.(r) },
    seek: (t) => suppress.guard(() => player.seekTo?.(t, true)),
    play: () => suppress.guard(() => player.playVideo?.()),
    pause: () => suppress.guard(() => player.pauseVideo?.()),
    destroy: () => {
      destroyed = true
      clearInterval(seekPoll)
      try { player.destroy?.() } catch { /* iframe already gone */ }
    },
  }
}
