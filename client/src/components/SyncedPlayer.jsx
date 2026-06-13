import { useEffect, useRef, useState } from 'react'
import { Volume2 } from 'lucide-react'
import { targetPosition, decideCorrection } from '@shared/sync'
import { createHtml5Adapter, createYouTubeAdapter, getYouTubeVideoId } from '../lib/playerAdapters'

const TICK_MS = 500

/**
 * The synchronized player. Renders the right player for the source (native
 * HTML5 video for direct URLs and P2P blobs, YouTube IFrame API for YouTube
 * links) and continuously steers it toward the room's authoritative playback
 * state. Host user actions are reported up as intents — never applied
 * locally first and never echoed back.
 */
export default function SyncedPlayer({ src, playback, serverNow, isHost, onIntent }) {
  const videoRef = useRef(null)
  const ytContainerRef = useRef(null)
  const adapterRef = useRef(null)
  const playbackRef = useRef(playback)
  const [needsUnmute, setNeedsUnmute] = useState(false)

  playbackRef.current = playback

  const ytVideoId = src ? getYouTubeVideoId(src) : null
  const mode = ytVideoId ? 'youtube' : src ? 'html5' : 'none'

  // Intents go up only from the host; refs keep callbacks stable.
  const intentRef = useRef(onIntent)
  intentRef.current = onIntent
  const isHostRef = useRef(isHost)
  isHostRef.current = isHost

  const adapterCallbacks = {
    onUserPlay: (t) => { if (isHostRef.current) intentRef.current?.play(t) },
    onUserPause: (t) => { if (isHostRef.current) intentRef.current?.pause(t) },
    onUserSeek: (t) => { if (isHostRef.current) intentRef.current?.seek(t) },
    onAutoplayMuted: () => setNeedsUnmute(true),
  }
  const callbacksRef = useRef(adapterCallbacks)
  callbacksRef.current = adapterCallbacks

  // (Re)create the adapter when the source changes.
  useEffect(() => {
    let cancelled = false
    adapterRef.current?.destroy()
    adapterRef.current = null
    setNeedsUnmute(false)

    const stableCallbacks = {
      onUserPlay: (t) => callbacksRef.current.onUserPlay(t),
      onUserPause: (t) => callbacksRef.current.onUserPause(t),
      onUserSeek: (t) => callbacksRef.current.onUserSeek(t),
      onAutoplayMuted: () => callbacksRef.current.onAutoplayMuted(),
    }

    if (mode === 'html5' && videoRef.current) {
      adapterRef.current = createHtml5Adapter(videoRef.current, stableCallbacks)
    } else if (mode === 'youtube' && ytContainerRef.current) {
      // The YT API replaces the given element, so hand it a fresh child.
      const mount = document.createElement('div')
      ytContainerRef.current.innerHTML = ''
      ytContainerRef.current.appendChild(mount)
      createYouTubeAdapter(mount, ytVideoId, stableCallbacks).then((adapter) => {
        if (cancelled) adapter.destroy()
        else adapterRef.current = adapter
      })
    }

    return () => {
      cancelled = true
      adapterRef.current?.destroy()
      adapterRef.current = null
    }
  }, [mode, src, ytVideoId])

  // The drift-correction loop: every tick, steer the player toward where the
  // room says the video should be right now.
  useEffect(() => {
    const tick = () => {
      const adapter = adapterRef.current
      const state = playbackRef.current
      if (!adapter || !state || !state.url) return

      const target = targetPosition(state, serverNow())

      // Align play/pause state first.
      if (state.isPlaying && adapter.isPaused()) {
        adapter.seek(target)
        adapter.play()
        return
      }
      if (!state.isPlaying && !adapter.isPaused()) {
        adapter.pause()
        adapter.seek(state.position)
        return
      }

      const correction = decideCorrection(
        adapter.getCurrentTime(), target, state.isPlaying, adapter.allowedRates ?? undefined,
      )
      if (correction.type === 'seek') adapter.seek(correction.to)
      else if (correction.type === 'rate') adapter.setRate(correction.rate)
    }

    const interval = setInterval(tick, TICK_MS)
    return () => clearInterval(interval)
  }, [serverNow])

  const unmute = () => {
    if (videoRef.current) videoRef.current.muted = false
    setNeedsUnmute(false)
  }

  if (mode === 'none') return null

  return (
    <div className="w-full h-full relative" data-testid="synced-player">
      {mode === 'html5' ? (
        <video
          ref={videoRef}
          src={src}
          controls
          playsInline
          className="w-full h-full object-contain bg-black"
          data-testid="party-video"
        />
      ) : (
        <div ref={ytContainerRef} className="w-full h-full" data-testid="party-youtube" />
      )}
      {needsUnmute && (
        <button
          onClick={unmute}
          className="absolute bottom-16 left-1/2 -translate-x-1/2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-lg flex items-center gap-2"
        >
          <Volume2 size={14} /> Tap to unmute
        </button>
      )}
    </div>
  )
}
