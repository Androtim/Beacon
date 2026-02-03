import { useState, useRef, useEffect, useCallback } from 'react'
import { Upload, Download, Copy, Check, X, FileIcon, Share2, Loader, Box, ArrowRight, ShieldCheck, Zap, Shield, Info, Plus } from 'lucide-react'
import SimplePeer from 'simple-peer'
import JSZip from 'jszip'
import { motion, AnimatePresence } from 'framer-motion'

// Detect if running in Chrome
const isChrome = () => {
  return /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor)
}

export default function FileShare({ socket }) {
  const [mode, setMode] = useState('idle') 
  const [shareCode, setShareCode] = useState('')
  const [inputCode, setInputCode] = useState('')
  const [selectedFiles, setSelectedFiles] = useState([])
  const [sharingStatus, setSharingStatus] = useState('idle') 
  const [downloadProgress, setDownloadProgress] = useState({})
  const [uploadProgress, setUploadProgress] = useState({})
  const [copied, setCopied] = useState(false)
  const [pendingFiles, setPendingFiles] = useState([])
  const [peerId, setPeerId] = useState(null)
  const [iceServers, setIceServers] = useState([])
  
  const fileInputRef = useRef(null)
  const peersRef = useRef({})
  const filesRef = useRef({})
  const chunksRef = useRef({})
  const expectingBinaryRef = useRef(null)

  // Fetch ICE servers on mount
  useEffect(() => {
    const fetchIceServers = async () => {
      try {
        const token = localStorage.getItem('token')
        const response = await fetch(`${window.location.origin}/api/ice-servers`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        const data = await response.json()
        setIceServers(data.iceServers)
      } catch (err) {
        setIceServers([{ urls: 'stun:stun.l.google.com:19302' }])
      }
    }
    fetchIceServers()
  }, [])

  // Generate random 8-digit code
  const generateShareCode = () => {
    return Math.random().toString(36).substring(2, 10).toUpperCase()
  }

  // Send file via WebRTC
  const sendFile = useCallback(async (peer, file, fileIndex) => {
    const chunkSize = 64 * 1024 
    const totalChunks = Math.ceil(file.size / chunkSize)
    
    // Header
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
          type: 'chunk-header',
          fileIndex,
          index,
          total: totalChunks,
          size: chunk.byteLength
        }))
        
        await new Promise(resolve => setTimeout(resolve, 1))
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
        console.error(`❌ Error sending chunk ${index}:`, err)
        break
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

  const cancelTransfer = useCallback(() => {
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
    expectingBinaryRef.current = null
    if (shareCode) socket.emit('file-share-cancel', { code: shareCode })
  }, [socket, shareCode])

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
        config: { iceServers }
      })
      peersRef.current[from] = peer
      peer.on('signal', signal => socket.emit('file-share-signal', { to: from, signal }))
      peer.on('connect', async () => {
        setSharingStatus('transferring')
        for (let i = 0; i < filesRef.current.length; i++) await sendFile(peer, filesRef.current[i], i)
        setSharingStatus('complete')
      })
      peer.on('error', () => setSharingStatus('error'))
    }

    const handleFileShareReady = ({ from }) => {
      const peer = new SimplePeer({ 
        initiator: true, 
        trickle: true,
        config: { iceServers }
      })
      peersRef.current[from] = peer
      peer.on('signal', signal => socket.emit('file-share-signal', { to: from, signal }))
      
      peer.on('data', data => {
        if (expectingBinaryRef.current) {
          const { fileIndex, index } = expectingBinaryRef.current
          const fileData = chunksRef.current[fileIndex]
          if (fileData) {
            fileData.chunks[index] = new Uint8Array(data)
            const progress = Math.round(((index + 1) / fileData.totalChunks) * 100)
            setDownloadProgress(prev => ({ ...prev, [fileData.fileName]: progress }))
          }
          expectingBinaryRef.current = null
          return
        }

        try {
          const message = JSON.parse(data.toString())
          if (message.type === 'file-meta') {
            chunksRef.current[message.fileIndex] = { ...message, chunks: [] }
            setDownloadProgress(prev => ({ ...prev, [message.fileName]: 0 }))
          } else if (message.type === 'chunk-header') {
            expectingBinaryRef.current = message
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
                  a.href = url; a.download = `payload.zip`; a.click()
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
  }, [socket, sendFile, iceServers])

  return (
    <div className="w-full max-w-4xl mx-auto p-4 sm:p-8 min-h-[600px] flex flex-col bg-[#0F172A] text-slate-200">
      <div className="flex items-center justify-between mb-12 shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-violet-600 to-violet-500 rounded-2xl flex items-center justify-center shadow-lg border border-white/5"><Share2 className="h-6 w-6 text-white" /></div>
          <div><h2 className="text-2xl font-bold text-white uppercase tracking-tight">Direct Payload</h2><p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">P2P Encrypted Relay</p></div>
        </div>
        {mode !== 'idle' && <button onClick={cancelTransfer} className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center hover:bg-white/10 transition-colors"><X className="h-5 w-5 text-slate-400" /></button>}
      </div>

      <AnimatePresence mode="wait">
        {mode === 'idle' && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="grid md:grid-cols-2 gap-8 flex-1 content-center">
            <div className="glass-card p-10 border-violet-500/10 hover:border-violet-500/30 transition-all group relative overflow-hidden">
              <Upload className="h-12 w-12 text-violet-400 mb-6 group-hover:-translate-y-1 transition-transform" />
              <h3 className="text-2xl font-bold mb-3 text-white tracking-tight">TRANSMIT</h3>
              <p className="text-slate-500 text-sm mb-8 leading-relaxed">Prepare cargo for direct peer intercept. Files stay on your device until requested.</p>
              <input ref={fileInputRef} type="file" multiple onChange={handleFileSelect} className="hidden" />
              <button onClick={() => fileInputRef.current?.click()} className="w-full glass-button group">
                <span>SELECT CARGO</span>
                <Plus className="h-4 w-4 group-hover:rotate-90 transition-transform" />
              </button>
            </div>
            <div className="glass-card p-10 border-cyan-500/10 hover:border-cyan-500/30 transition-all group relative overflow-hidden">
              <Download className="h-12 w-12 text-cyan-400 mb-6 group-hover:translate-y-1 transition-transform" />
              <h3 className="text-2xl font-bold mb-3 text-white tracking-tight">INTERCEPT</h3>
              <p className="text-slate-500 text-sm mb-8 leading-relaxed">Establish link to another operator using coordinates. Automatic assembly on delivery.</p>
              <div className="flex gap-3">
                <input type="text" value={inputCode} onChange={(e) => setInputCode(e.target.value.toUpperCase())} placeholder="COORDINATES" className="glass-input !py-3 flex-1 font-mono tracking-widest text-center" maxLength={8} />
                <button onClick={joinFileShare} disabled={inputCode.length !== 8} className="w-12 h-12 glass-button !p-0 !from-cyan-500 !to-cyan-400 disabled:opacity-20"><ArrowRight className="h-5 w-5" /></button>
              </div>
            </div>
          </motion.div>
        )}

        {mode === 'sharing' && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-8 flex-1">
            <div className="glass-card p-10 bg-violet-500/[0.02] border-violet-500/20 text-center relative overflow-hidden shadow-[0_0_50px_rgba(139,92,246,0.1)]">
               <ShieldCheck className="h-12 w-12 text-violet-400 mx-auto mb-6 opacity-50" />
               <p className="text-violet-400 text-[10px] font-bold tracking-[0.4em] uppercase mb-6">Link Established • Encrypted</p>
               <div className="flex items-center justify-center gap-4 mb-4">
                 {shareCode.split('').map((char, i) => (
                   <span key={i} className="w-12 h-14 bg-white/5 rounded-xl border border-white/10 flex items-center justify-center text-3xl font-bold text-white font-mono shadow-inner">{char}</span>
                 ))}
               </div>
               <button onClick={copyShareCode} className="mt-8 text-[10px] font-bold text-slate-500 hover:text-white transition-colors flex items-center gap-2 mx-auto uppercase tracking-widest">
                 {copied ? <><Check size={12} className="text-green-400" /> Copied</> : <><Copy size={12} /> Copy Coordinates</>}
               </button>
            </div>
            <div className="glass-card overflow-hidden border-white/5">
              <div className="px-6 py-4 border-b border-white/5 bg-white/5 flex items-center justify-between"><span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Cargo Manifest</span><span className="text-[10px] text-slate-500 font-mono">{selectedFiles.length} OBJECTS</span></div>
              <div className="p-4 space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                {selectedFiles.map((file, i) => (
                  <div key={i} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 animate-in slide-in-from-left duration-300">
                    <div className="flex items-center gap-4"><div className="p-2.5 bg-violet-500/10 rounded-xl"><FileIcon className="h-4 w-4 text-violet-400" /></div><div className="flex flex-col"><span className="text-sm font-bold text-white truncate max-w-[200px]">{file.name}</span><span className="text-[9px] text-slate-600 font-bold uppercase tracking-widest mt-0.5">{formatFileSize(file.size)}</span></div></div>
                    {uploadProgress[file.name] > 0 && <div className="flex items-center gap-4"><span className="text-xs font-mono font-bold text-violet-400">{uploadProgress[file.name]}%</span><div className="w-24 h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/5"><motion.div animate={{ width: `${uploadProgress[file.name]}%` }} className="h-full bg-violet-500 shadow-[0_0_10px_rgba(139,92,246,0.5)]" /></div></div>}
                  </div>
                ))}
              </div>
            </div>

            {sharingStatus === 'waiting' && (
              <div className="flex flex-col items-center justify-center gap-4 py-4 opacity-50">
                <Loader className="h-6 w-6 text-violet-500 animate-spin" />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] animate-pulse">Awaiting Intercept...</span>
              </div>
            )}
          </motion.div>
        )}

        {mode === 'receiving' && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-8 flex-1">
            <div className="glass-card p-8 border-cyan-500/20 bg-cyan-500/[0.02] flex items-center justify-between relative overflow-hidden">
              <div className="absolute -left-10 -bottom-10 w-32 h-32 bg-cyan-500/5 rounded-full blur-3xl" />
              <div><p className="text-cyan-400 text-[9px] font-bold tracking-[0.4em] uppercase mb-2">Target Coordinates</p><p className="text-3xl font-mono font-bold text-white tracking-[0.4em]">{inputCode}</p></div>
              <div className="px-5 py-2.5 bg-cyan-500/10 rounded-2xl border border-cyan-500/20 text-cyan-400 text-[10px] font-bold tracking-widest shadow-lg shadow-cyan-500/10">LINK SECURED</div>
            </div>
            {sharingStatus === 'ready' && (
              <div className="glass-card overflow-hidden border-white/5 animate-in slide-up duration-500">
                <div className="p-8">
                   <h3 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2"><Shield size={14} className="text-cyan-400" />Inbound Payload Detected</h3>
                   <div className="space-y-3 mb-8">
                      {pendingFiles.map((file, i) => (
                        <div key={i} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5"><div className="flex items-center gap-4"><div className="p-2.5 bg-cyan-500/10 rounded-xl"><FileIcon className="h-4 w-4 text-cyan-400" /></div><span className="text-sm font-bold text-white tracking-tight">{file.name}</span></div><span className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">{formatFileSize(file.size)}</span></div>
                      ))}
                   </div>
                   <button onClick={() => socket.emit('file-share-request', { to: peerId })} className="w-full glass-button !from-cyan-600 !to-cyan-500 !py-4 shadow-cyan-500/20">INITIALIZE PAYLOAD INTERCEPT</button>
                </div>
              </div>
            )}
            {sharingStatus === 'transferring' && (
              <div className="glass-card p-8 border-white/5">
                 <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-8">Pulling Data Streams</h3>
                 <div className="space-y-6">
                    {Object.entries(downloadProgress).map(([name, prog]) => (
                      <div key={name} className="space-y-3"><div className="flex justify-between items-end"><span className="text-sm font-bold text-white truncate max-w-[200px]">{name}</span><span className="text-cyan-400 font-mono font-bold text-lg">{prog}%</span></div><div className="w-full h-2 bg-white/5 rounded-full overflow-hidden border border-white/5">
                           <motion.div animate={{ width: `${prog}%` }} className="h-full bg-cyan-500 shadow-[0_0_15px_rgba(34,211,238,0.5)]" />
                        </div></div>
                    ))}
                 </div>
              </div>
            )}
            {sharingStatus === 'complete' && (
              <div className="glass-card p-12 text-center border-green-500/20 bg-green-500/[0.02] animate-in zoom-in-95 duration-500">
                 <div className="w-20 h-20 bg-green-500/10 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 border border-green-500/20 shadow-lg shadow-green-500/10"><Check size={32} className="text-green-400" /></div>
                 <h3 className="text-2xl font-bold text-white mb-3 uppercase tracking-tighter">Payload Received</h3>
                 <p className="text-slate-500 text-sm mb-10 leading-relaxed max-w-xs mx-auto">Point-to-point transfer complete. Cargo successfully stored in local memory.</p>
                 <button onClick={cancelTransfer} className="w-full glass-button !from-green-600 !to-green-500 !shadow-green-500/20">TERMINATE SESSION</button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      <div className="mt-auto pt-8 border-t border-white/5 flex items-center justify-between opacity-30 shrink-0"><div className="flex items-center gap-4"><div className="flex flex-col"><span className="text-[10px] font-bold text-white">AES-256</span><span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">Encryption</span></div><div className="w-px h-6 bg-white/10" /><div className="flex flex-col"><span className="text-[10px] font-bold text-white">DIRECT</span><span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">Protocol</span></div></div><div className="flex items-center gap-2"><Shield size={10} className="text-slate-500" /><span className="text-[8px] font-bold text-slate-600 uppercase tracking-widest">Secure Operator Link v2.4</span></div></div>
    </div>
  )
}
