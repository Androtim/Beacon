import { useState, useRef, useEffect, useCallback } from 'react'
import { Upload, Download, Copy, Check, X, FileIcon, Share2, Loader, Box, ArrowRight, ShieldCheck, Zap } from 'lucide-react'
import SimplePeer from 'simple-peer'
import JSZip from 'jszip'
import { motion, AnimatePresence } from 'framer-motion'

// Detect if running in Chrome
const isChrome = () => {
  return /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor)
}

export default function FileShare({ socket }) {
  const [mode, setMode] = useState('idle') // idle, sharing, receiving
  const [shareCode, setShareCode] = useState('')
  const [inputCode, setInputCode] = useState('')
  const [selectedFiles, setSelectedFiles] = useState([])
  const [sharingStatus, setSharingStatus] = useState('idle') // idle, waiting, transferring, complete, error
  const [downloadProgress, setDownloadProgress] = useState({})
  const [uploadProgress, setUploadProgress] = useState({})
  const [copied, setCopied] = useState(false)
  const [pendingFiles, setPendingFiles] = useState([])
  const [peerId, setPeerId] = useState(null)
  
  const fileInputRef = useRef(null)
  const peersRef = useRef({})
  const filesRef = useRef({})
  const chunksRef = useRef({})

  // Generate random 8-digit code
  const generateShareCode = () => {
    return Math.random().toString(36).substring(2, 10).toUpperCase()
  }

  // Send file via WebRTC
  const sendFile = useCallback(async (peer, file, fileIndex) => {
    const chunkSize = 64 * 1024 // 64KB chunks
    const totalChunks = Math.ceil(file.size / chunkSize)
    
    peer.send(JSON.stringify({
      type: 'file-meta',
      fileIndex,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      totalChunks
    }))
    
    const bufferThreshold = 64 * 1024
    
    for (let index = 0; index < totalChunks; index++) {
      try {
        const start = index * chunkSize
        const end = Math.min(start + chunkSize, file.size)
        const chunk = await file.slice(start, end).arrayBuffer()
        
        peer.send(JSON.stringify({
          type: 'binary-chunk-header',
          fileIndex,
          index,
          total: totalChunks,
          size: chunk.byteLength
        }))
        
        await new Promise(resolve => setTimeout(resolve, 2))
        peer.send(chunk)
        
        if (peer._channel && peer._channel.bufferedAmount > bufferThreshold) {
          await new Promise(resolve => {
            const checkBuffer = () => {
              if (peer._channel.bufferedAmount <= bufferThreshold) resolve()
              else setTimeout(checkBuffer, 10)
            }
            checkBuffer()
          })
        }
        
        if (index % 10 === 0 || index === totalChunks - 1) {
          const progress = Math.round(((index + 1) / totalChunks) * 100)
          setUploadProgress(prev => ({ ...prev, [file.name]: progress }))
        }
      } catch (err) {
        console.error(`Error sending chunk ${index}:`, err)
        await new Promise(resolve => setTimeout(resolve, 500))
        index--
      }
    }

    peer.send(JSON.stringify({ type: 'file-complete', fileIndex, fileName: file.name }))
  }, [])

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files)
    if (files.length === 0) return
    const totalSize = files.reduce((sum, file) => sum + file.size, 0)
    if (totalSize > 10 * 1024 * 1024 * 1024) {
      alert('Total file size exceeds 10GB limit')
      return
    }
    setSelectedFiles(files)
    filesRef.current = files
    const code = generateShareCode()
    setShareCode(code)
    setMode('sharing')
    setSharingStatus('waiting')
    socket.emit('file-share-create', {
      code,
      files: files.map(f => ({ name: f.name, size: f.size, type: f.type }))
    })
    e.target.value = null
  }

  const joinFileShare = () => {
    if (!inputCode.trim() || inputCode.length !== 8) return
    setMode('receiving')
    setSharingStatus('waiting')
    socket.emit('file-share-join', { code: inputCode.toUpperCase() })
  }

  const copyShareCode = async () => {
    await navigator.clipboard.writeText(shareCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const cancelTransfer = () => {
    Object.values(peersRef.current).forEach(peer => peer?.destroy?.())
    peersRef.current = {}
    setMode('idle')
    setSharingStatus('idle')
    setShareCode('')
    setInputCode('')
    setSelectedFiles([])
    setPendingFiles([])
    setDownloadProgress({})
    setUploadProgress({})
    chunksRef.current = {}
    if (shareCode) socket.emit('file-share-cancel', { code: shareCode })
  }

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  useEffect(() => {
    if (!socket) return

    const handleFileShareInfo = ({ files, hostId }) => {
      setPendingFiles(files)
      setPeerId(hostId)
      setSharingStatus('ready')
    }

    const handleFileShareRequest = ({ from }) => {
      const peer = new SimplePeer({ 
        initiator: false, 
        trickle: true,
        config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' }] }
      })
      peersRef.current[from] = peer
      peer.on('signal', signal => socket.emit('file-share-signal', { to: from, signal }))
      peer.on('connect', async () => {
        setSharingStatus('transferring')
        for (let i = 0; i < filesRef.current.length; i++) await sendFile(peer, filesRef.current[i], i)
        setSharingStatus('complete')
      })
      peer.on('error', () => setSharingStatus('error'))
      socket.emit('file-share-ready', { to: from, fileInfo: filesRef.current })
    }

    const handleFileShareReady = ({ from }) => {
      const peer = new SimplePeer({ 
        initiator: true, 
        trickle: true,
        config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' }] }
      })
      peersRef.current[from] = peer
      peer.on('signal', signal => socket.emit('file-share-signal', { to: from, signal }))
      
      let expectingBinaryChunk = null
      peer.on('data', data => {
        try {
          if (expectingBinaryChunk) {
            const fileData = chunksRef.current[expectingBinaryChunk.fileIndex]
            if (fileData) {
              fileData.chunks[expectingBinaryChunk.index] = new Uint8Array(data)
              const progress = Math.round(((expectingBinaryChunk.index + 1) / expectingBinaryChunk.total) * 100)
              setDownloadProgress(prev => ({ ...prev, [fileData.fileName]: progress }))
            }
            expectingBinaryChunk = null
            return
          }
          const message = JSON.parse(data.toString())
          if (message.type === 'file-meta') {
            chunksRef.current[message.fileIndex] = { ...message, chunks: [] }
            setDownloadProgress(prev => ({ ...prev, [message.fileName]: 0 }))
          } else if (message.type === 'binary-chunk-header') {
            expectingBinaryChunk = message
          } else if (message.type === 'file-complete') {
            const fileData = chunksRef.current[message.fileIndex]
            if (fileData) fileData.blob = new Blob(fileData.chunks, { type: fileData.fileType })
            const allFilesData = Object.values(chunksRef.current)
            if (allFilesData.every(f => f.blob)) {
              setSharingStatus('complete')
              if (allFilesData.length > 1) {
                const zip = new JSZip()
                allFilesData.forEach(f => zip.file(f.fileName, f.blob))
                zip.generateAsync({ type: 'blob' }).then(blob => {
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url; a.download = `beacon_files.zip`; a.click()
                })
              } else {
                const f = allFilesData[0]
                const url = URL.createObjectURL(f.blob)
                const a = document.createElement('a')
                a.href = url; a.download = f.fileName; a.click()
              }
            }
          }
        } catch (err) {}
      })
      peer.on('connect', () => setSharingStatus('transferring'))
      peer.on('error', () => setSharingStatus('error'))
    }

    const handleSignal = ({ from, signal }) => peersRef.current[from]?.signal(signal)
    socket.on('file-share-info', handleFileShareInfo)
    socket.on('file-share-request', handleFileShareRequest)
    socket.on('file-share-ready', handleFileShareReady)
    socket.on('file-share-signal', handleSignal)
    return () => {
      socket.off('file-share-info')
      socket.off('file-share-request')
      socket.off('file-share-ready')
      socket.off('file-share-signal')
    }
  }, [socket, sendFile])

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-violet-500/10 rounded-xl flex items-center justify-center border border-violet-500/20">
            <Share2 className="h-6 w-6 text-violet-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Direct Transfer</h2>
            <p className="text-slate-400 text-sm">Encrypted P2P file delivery protocol.</p>
          </div>
        </div>
        {mode !== 'idle' && (
          <button onClick={cancelTransfer} className="p-2 hover:bg-white/5 rounded-full transition-colors text-slate-500 hover:text-white">
            <X className="h-6 w-6" />
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {mode === 'idle' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid md:grid-cols-2 gap-6">
            <div className="glass-card p-8 border-violet-500/10 hover:border-violet-500/30 transition-colors group">
              <Upload className="h-10 w-10 text-violet-400 mb-4 group-hover:-translate-y-1 transition-transform" />
              <h3 className="text-xl font-bold mb-2 text-white">Transmit</h3>
              <p className="text-slate-400 text-sm mb-6">Upload up to 10GB of data. Your files stay on your device until requested.</p>
              <input ref={fileInputRef} type="file" multiple onChange={handleFileSelect} className="hidden" />
              <button onClick={() => fileInputRef.current?.click()} className="w-full glass-button">
                SELECT CARGO
              </button>
            </div>

            <div className="glass-card p-8 border-cyan-500/10 hover:border-cyan-500/30 transition-colors group">
              <Download className="h-10 w-10 text-cyan-400 mb-4 group-hover:translate-y-1 transition-transform" />
              <h3 className="text-xl font-bold mb-2 text-white">Intercept</h3>
              <p className="text-slate-400 text-sm mb-6">Receive files directly from another operator using a specific access code.</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inputCode}
                  onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                  placeholder="ACCESS CODE"
                  className="glass-input !py-2.5 flex-1 font-mono tracking-widest text-center"
                />
                <button onClick={joinFileShare} disabled={inputCode.length !== 8} className="glass-button !from-cyan-500 !to-cyan-400 !px-4 disabled:opacity-30">
                  <ArrowRight className="h-5 w-5" />
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {mode === 'sharing' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="glass-card p-8 bg-violet-500/[0.02] border-violet-500/20 text-center relative overflow-hidden">
               <div className="absolute top-0 right-0 p-4">
                  <ShieldCheck className="h-6 w-6 text-violet-500/30" />
               </div>
               <p className="text-violet-400 text-xs font-bold tracking-[0.3em] uppercase mb-4">Transmission Ready</p>
               <div className="flex items-center justify-center gap-6 mb-2">
                 {shareCode.split('').map((char, i) => (
                   <span key={i} className="text-4xl md:text-5xl font-bold text-white font-mono">{char}</span>
                 ))}
               </div>
               <button onClick={copyShareCode} className="mt-4 text-xs font-bold text-slate-500 hover:text-violet-400 transition-colors flex items-center gap-2 mx-auto uppercase tracking-widest">
                 {copied ? <><Check className="h-3 w-3" /> Copied to Clipboard</> : <><Copy className="h-3 w-3" /> Copy Secure Code</>}
               </button>
            </div>

            <div className="glass-card overflow-hidden">
              <div className="px-6 py-4 border-b border-white/5 bg-white/5 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Cargo manifest</span>
                <span className="text-xs text-slate-500">{selectedFiles.length} Object(s)</span>
              </div>
              <div className="p-4 space-y-2 max-h-60 overflow-y-auto">
                {selectedFiles.map((file, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                    <div className="flex items-center gap-3">
                       <div className="p-2 bg-white/5 rounded-lg"><FileIcon className="h-4 w-4 text-violet-400" /></div>
                       <div className="flex flex-col">
                          <span className="text-sm font-medium text-white truncate max-w-[200px]">{file.name}</span>
                          <span className="text-[10px] text-slate-500 uppercase tracking-wider">{formatFileSize(file.size)}</span>
                       </div>
                    </div>
                    {uploadProgress[file.name] > 0 && (
                        <div className="flex items-center gap-3">
                           <span className="text-xs font-mono text-violet-400">{uploadProgress[file.name]}%</span>
                           <div className="w-20 h-1 bg-white/10 rounded-full overflow-hidden">
                             <motion.div initial={{ width: 0 }} animate={{ width: `${uploadProgress[file.name]}%` }} className="h-full bg-violet-500" />
                           </div>
                        </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {sharingStatus === 'waiting' && (
              <div className="flex items-center justify-center gap-3 py-4">
                <Loader className="h-4 w-4 text-violet-400 animate-spin" />
                <span className="text-sm text-slate-400 animate-pulse">Scanning for recipient connection...</span>
              </div>
            )}
          </motion.div>
        )}

        {mode === 'receiving' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="glass-card p-6 border-cyan-500/20 bg-cyan-500/[0.02] flex items-center justify-between">
              <div>
                <p className="text-cyan-400 text-[10px] font-bold tracking-[0.3em] uppercase mb-1">Incoming Stream</p>
                <p className="text-2xl font-mono font-bold text-white tracking-widest">{inputCode}</p>
              </div>
              <div className="px-4 py-2 bg-cyan-500/10 rounded-xl border border-cyan-500/20 text-cyan-400 text-xs font-bold">
                SECURE CHANNEL
              </div>
            </div>

            {sharingStatus === 'ready' && (
              <div className="glass-card overflow-hidden">
                <div className="p-6">
                   <h3 className="text-lg font-bold text-white mb-4">Objects Detected</h3>
                   <div className="space-y-2 mb-6">
                      {pendingFiles.map((file, i) => (
                        <div key={i} className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                           <div className="flex items-center gap-3">
                             <FileIcon className="h-4 w-4 text-cyan-400" />
                             <span className="text-sm text-white">{file.name}</span>
                           </div>
                           <span className="text-xs text-slate-500">{formatFileSize(file.size)}</span>
                        </div>
                      ))}
                   </div>
                   <button onClick={() => socket.emit('file-share-request', { to: peerId })} className="w-full glass-button !from-cyan-500 !to-cyan-400">
                     INITIATE DOWNLOAD
                   </button>
                </div>
              </div>
            )}

            {sharingStatus === 'transferring' && (
              <div className="glass-card p-6">
                 <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Pulling Data</h3>
                 <div className="space-y-4">
                    {Object.entries(downloadProgress).map(([name, prog]) => (
                      <div key={name} className="space-y-2">
                        <div className="flex justify-between text-xs">
                           <span className="text-white font-medium">{name}</span>
                           <span className="text-cyan-400 font-mono">{prog}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                           <motion.div initial={{ width: 0 }} animate={{ width: `${prog}%` }} className="h-full bg-cyan-500 shadow-[0_0_10px_rgba(34,211,238,0.5)]" />
                        </div>
                      </div>
                    ))}
                 </div>
              </div>
            )}

            {sharingStatus === 'complete' && (
              <div className="glass-card p-10 text-center border-green-500/20 bg-green-500/[0.02]">
                 <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-green-500/20">
                    <Check className="h-8 w-8 text-green-400" />
                 </div>
                 <h3 className="text-2xl font-bold text-white mb-2">Payload Received</h3>
                 <p className="text-slate-400 text-sm mb-6">All objects have been successfully intercepted and stored.</p>
                 <button onClick={cancelTransfer} className="glass-button !from-green-600 !to-green-500 !shadow-green-500/20">
                    TERMINATE SESSION
                 </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
