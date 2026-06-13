import { useState, useRef, useEffect, useCallback } from 'react'
import { useFileTransfer } from './useFileTransfer'

// Group file sharing. The offer is broadcast as a 'file-offer' group message;
// each downloader then handshakes 1:1 with the sharer over the dedicated
// group-file-* signal channel. The sharer serves every requester in parallel
// and tracks per-member progress so the UI can show aggregate status
// (how many are downloading + the furthest-behind percent).
export function useGroupFiles({ socket, me }) {
  // Outgoing shares I'm hosting: { transferId, fileInfo, recipients: { userId: percent } }
  const [shares, setShares] = useState([])
  // Incoming downloads I've started: { transferId, sharerId, fileInfo, percent, status }
  const [downloads, setDownloads] = useState([])
  const filesRef = useRef(new Map())  // transferId -> File (mine to serve)
  const incomingRef = useRef(null)    // active incoming { transferId, sharerId }

  const onFileReceived = useCallback((file) => {
    const url = URL.createObjectURL(file)
    const a = document.createElement('a')
    a.href = url; a.download = file.name; a.click()
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
    const inc = incomingRef.current
    if (inc) setDownloads((d) => d.map((x) => (x.transferId === inc.transferId ? { ...x, status: 'saved', percent: 100 } : x)))
  }, [])

  const onUploadProgress = useCallback(({ peerId, transferId, percent }) => {
    setShares((s) => s.map((sh) =>
      sh.transferId === transferId ? { ...sh, recipients: { ...sh.recipients, [peerId]: percent } } : sh))
  }, [])

  const {
    downloadProgress, sendTo, receiveFrom, cancelAll,
  } = useFileTransfer({ socket, signalEvent: 'group-file-signal', selfId: me?.id, onFileReceived, onUploadProgress })

  // Reflect my single active download's progress.
  useEffect(() => {
    const inc = incomingRef.current
    const p = downloadProgress[0]
    if (inc && p != null) {
      setDownloads((d) => d.map((x) => (x.transferId === inc.transferId ? { ...x, percent: p, status: p >= 100 ? 'saved' : 'downloading' } : x)))
    }
  }, [downloadProgress])

  // A group member is asking to download a file I shared — serve them.
  useEffect(() => {
    if (!socket) return
    const onRequest = ({ from, transferId }) => {
      const file = filesRef.current.get(transferId)
      if (!file) return
      setShares((s) => s.map((sh) =>
        sh.transferId === transferId ? { ...sh, recipients: { ...sh.recipients, [from]: sh.recipients[from] ?? 0 } } : sh))
      sendTo(from, [file], transferId)
    }
    socket.on('group-file-request', onRequest)
    return () => socket.off('group-file-request', onRequest)
  }, [socket, sendTo])

  // Share a file into a group. Returns the message payload so the caller can
  // echo it locally (the server only fans out to the other members).
  const shareFile = useCallback((group, file) => {
    if (!socket || !file) return null
    const transferId = `grp-${Math.random().toString(36).slice(2)}`
    const fileInfo = { name: file.name, size: file.size, type: file.type }
    filesRef.current.set(transferId, file)
    setShares((s) => [...s, { transferId, fileInfo, recipients: {} }])
    const timestamp = Date.now()
    socket.emit('group-message', {
      groupId: group.id, body: `📎 ${file.name}`, timestamp, kind: 'file-offer', meta: { transferId, fileInfo },
    })
    return { transferId, fileInfo, timestamp }
  }, [socket])

  // Download a file someone shared in a group.
  const downloadFile = useCallback(async ({ transferId, sharerId, fileInfo }) => {
    if (!socket) return
    incomingRef.current = { transferId, sharerId }
    setDownloads((d) => [...d.filter((x) => x.transferId !== transferId), { transferId, sharerId, fileInfo, percent: 0, status: 'downloading' }])
    await receiveFrom(sharerId, transferId)
    socket.emit('group-file-request', { to: sharerId, transferId })
  }, [socket, receiveFrom])

  useEffect(() => cancelAll, [cancelAll])

  return { shares, downloads, shareFile, downloadFile }
}
