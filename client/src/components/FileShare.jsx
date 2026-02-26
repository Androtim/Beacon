import { useState, useRef, useEffect, useCallback } from 'react'
import { Upload, Download, Copy, Check, X, FileIcon, Share2, Plus, ShieldCheck, Zap } from 'lucide-react'
import SimplePeer from 'simple-peer'
import JSZip from 'jszip'
import { motion, AnimatePresence } from 'framer-motion'

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
  const [createdUrls, setCreatedUrls] = useState([])
  const [myId] = useState(() => Math.random().toString(36).substr(2, 9))

  useEffect(() => {
    return () => createdUrls.forEach(url => URL.revokeObjectURL(url))
  }, [createdUrls])
  
  const fileInputRef = useRef(null)
  const peersRef = useRef({})
  const filesRef = useRef({})
  const chunksRef = useRef({})
  const expectingBinaryRef = useRef(null)

  const formatFileSize = useCallback((bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024, sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }, [])

  const sendFile = useCallback(async (peer, file, fileIndex) => {
    const chunkSize = 16 * 1024 
    const totalChunks = Math.ceil(file.size / chunkSize)
    peer.send(JSON.stringify({ type: 'file-meta', fileIndex, fileName: file.name, fileSize: file.size, fileType: file.type, totalChunks }))
    
    for (let index = 0; index < totalChunks; index++) {
      try {
        const start = index * chunkSize
        const end = Math.min(start + chunkSize, file.size)
        const chunk = await file.slice(start, end).arrayBuffer()
        peer.send(JSON.stringify({ type: 'chunk-header', fileIndex, index }))
        await new Promise(r => setTimeout(r, 0))
        peer.send(chunk)
        if (index % 50 === 0 || index === totalChunks - 1) {
          setUploadProgress(prev => ({ ...prev, [file.name]: Math.round(((index + 1) / totalChunks) * 100) }))
        }
      } catch (err) { break }
    }
    peer.send(JSON.stringify({ type: 'file-complete', fileIndex, fileName: file.name }))
  }, [])

  const cancelTransfer = useCallback(() => {
    Object.values(peersRef.current).forEach(p => p?.destroy?.())
    peersRef.current = {}
    setMode('idle'); setSharingStatus('idle'); setShareCode(''); setSelectedFiles([]); setPendingFiles([]); setDownloadProgress({}); setUploadProgress({}); chunksRef.current = {}; expectingBinaryRef.current = null
    if (shareCode) socket.emit('metadata', { action: 'file-share-cancel' })
  }, [socket, shareCode])

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files)
    if (files.length === 0) return
    setSelectedFiles(files); filesRef.current = files
    const code = Math.random().toString(36).substring(2, 10).toUpperCase()
    setShareCode(code); setMode('sharing'); setSharingStatus('waiting')
    socket.join(code, myId, { files: files.map(f => ({ name: f.name, size: f.size, type: f.type })) })
    e.target.value = null
  }

  const joinFileShare = () => {
    if (inputCode.length !== 8) return
    setMode('receiving'); setSharingStatus('waiting')
    socket.join(inputCode.toUpperCase(), myId, {})
  }

  const handleSignal = useCallback((signal, from) => peersRef.current[from]?.signal(signal), [])
  const handleFileShareInfo = useCallback(({ files, hostId }) => { setPendingFiles(files); setPeerId(hostId); setSharingStatus('ready') }, [])

  const handleFileShareRequest = useCallback(({ from }) => {
    const peer = new SimplePeer({ initiator: false, trickle: true, config: { iceServers } })
    peersRef.current[from] = peer
    peer.on('signal', signal => socket.emit(signal.type || 'ice-candidate', signal, from))
    peer.on('connect', async () => {
      setSharingStatus('transferring')
      for (let i = 0; i < filesRef.current.length; i++) await sendFile(peer, filesRef.current[i], i)
      setSharingStatus('complete')
    })
    peer.on('error', () => setSharingStatus('error'))
    socket.emit('metadata', { action: 'file-share-ready' }, from)
  }, [socket, sendFile, iceServers])

  const handleFileShareReady = useCallback(({ from }) => {
    const peer = new SimplePeer({ initiator: true, trickle: true, config: { iceServers } })
    peersRef.current[from] = peer
    peer.on('signal', signal => socket.emit(signal.type || 'ice-candidate', signal, from))
    peer.on('data', data => {
      if (expectingBinaryRef.current) {
        const { fileIndex, index } = expectingBinaryRef.current
        const fileData = chunksRef.current[fileIndex]
        if (fileData) {
          fileData.chunks[index] = new Uint8Array(data)
          const progress = Math.round(((index + 1) / fileData.totalChunks) * 100)
          setDownloadProgress(prev => ({ ...prev, [fileData.fileName]: progress }))
        }
        expectingBinaryRef.current = null; return
      }
      try {
        const msg = JSON.parse(data.toString())
        if (msg.type === 'file-meta') { chunksRef.current[msg.fileIndex] = { ...msg, chunks: [] }; setDownloadProgress(prev => ({ ...prev, [msg.fileName]: 0 })) }
        else if (msg.type === 'chunk-header') { expectingBinaryRef.current = msg }
        else if (msg.type === 'file-complete') {
          const fileData = chunksRef.current[msg.fileIndex]
          if (fileData) fileData.blob = new Blob(fileData.chunks, { type: fileData.fileType })
          const all = Object.values(chunksRef.current)
          if (all.every(f => f.blob)) {
            setSharingStatus('complete')
            if (all.length > 1) {
              const zip = new JSZip(); all.forEach(f => zip.file(f.fileName, f.blob))
              zip.generateAsync({ type: 'blob' }).then(b => { const url = URL.createObjectURL(b); setCreatedUrls(p => [...p, url]); const a = document.createElement('a'); a.href = url; a.download = `files.zip`; a.click() })
            } else { const f = all[0]; const url = URL.createObjectURL(f.blob); setCreatedUrls(p => [...p, url]); const a = document.createElement('a'); a.href = url; a.download = f.fileName; a.click() }
          }
        }
      } catch (err) {}
    })
    peer.on('connect', () => setSharingStatus('transferring'))
  }, [socket, iceServers])

  useEffect(() => {
    const fetchIce = async () => {
      try {
        const res = await fetch(`${window.location.origin}/api/ice-servers`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } })
        const data = await res.json(); setIceServers(data.iceServers)
      } catch (err) { setIceServers([{ urls: 'stun:stun.l.google.com:19302' }]) }
    }
    fetchIce()
  }, [])

  useEffect(() => {
    if (!socket) return
    socket.on('join', (data) => data.metadata?.files && handleFileShareInfo({ files: data.metadata.files, hostId: data.id }))
    socket.on('file-share-request', (d, s) => handleFileShareRequest({ from: s }))
    socket.on('file-share-ready', (d, s) => handleFileShareReady({ from: s }))
    socket.on('file-share-cancel', cancelTransfer)
    socket.on('metadata', (data, sender) => {
        if (Array.isArray(data)) { const host = data.find(p => p.metadata?.files); if (host) handleFileShareInfo({ files: host.metadata.files, hostId: host.id }) }
    })
    socket.on('offer', handleSignal); socket.on('answer', handleSignal); socket.on('ice-candidate', handleSignal)
    return () => { socket.off('join'); socket.off('metadata'); socket.off('file-share-request'); socket.off('file-share-ready'); socket.off('file-share-cancel'); socket.off('offer'); socket.off('answer'); socket.off('ice-candidate') }
  }, [socket, handleFileShareInfo, handleFileShareRequest, handleFileShareReady, handleSignal, cancelTransfer, myId])

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto py-8 font-sans text-slate-900">
      <div className="flex items-center justify-between border-b pb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 text-blue-600 rounded-lg"><Share2 size={24} /></div>
          <div><h2 className="text-xl font-bold">File Share</h2><p className="text-sm text-slate-500">Secure Peer-to-Peer Transfer</p></div>
        </div>
        {mode !== 'idle' && <button onClick={cancelTransfer} className="p-2 text-slate-400 hover:text-slate-600"><X size={20} /></button>}
      </div>

      <AnimatePresence mode="wait">
        {mode === 'idle' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="grid grid-cols-1 gap-6">
            <div className="card hover:border-blue-300 transition-colors">
              <Upload className="text-blue-500 mb-4" size={32} />
              <h3 className="text-lg font-bold mb-2">Send Files</h3>
              <p className="text-slate-500 text-sm mb-6">Select files to share directly with another user.</p>
              <input ref={fileInputRef} type="file" multiple onChange={handleFileSelect} className="hidden" />
              <button onClick={() => fileInputRef.current?.click()} className="btn btn-primary w-full">Select Files</button>
            </div>
            <div className="card hover:border-slate-300 transition-colors">
              <Download className="text-slate-500 mb-4" size={32} />
              <h3 className="text-lg font-bold mb-2">Receive Files</h3>
              <p className="text-slate-500 text-sm mb-6">Enter the 8-digit code to start receiving.</p>
              <div className="flex gap-2"><input type="text" value={inputCode} onChange={(e) => setInputCode(e.target.value.toUpperCase())} placeholder="Enter code" className="input flex-1" maxLength={8} /><button onClick={joinFileShare} disabled={inputCode.length !== 8} className="btn btn-secondary px-6">Join</button></div>
            </div>
          </motion.div>
        )}

        {mode === 'sharing' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <div className="card text-center bg-blue-50 border-blue-100">
               <ShieldCheck className="text-blue-500 mx-auto mb-4" size={40} />
               <p className="text-sm font-semibold text-blue-600 uppercase tracking-wider mb-2">Ready to Send</p>
               <div className="flex items-center justify-center gap-2 mb-6">{shareCode.split('').map((char, i) => (<span key={i} className="w-10 h-12 bg-white border border-blue-200 rounded flex items-center justify-center text-2xl font-bold text-slate-800">{char}</span>))}</div>
               <button onClick={() => { navigator.clipboard.writeText(shareCode); setCopied(true); setTimeout(() => setCopied(false), 2000) }} className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-2 mx-auto">{copied ? <><Check size={14} className="text-green-500" /> Copied</> : <><Copy size={14} /> Copy Code</>}</button>
            </div>
            <div className="card p-0 overflow-hidden">
              <div className="px-6 py-4 bg-slate-50 border-b flex justify-between"><span className="text-xs font-bold text-slate-500 uppercase tracking-wider">File List</span><span className="text-xs text-slate-400">{selectedFiles.length} items</span></div>
              <div className="p-4 space-y-3">{selectedFiles.map((file, i) => (<div key={i} className="flex items-center justify-between p-3 border rounded-lg"><div className="flex items-center gap-3 overflow-hidden"><FileIcon size={18} className="text-slate-400 shrink-0" /><div className="min-w-0"><p className="text-sm font-medium truncate">{file.name}</p><p className="text-xs text-slate-400">{formatFileSize(file.size)}</p></div></div>{uploadProgress[file.name] > 0 && (<div className="flex items-center gap-3"><span className="text-xs font-bold text-blue-600">{uploadProgress[file.name]}%</span><div className="w-20 h-1 bg-slate-100 rounded-full overflow-hidden"><motion.div animate={{ width: `${uploadProgress[file.name]}%` }} className="h-full bg-blue-500" /></div></div>)}</div>))}</div>
            </div>
          </motion.div>
        )}

        {mode === 'receiving' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <div className="card flex items-center justify-between bg-slate-50"><div><p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Code</p><p className="text-2xl font-bold tracking-widest">{inputCode}</p></div><div className="px-3 py-1 bg-blue-100 text-blue-600 text-xs font-bold rounded-full">Secure Link</div></div>
            {sharingStatus === 'ready' && (<div className="card animate-in slide-in-from-bottom-2 duration-500"><h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">Files to Download</h3><div className="space-y-2 mb-6">{pendingFiles.map((file, i) => (<div key={i} className="flex items-center justify-between p-3 border rounded-lg"><div className="flex items-center gap-3"><FileIcon size={18} className="text-blue-500" /><span className="text-sm font-medium">{file.name}</span></div><span className="text-xs text-slate-400">{formatFileSize(file.size)}</span></div>))}</div><button onClick={() => socket.signal('metadata', { action: 'file-share-request' }, peerId)} className="btn btn-primary w-full py-4 font-bold">Start Download</button></div>)}
            {sharingStatus === 'transferring' && (<div className="card"><h3 className="text-sm font-bold text-slate-700 mb-6">Downloading...</h3><div className="space-y-6">{Object.entries(downloadProgress).map(([name, prog]) => (<div key={name} className="space-y-2"><div className="flex justify-between items-end"><span className="text-sm font-medium truncate max-w-[70%]">{name}</span><span className="text-blue-600 font-bold">{prog}%</span></div><div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden"><motion.div animate={{ width: `${prog}%` }} className="h-full bg-blue-500" /></div></div>))}</div></div>)}
            {sharingStatus === 'complete' && (<div className="card text-center py-10"><div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6"><Check size={32} /></div><h3 className="text-lg font-bold mb-2">Transfer Complete</h3><p className="text-slate-500 text-sm mb-8">Files have been saved to your downloads.</p><button onClick={cancelTransfer} className="btn btn-primary w-full">Return to Dashboard</button></div>)}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
