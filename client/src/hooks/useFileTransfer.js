import { useCallback, useEffect, useRef, useState } from 'react'
import { createPeer, isPolite } from '../lib/p2p/peer'
import { createSender, createReceiver } from '../lib/p2p/transfer'

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
export function useFileTransfer({ socket, signalEvent, onFileReceived, onAllReceived }) {
  const [status, setStatus] = useState('idle') // idle|connecting|transferring|complete|error
  const [uploadProgress, setUploadProgress] = useState({})
  const [downloadProgress, setDownloadProgress] = useState({})

  const peersRef = useRef(new Map()) // remote socketId -> {peer, sender?, receiver?}
  const callbacksRef = useRef({ onFileReceived, onAllReceived })
  callbacksRef.current = { onFileReceived, onAllReceived }

  const teardownPeer = useCallback((peerId) => {
    const entry = peersRef.current.get(peerId)
    if (!entry) return
    entry.sender?.stop()
    entry.receiver?.stop()
    entry.peer.close()
    peersRef.current.delete(peerId)
    if (peersRef.current.size === 0) setStatus((s) => (s === 'complete' ? s : 'idle'))
  }, [])

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
      polite: isPolite(socket.id, peerId),
      iceServers,
      onConnectionState: (state) => {
        if (state === 'failed' || state === 'closed') {
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
      },
      onComplete: () => setStatus('complete'),
      onError: (err) => {
        console.error('send failed:', err)
        setStatus('error')
      },
    })
    sender.start()
    peersRef.current.set(peerId, { peer, sender })
  }, [socket, signalEvent, teardownPeer])

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
  }, [socket, signalEvent, teardownPeer])

  return {
    status,
    setStatus,
    uploadProgress,
    downloadProgress,
    sendTo,
    receiveFrom,
    cancelAll,
  }
}
