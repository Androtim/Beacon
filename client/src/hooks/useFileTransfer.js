import { useCallback, useEffect, useRef, useState } from 'react'
import { createPeer, isPolite } from '../lib/p2p/peer'
import { createSender, createReceiver } from '../lib/p2p/transfer'
import { serveFileOverChannel, createStreamUrl } from '../lib/p2p/streaming'

let iceServersCache = null
async function fetchIceServers() {
  if (iceServersCache) return iceServersCache
  try {
    const token = localStorage.getItem('token')
    const res = await fetch('/api/ice-servers', { headers: { Authorization: `Bearer ${token}` } })
    const data = await res.json()
    iceServersCache = data.iceServers
  } catch {
    iceServersCache = null
  }
  return iceServersCache
}

/**
 * P2P file transfer glue: peers (perfect negotiation) + the resumable
 * transfer protocol + socket signaling. Used by both the share-code flow
 * (signalEvent 'file-share-signal') and watch parties ('video-file-signal').
 */
export function useFileTransfer({ socket, signalEvent, onFileReceived, onAllReceived, onUploadProgress, selfId }) {
  const [status, setStatus] = useState('idle') // idle|connecting|transferring|complete|error
  const [uploadProgress, setUploadProgress] = useState({})
  const [downloadProgress, setDownloadProgress] = useState({})

  const peersRef = useRef(new Map()) // remote socketId -> {peer, sender?, receiver?, watchdog?}
  const callbacksRef = useRef({ onFileReceived, onAllReceived, onUploadProgress })
  callbacksRef.current = { onFileReceived, onAllReceived, onUploadProgress }

  // If a connection doesn't establish within this window, stop waiting and
  // surface an error instead of spinning forever (failed NAT traversal, a TURN
  // relay the browser can't use, the other side never answering, etc.).
  const CONNECT_TIMEOUT_MS = 25_000

  const clearWatchdog = useCallback((peerId) => {
    const entry = peersRef.current.get(peerId)
    if (entry?.watchdog) {
      clearTimeout(entry.watchdog)
      entry.watchdog = null
    }
  }, [])

  const teardownPeer = useCallback((peerId) => {
    const entry = peersRef.current.get(peerId)
    if (!entry) return
    if (entry.watchdog) clearTimeout(entry.watchdog)
    entry.sender?.stop()
    entry.receiver?.stop()
    entry.server?.stop()
    entry.stream?.destroy()
    entry.peer.close()
    peersRef.current.delete(peerId)
    // Don't clobber a terminal status — callers set 'error' then tear down.
    if (peersRef.current.size === 0) setStatus((s) => (s === 'complete' || s === 'error' ? s : 'idle'))
  }, [])

  const armWatchdog = useCallback((peerId) => {
    const entry = peersRef.current.get(peerId)
    if (!entry) return
    entry.watchdog = setTimeout(() => {
      console.error(`Connection to ${peerId} timed out`)
      setStatus((s) => (s === 'transferring' || s === 'streaming' || s === 'complete' ? s : 'error'))
      teardownPeer(peerId)
    }, CONNECT_TIMEOUT_MS)
  }, [teardownPeer])

  const cancelAll = useCallback(() => {
    for (const peerId of [...peersRef.current.keys()]) teardownPeer(peerId)
    setUploadProgress({})
    setDownloadProgress({})
    setStatus('idle')
  }, [teardownPeer])

  // Route incoming signals to the right peer. The receiving side creates its
  // peer lazily when the first signal arrives (the sender dials first).
  useEffect(() => {
    if (!socket) return
    const onSignal = ({ from, signal }) => {
      peersRef.current.get(from)?.peer.handleSignal(signal)
    }
    socket.on(signalEvent, onSignal)
    return () => socket.off(signalEvent, onSignal)
  }, [socket, signalEvent])

  useEffect(() => cancelAll, [cancelAll])

  async function buildPeer(peerId) {
    const iceServers = await fetchIceServers()
    const peer = createPeer({
      sendSignal: (signal) => socket.emit(signalEvent, { to: peerId, signal }),
      // peerId addresses the remote (socketId for rooms, userId for DMs).
      // selfId must be the matching kind so politeness is symmetric.
      polite: isPolite(selfId ?? socket.id, peerId),
      iceServers,
      onConnectionState: (state) => {
        if (state === 'connected') {
          clearWatchdog(peerId) // established — stop the timeout
        } else if (state === 'failed' || state === 'closed') {
          setStatus((s) => (s === 'complete' ? s : 'error'))
          teardownPeer(peerId)
        }
      },
    })
    return peer
  }

  /** Host side: dial a peer and stream files to it (resumes automatically). */
  const sendTo = useCallback(async (peerId, files, transferId) => {
    teardownPeer(peerId)
    setStatus('connecting')
    const peer = await buildPeer(peerId)
    const channel = peer.createDataChannel('transfer', { ordered: true })
    const sender = createSender({
      channel,
      transferId,
      files,
      onProgress: ({ fileIndex, percent }) => {
        setStatus('transferring')
        const name = files[fileIndex]?.name ?? String(fileIndex)
        setUploadProgress((prev) => (prev[name] === percent ? prev : { ...prev, [name]: percent }))
        // Per-peer hook so a sharer serving many peers can track each one
        // (uploadProgress alone is keyed by file name and would collide).
        callbacksRef.current.onUploadProgress?.({ peerId, transferId, percent })
      },
      onComplete: () => setStatus('complete'),
      onError: (err) => {
        console.error('send failed:', err)
        setStatus('error')
      },
    })
    sender.start()
    peersRef.current.set(peerId, { peer, sender })
    armWatchdog(peerId)
  }, [socket, signalEvent, teardownPeer, armWatchdog])

  /** Receiver side: prepare for an inbound dial from `peerId`. */
  const receiveFrom = useCallback(async (peerId, transferId) => {
    teardownPeer(peerId)
    setStatus('connecting')
    const peer = await buildPeer(peerId)
    peer.pc.ondatachannel = ({ channel }) => {
      const receiver = createReceiver({
        channel,
        transferId,
        onProgress: ({ fileIndex, percent }) => {
          setStatus('transferring')
          setDownloadProgress((prev) => (prev[fileIndex] === percent ? prev : { ...prev, [fileIndex]: percent }))
        },
        onFileComplete: (file, meta) => callbacksRef.current.onFileReceived?.(file, meta, peerId),
        onAllComplete: () => {
          setStatus('complete')
          callbacksRef.current.onAllReceived?.()
        },
        onError: (err) => {
          console.error('receive failed:', err)
          setStatus('error')
        },
      })
      const entry = peersRef.current.get(peerId)
      if (entry) entry.receiver = receiver
    }
    peersRef.current.set(peerId, { peer })
    armWatchdog(peerId)
  }, [socket, signalEvent, teardownPeer, armWatchdog])

  /** Host side (streaming): answer byte-range requests from a local file. */
  const serveTo = useCallback(async (peerId, file) => {
    teardownPeer(peerId)
    setStatus('connecting')
    const peer = await buildPeer(peerId)
    const channel = peer.createDataChannel('stream', { ordered: true })
    const server = serveFileOverChannel(channel, file)
    channel.onopen = () => { clearWatchdog(peerId); setStatus('streaming') }
    peersRef.current.set(peerId, { peer, server })
    armWatchdog(peerId)
  }, [socket, signalEvent, teardownPeer, armWatchdog, clearWatchdog])

  /**
   * Receiver side (streaming): await the host's 'stream' channel, bridge it to
   * the service worker, and hand back a playable URL via `onUrl`.
   */
  const streamFrom = useCallback(async (peerId, key, meta, onUrl) => {
    teardownPeer(peerId)
    setStatus('connecting')
    const peer = await buildPeer(peerId)
    peer.pc.ondatachannel = ({ channel }) => {
      if (channel.label !== 'stream') return
      const ready = () => createStreamUrl(channel, key, meta)
        .then((stream) => {
          const entry = peersRef.current.get(peerId)
          if (entry) entry.stream = stream
          setStatus('streaming')
          onUrl(stream.url)
        })
        .catch((err) => {
          console.error('stream setup failed:', err)
          setStatus('error')
        })
      if (channel.readyState === 'open') ready()
      else channel.onopen = ready
    }
    peersRef.current.set(peerId, { peer })
    armWatchdog(peerId)
  }, [socket, signalEvent, teardownPeer, armWatchdog])

  return {
    status,
    setStatus,
    uploadProgress,
    downloadProgress,
    sendTo,
    receiveFrom,
    serveTo,
    streamFrom,
    cancelAll,
  }
}
