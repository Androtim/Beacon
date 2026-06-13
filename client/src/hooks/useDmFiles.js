import { useState, useRef, useEffect, useCallback } from 'react'
import { useFileTransfer } from './useFileTransfer'

// File-in-DM: P2P file transfers inside a 1:1 conversation, keyed by userId.
// One active transfer at a time per the current peer (simple + plenty for DMs).
export function useDmFiles({ socket, me }) {
  const [transfers, setTransfers] = useState([]) // {id, peerId, direction, fileInfo, status, percent}
  const filesRef = useRef(new Map())   // transferId -> File (outgoing)
  const incomingRef = useRef(null)     // active incoming { id, peerId }
  const activeOutRef = useRef(null)    // active outgoing file name -> id

  const upsert = useCallback((t) => setTransfers((ts) => {
    const i = ts.findIndex((x) => x.id === t.id)
    if (i === -1) return [...ts, t]
    const next = [...ts]; next[i] = { ...next[i], ...t }; return next
  }), [])
  const patch = useCallback((id, p) => setTransfers((ts) => ts.map((t) => (t.id === id ? { ...t, ...p } : t))), [])

  const onFileReceived = useCallback((file) => {
    const inc = incomingRef.current
    // Save to disk.
    const url = URL.createObjectURL(file)
    const a = document.createElement('a')
    a.href = url; a.download = file.name; a.click()
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
    if (inc) patch(inc.id, { status: 'saved', percent: 100 })
  }, [patch])

  const {
    uploadProgress, downloadProgress, sendTo, receiveFrom, cancelAll,
  } = useFileTransfer({ socket, signalEvent: 'dm-file-signal', selfId: me?.id, onFileReceived })

  // Reflect engine progress onto the active transfer bubbles.
  useEffect(() => {
    const name = activeOutRef.current
    if (name && uploadProgress[name] != null) {
      const id = filesRef.current.get('__id__:' + name)
      if (id) patch(id, { percent: uploadProgress[name], status: uploadProgress[name] >= 100 ? 'sent' : 'sending' })
    }
  }, [uploadProgress, patch])
  useEffect(() => {
    const inc = incomingRef.current
    const p = downloadProgress[0]
    if (inc && p != null) patch(inc.id, { percent: p, status: p >= 100 ? 'saved' : 'downloading' })
  }, [downloadProgress, patch])

  // Socket events for the DM file handshake.
  useEffect(() => {
    if (!socket) return
    const onOffer = ({ from, fromUsername, transferId, fileInfo }) => {
      upsert({ id: transferId, peerId: from, peerUsername: fromUsername, direction: 'in', fileInfo, status: 'offered', percent: 0 })
    }
    const onRequest = ({ from, transferId }) => {
      // Peer accepted our offer — start sending.
      const file = filesRef.current.get(transferId)
      if (!file) return
      activeOutRef.current = file.name
      filesRef.current.set('__id__:' + file.name, transferId)
      patch(transferId, { status: 'sending' })
      sendTo(from, [file], transferId)
    }
    const onDecline = ({ transferId }) => patch(transferId, { status: 'declined' })
    socket.on('dm-file-offer', onOffer)
    socket.on('dm-file-request', onRequest)
    socket.on('dm-file-decline', onDecline)
    return () => {
      socket.off('dm-file-offer', onOffer)
      socket.off('dm-file-request', onRequest)
      socket.off('dm-file-decline', onDecline)
    }
  }, [socket, sendTo, upsert, patch])

  const sendFile = useCallback((peerId, file) => {
    if (!socket || !file) return
    const transferId = `dm-${Math.random().toString(36).slice(2)}`
    filesRef.current.set(transferId, file)
    upsert({ id: transferId, peerId, direction: 'out', fileInfo: { name: file.name, size: file.size, type: file.type }, status: 'offered', percent: 0 })
    socket.emit('dm-file-offer', { to: peerId, transferId, fileInfo: { name: file.name, size: file.size, type: file.type } })
  }, [socket, upsert])

  const acceptFile = useCallback(async (transferId) => {
    const t = transfers.find((x) => x.id === transferId)
    if (!t) return
    incomingRef.current = { id: transferId, peerId: t.peerId }
    patch(transferId, { status: 'downloading' })
    await receiveFrom(t.peerId, transferId)
    socket.emit('dm-file-request', { to: t.peerId, transferId })
  }, [transfers, receiveFrom, socket, patch])

  // Seed transfers from persisted file-offer messages (history). Only adds
  // offers we don't already track, so a live transfer's progress is never
  // clobbered by a stale persisted copy.
  const hydrate = useCallback((seed) => {
    setTransfers((ts) => {
      const have = new Set(ts.map((t) => t.id))
      const add = seed.filter((s) => !have.has(s.id))
      return add.length ? [...ts, ...add] : ts
    })
  }, [])

  const declineFile = useCallback((transferId) => {
    const t = transfers.find((x) => x.id === transferId)
    if (t) socket.emit('dm-file-decline', { to: t.peerId, transferId })
    patch(transferId, { status: 'declined' })
  }, [transfers, socket, patch])

  useEffect(() => cancelAll, [cancelAll])

  return { transfers, sendFile, acceptFile, declineFile, hydrate }
}
