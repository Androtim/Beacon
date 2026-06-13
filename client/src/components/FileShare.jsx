import { useState, useRef, useEffect, useCallback } from 'react'
import { Upload, Download, Copy, Check, X, FileIcon, Share2, ShieldCheck, Zap, AlertCircle } from 'lucide-react'
import { useFileTransfer } from '../hooks/useFileTransfer'
import { cleanupTransfer } from '../lib/p2p/transfer'
import JSZip from 'jszip'
import { motion, AnimatePresence } from 'framer-motion'

export default function FileShare({ socket }) {
  const [mode, setMode] = useState('idle') // idle, sharing, receiving
  const [shareCode, setShareCode] = useState('')
  const [inputCode, setInputCode] = useState('')
  const [selectedFiles, setSelectedFiles] = useState([])
  const [copied, setCopied] = useState(false)

  const [pendingFiles, setPendingFiles] = useState([])
  const [hostId, setHostId] = useState(null)
  const [joinError, setJoinError] = useState('')
  const [receiverPhase, setReceiverPhase] = useState('connecting') // connecting|ready (pre-transfer UI)

  const fileInputRef = useRef(null)
  const filesRef = useRef([])
  const receivedFilesRef = useRef([])
  const shareCodeRef = useRef('')
  shareCodeRef.current = shareCode

  const formatFileSize = useCallback((bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024, sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }, [])

  // Save everything once the transfer finishes (zip when multiple files),
  // then clear the resumable partials from disk.
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
    // OPFS partials are cleared on "Return to Dashboard" (cancelTransfer), not
    // here — the blob being downloaded still references the OPFS bytes.
  }, [])

  const {
    status, uploadProgress, downloadProgress, sendTo, receiveFrom, cancelAll,
  } = useFileTransfer({
    socket,
    signalEvent: 'file-share-signal',
    onFileReceived: (file, meta) => { receivedFilesRef.current.push({ file, meta }) },
    onAllReceived: handleAllReceived,
  })

  const cancelTransfer = useCallback(() => {
    cancelAll()
    if (socket && shareCodeRef.current && mode === 'sharing') {
      socket.emit('file-share-cancel', { code: shareCodeRef.current })
    }
    if (shareCodeRef.current) cleanupTransfer(shareCodeRef.current)
    setMode('idle')
    setShareCode('')
    setInputCode('')
    setSelectedFiles([])
    setPendingFiles([])
    setHostId(null)
    setJoinError('')
    receivedFilesRef.current = []
  }, [socket, mode, cancelAll])

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files)
    if (files.length === 0) return

    setSelectedFiles(files)
    filesRef.current = files

    const code = Math.random().toString(36).substring(2, 10).toUpperCase()
    setShareCode(code)
    setMode('sharing')

    socket.emit('file-share-create', {
      code,
      files: files.map((f) => ({ name: f.name, size: f.size, type: f.type })),
    })
    e.target.value = null
  }

  const joinFileShare = () => {
    if (inputCode.trim().length !== 8) return
    const code = inputCode.trim().toUpperCase()
    setShareCode(code)
    setMode('receiving')
    setReceiverPhase('connecting')
    setJoinError('')
    receivedFilesRef.current = []
    socket.emit('file-share-join', { code })
  }

  const handleStartDownload = async () => {
    if (!hostId) return
    // Prepare to answer the host's dial, then ask the host to start. The
    // transfer protocol resumes automatically from any partial on disk.
    await receiveFrom(hostId, shareCodeRef.current)
    socket.emit('file-share-request', { to: hostId })
  }

  useEffect(() => {
    if (!socket) return

    const onInfo = (data) => {
      setPendingFiles(data.files)
      setHostId(data.hostId)
      setReceiverPhase('ready')
    }
    const onShareError = (data) => {
      setJoinError(data.message)
      setReceiverPhase('error')
    }
    // Host: a receiver asked for the files — dial them and stream.
    const onRequest = (data) => {
      if (filesRef.current.length > 0) sendTo(data.from, filesRef.current, shareCodeRef.current)
    }

    socket.on('file-share-info', onInfo)
    socket.on('file-share-error', onShareError)
    socket.on('file-share-request', onRequest)
    return () => {
      socket.off('file-share-info', onInfo)
      socket.off('file-share-error', onShareError)
      socket.off('file-share-request', onRequest)
    }
  }, [socket, sendTo])

  // What the receiver pane should show right now.
  const receiverStatus = receiverPhase === 'error' ? 'error'
    : status === 'transferring' ? 'transferring'
    : status === 'complete' ? 'complete'
    : receiverPhase // connecting | ready

  return (
    <div className="flex flex-col gap-6 max-w-xl mx-auto py-4 font-sans">
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl">
            <Share2 size={22} className="animate-pulse" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">P2P File Transfer</h2>
            <p className="text-xs text-slate-400 dark:text-slate-500">Encrypted direct browser-to-browser pipe · resumable</p>
          </div>
        </div>
        {mode !== 'idle' && (
          <button
            onClick={cancelTransfer}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"
            data-testid="fileshare-cancel"
          >
            <X size={18} />
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {mode === 'idle' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-1 sm:grid-cols-2 gap-6"
          >
            {/* Sender panel */}
            <div className="glass-card p-6 flex flex-col justify-between hover:border-blue-500/30 transition-all duration-300 group border border-slate-200/50 dark:border-slate-800">
              <div>
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform duration-300">
                  <Upload size={24} />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">Send Files</h3>
                <p className="text-xs text-slate-400 dark:text-slate-500 mb-6 leading-relaxed">
                  Stream files directly from your device. No servers store your files; interrupted transfers resume where they left off.
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileSelect}
                className="hidden"
                data-testid="fileshare-input"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="btn btn-primary w-full h-11 text-xs uppercase tracking-wider"
              >
                Choose Files
              </button>
            </div>

            {/* Receiver panel */}
            <div className="glass-card p-6 flex flex-col justify-between hover:border-emerald-500/30 transition-all duration-300 group border border-slate-200/50 dark:border-slate-800">
              <div>
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform duration-300">
                  <Download size={24} />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">Receive Files</h3>
                <p className="text-xs text-slate-400 dark:text-slate-500 mb-6 leading-relaxed">
                  Enter an 8-character intercept code to build a secure WebRTC pipeline to the sender.
                </p>
              </div>
              <div className="space-y-3">
                <input
                  type="text"
                  value={inputCode}
                  onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                  placeholder="CODE (E.G. A1B2C3D4)"
                  className="input-field text-center font-mono uppercase tracking-widest h-11"
                  maxLength={8}
                  onKeyDown={(e) => e.key === 'Enter' && inputCode.length === 8 && joinFileShare()}
                  data-testid="fileshare-code-input"
                />
                <button
                  onClick={joinFileShare}
                  disabled={inputCode.length !== 8}
                  className="btn bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 w-full h-11 text-xs uppercase tracking-wider"
                  data-testid="fileshare-join"
                >
                  Join Transfer
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {mode === 'sharing' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
          >
            {/* Share Code Presentation */}
            <div className="glass-card p-6 text-center border border-blue-500/20 bg-blue-500/5">
              <ShieldCheck className="text-blue-500 dark:text-blue-400 mx-auto mb-3" size={36} />
              <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-3">Secure Intercept Coordinate</p>
              <div className="flex items-center justify-center gap-1.5 mb-4" data-testid="fileshare-code">
                {shareCode.split('').map((char, i) => (
                  <span
                    key={i}
                    className="w-9 h-11 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg flex items-center justify-center text-xl font-bold text-slate-850 dark:text-white font-mono shadow-sm"
                  >
                    {char}
                  </span>
                ))}
              </div>
              <button
                onClick={() => { navigator.clipboard.writeText(shareCode); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
                className="text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 flex items-center gap-1.5 mx-auto bg-slate-100 dark:bg-slate-800 py-1.5 px-3.5 rounded-lg transition-colors border border-slate-200/50 dark:border-slate-700/50"
              >
                {copied ? <><Check size={13} className="text-green-500 animate-bounce" /> Copied</> : <><Copy size={13} /> Copy Code</>}
              </button>
            </div>

            {/* Selected File List / Progress */}
            <div className="glass-card p-0 overflow-hidden border border-slate-200 dark:border-slate-800 shadow-lg">
              <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Transmitting Package</span>
                <span className="text-xs font-bold text-blue-600 dark:text-blue-400">{selectedFiles.length} file(s)</span>
              </div>
              <div className="p-4 space-y-3 max-h-[260px] overflow-y-auto">
                {selectedFiles.map((file, i) => {
                  const progress = uploadProgress[file.name] || 0
                  return (
                    <div key={i} className="flex flex-col gap-2 p-3 border border-slate-100 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-900/30">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 overflow-hidden">
                          <FileIcon size={16} className="text-blue-500 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{file.name}</p>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500">{formatFileSize(file.size)}</p>
                          </div>
                        </div>
                        {progress > 0 && (
                          <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">{progress}%</span>
                        )}
                      </div>
                      {progress > 0 && (
                        <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            className="h-full bg-blue-500 rounded-full"
                          />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </motion.div>
        )}

        {mode === 'receiving' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
          >
            {/* Connection coordinates header */}
            <div className="glass-card p-4 flex items-center justify-between bg-slate-50 dark:bg-slate-800/40 border border-slate-200/50 dark:border-slate-800">
              <div>
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-0.5">Intercept Code</p>
                <p className="text-lg font-bold font-mono tracking-widest text-slate-800 dark:text-white">{shareCode}</p>
              </div>
              <div className="px-3 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold rounded-lg border border-emerald-500/20">
                WebRTC Active
              </div>
            </div>

            {receiverStatus === 'error' && joinError && (
              <div className="glass-card p-5 border-red-500/20 bg-red-500/5 flex gap-3 items-center">
                <AlertCircle className="text-red-500 shrink-0" size={24} />
                <div>
                  <p className="text-xs font-bold text-red-500">Connection Failed</p>
                  <p className="text-xs text-slate-500 dark:text-slate-450 mt-0.5">{joinError}</p>
                </div>
              </div>
            )}

            {receiverStatus === 'connecting' && (
              <div className="glass-card p-8 text-center flex flex-col items-center justify-center border border-slate-200/50 dark:border-slate-800">
                <Zap className="text-blue-500 dark:text-blue-400 animate-bounce mb-3" size={32} fill="currentColor" />
                <p className="text-xs font-bold text-slate-650 dark:text-slate-350">Securing WebRTC channel...</p>
                <p className="text-[10px] text-slate-400 mt-1">Negotiating SDP coordinates with host</p>
              </div>
            )}

            {receiverStatus === 'ready' && pendingFiles.length > 0 && (
              <div className="glass-card p-6 border border-slate-200/50 dark:border-slate-800 shadow-xl space-y-5 animate-in slide-in-from-bottom-2 duration-300">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-white">Files Ready to Intercept</h3>
                  <p className="text-xs text-slate-400 dark:text-slate-500">Select accept to start browser streaming</p>
                </div>

                <div className="space-y-2.5 max-h-[200px] overflow-y-auto pr-1">
                  {pendingFiles.map((file, i) => (
                    <div key={i} className="flex items-center justify-between p-3 border border-slate-100 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-900/30">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <FileIcon size={16} className="text-emerald-500 shrink-0" />
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{file.name}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono shrink-0">{formatFileSize(file.size)}</span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={handleStartDownload}
                  className="btn btn-primary w-full h-12 font-bold text-xs uppercase tracking-widest shadow-blue-500/20"
                  data-testid="fileshare-accept"
                >
                  Accept & Stream Files
                </button>
              </div>
            )}

            {receiverStatus === 'transferring' && (
              <div className="glass-card p-6 border border-slate-200/50 dark:border-slate-800 shadow-lg space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-400 dark:text-slate-550 uppercase tracking-widest animate-pulse">Streaming Inbound Data</h3>
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">P2P Link Live</span>
                </div>

                <div className="space-y-4 max-h-[220px] overflow-y-auto">
                  {Object.entries(downloadProgress).map(([fileIndex, prog]) => (
                    <div key={fileIndex} className="space-y-2 p-2.5 border border-slate-100 dark:border-slate-800 rounded-xl bg-slate-50/30">
                      <div className="flex justify-between items-end gap-3">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate max-w-[80%]">
                          {pendingFiles[fileIndex]?.name ?? `File ${Number(fileIndex) + 1}`}
                        </span>
                        <span className="text-xs font-bold text-blue-600 dark:text-blue-400">{prog}%</span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${prog}%` }}
                          className="h-full bg-blue-500 rounded-full"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {receiverStatus === 'complete' && (
              <div className="glass-card p-8 text-center border border-emerald-500/20 bg-emerald-500/5 space-y-6" data-testid="fileshare-complete">
                <div className="w-14 h-14 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
                  <Check size={28} className="animate-bounce" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Payload Synchronized</h3>
                  <p className="text-xs text-slate-400 dark:text-slate-500 leading-relaxed mt-1">
                    All files were downloaded directly from the peer. Check your system's download folder.
                  </p>
                </div>
                <button
                  onClick={cancelTransfer}
                  className="btn btn-primary w-full h-11 text-xs uppercase tracking-wider"
                >
                  Return to Dashboard
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
