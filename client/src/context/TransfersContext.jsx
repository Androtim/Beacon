import { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react'
import { useSocket } from '../hooks/useSocket'
import { useFileTransfer } from '../hooks/useFileTransfer'
import { cleanupTransfer } from '../lib/p2p/transfer'
import JSZip from 'jszip'

// App-level home for a share-code file transfer. Living here (above the router)
// is what lets a transfer keep running when you navigate away from the Files
// page — the backbone of the "open sessions" sidebar.

const TransfersContext = createContext(null)
export const useTransfers = () => useContext(TransfersContext)

export function formatFileSize(bytes) {
  if (!bytes) return '0 Bytes'
  const k = 1024, sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export function TransfersProvider({ children }) {
  const socket = useSocket()
  const [mode, setMode] = useState('idle') // idle | sharing | receiving
  const [shareCode, setShareCode] = useState('')
  const [selectedFiles, setSelectedFiles] = useState([])
  const [pendingFiles, setPendingFiles] = useState([])
  const [hostId, setHostId] = useState(null)
  const [joinError, setJoinError] = useState('')
  const [receiverPhase, setReceiverPhase] = useState('connecting') // connecting | ready

  const filesRef = useRef([])
  const receivedFilesRef = useRef([])
  const shareCodeRef = useRef('')
  shareCodeRef.current = shareCode

  const handleAllReceived = useCallback(async () => {
    const received = receivedFilesRef.current
    const save = (blob, name) => {
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = name
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    }
    if (received.length > 1) {
      const zip = new JSZip()
      received.forEach(({ file }) => zip.file(file.name, file))
      save(await zip.generateAsync({ type: 'blob' }), `beacon_files_${shareCodeRef.current || 'shared'}.zip`)
    } else if (received.length === 1) {
      save(received[0].file, received[0].file.name)
    }
  }, [])

  const {
    status, uploadProgress, downloadProgress, sendTo, receiveFrom, cancelAll,
  } = useFileTransfer({
    socket,
    signalEvent: 'file-share-signal',
    onFileReceived: (file, meta) => { receivedFilesRef.current.push({ file, meta }) },
    onAllReceived: handleAllReceived,
  })

  const cancel = useCallback(() => {
    cancelAll()
    if (socket && shareCodeRef.current && mode === 'sharing') {
      socket.emit('file-share-cancel', { code: shareCodeRef.current })
    }
    if (shareCodeRef.current) cleanupTransfer(shareCodeRef.current)
    setMode('idle')
    setShareCode('')
    setSelectedFiles([])
    setPendingFiles([])
    setHostId(null)
    setJoinError('')
    receivedFilesRef.current = []
  }, [socket, mode, cancelAll])

  const createShare = useCallback((files) => {
    if (!files.length || !socket) return
    setSelectedFiles(files)
    filesRef.current = files
    const code = Math.random().toString(36).substring(2, 10).toUpperCase()
    setShareCode(code)
    setMode('sharing')
    socket.emit('file-share-create', { code, files: files.map((f) => ({ name: f.name, size: f.size, type: f.type })) })
  }, [socket])

  const joinShare = useCallback((code) => {
    if (!socket || code.length !== 8) return
    setShareCode(code)
    setMode('receiving')
    setReceiverPhase('connecting')
    setJoinError('')
    receivedFilesRef.current = []
    socket.emit('file-share-join', { code })
  }, [socket])

  const startDownload = useCallback(async () => {
    if (!hostId) return
    await receiveFrom(hostId, shareCodeRef.current)
    socket.emit('file-share-request', { to: hostId })
  }, [hostId, receiveFrom, socket])

  // Socket orchestration — lives here so it persists across navigation.
  useEffect(() => {
    if (!socket) return
    const onInfo = (data) => { setPendingFiles(data.files); setHostId(data.hostId); setReceiverPhase('ready') }
    const onShareError = (data) => { setJoinError(data.message); setReceiverPhase('error') }
    const onRequest = (data) => { if (filesRef.current.length > 0) sendTo(data.from, filesRef.current, shareCodeRef.current) }
    socket.on('file-share-info', onInfo)
    socket.on('file-share-error', onShareError)
    socket.on('file-share-request', onRequest)
    return () => {
      socket.off('file-share-info', onInfo)
      socket.off('file-share-error', onShareError)
      socket.off('file-share-request', onRequest)
    }
  }, [socket, sendTo])

  const receiverStatus = receiverPhase === 'error' ? 'error'
    : status === 'error' ? 'error'
    : status === 'transferring' ? 'transferring'
    : status === 'complete' ? 'complete'
    : receiverPhase

  // Overall progress for the sidebar — the furthest-behind file.
  const progressValues = mode === 'sharing'
    ? selectedFiles.map((f) => uploadProgress[f.name] || 0)
    : Object.values(downloadProgress)
  const overallPercent = progressValues.length ? Math.min(...progressValues) : 0

  const value = {
    mode, shareCode, selectedFiles, pendingFiles, hostId, joinError,
    status, uploadProgress, downloadProgress, receiverStatus, overallPercent,
    active: mode !== 'idle',
    createShare, joinShare, startDownload, cancel, formatFileSize,
  }

  return <TransfersContext.Provider value={value}>{children}</TransfersContext.Provider>
}
