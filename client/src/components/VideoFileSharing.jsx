import { useState, useRef, useEffect, useCallback } from 'react'
import { Upload, Users, Play, Pause, Download, AlertCircle, CheckCircle, Plus, X, Copy, Check, ArrowRight, Loader, Box, ShieldCheck, Shield } from 'lucide-react'
import { motion } from 'framer-motion'
import SimplePeer from 'simple-peer'

// Detect if running in Chrome
const isChrome = () => {
  return /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor)
}

export default function VideoFileSharing({ socket, roomId, isHost, participants, onVideoReady, hostVideoSource, initialFileShare }) {
  const [selectedFile, setSelectedFile] = useState(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isSharing, setIsSharing] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState({})
  const [videoBlob, setVideoBlob] = useState(null)
  const [sharingStatus, setSharingStatus] = useState('idle') 
  const [pendingFileInfo, setPendingFileInfo] = useState(null)
  const [pendingHostId, setPendingHostId] = useState(null)
  const [iceServers, setIceServers] = useState([])
  
  const fileInputRef = useRef(null)
  const peersRef = useRef({})
  const chunksRef = useRef([])
  const fileInfoRef = useRef(null)
  const currentTransferRef = useRef(null)
  const expectingBinaryRef = useRef(null)

  const formatFileSize = useCallback((bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }, [])

  const handleVideoFileInfo = useCallback(({ fileInfo, hostId }) => {
    console.log('🎥 Received video file info:', { fileInfo, hostId, isHost })
    if (isHost) return
    setSharingStatus('pending')
    setPendingFileInfo(fileInfo)
    setPendingHostId(hostId)
  }, [isHost])

  const sendVideoFile = useCallback(async (peer, file) => {
    const chunkSize = 16 * 1024 // 16KB chunks for max compatibility
    const totalChunks = Math.ceil(file.size / chunkSize)
    
    try {
      peer.send(JSON.stringify({
        type: 'transfer-start',
        fileInfo: { name: file.name, size: file.size, type: file.type, totalChunks }
      }))

      for (let index = 0; index < totalChunks; index++) {
        const start = index * chunkSize
        const end = Math.min(start + chunkSize, file.size)
        const chunk = await file.slice(start, end).arrayBuffer()
        
        peer.send(JSON.stringify({ type: 'chunk-header', index }))
        await new Promise(resolve => setTimeout(resolve, 0)) // Yield
        peer.send(chunk)
        
        // Manual flow control
        if (peer._channel && peer._channel.bufferedAmount > 64 * 1024) {
          await new Promise(resolve => {
            const check = () => {
              if (!peer._channel || peer._channel.bufferedAmount <= 16 * 1024) resolve()
              else setTimeout(check, 20)
            }
            check()
          })
        }
        
        if (index % 20 === 0 || index === totalChunks - 1) {
          setUploadProgress(Math.round(((index + 1) / totalChunks) * 100))
        }
      }
      peer.send(JSON.stringify({ type: 'transfer-complete' }))
    } catch (err) {
      console.error('❌ P2P Send Error:', err)
    }
  }, [])

  const handleSignal = useCallback(({ from, signal }) => {
    if (peersRef.current[from]) peersRef.current[from].signal(signal)
  }, [])

  const handleVideoFileRequest = useCallback(({ from }) => {
    if (!selectedFile || !isHost) return
    const peer = new SimplePeer({ initiator: false, trickle: true, config: { iceServers } })
    peersRef.current[from] = peer
    peer.on('signal', signal => socket.emit('video-file-signal', { to: from, signal }))
    peer.on('connect', () => sendVideoFile(peer, selectedFile))
    peer.on('error', () => delete peersRef.current[from])
  }, [socket, selectedFile, isHost, sendVideoFile, iceServers])

  const handleVideoReady = useCallback(({ from, fileInfo }) => {
    if (isHost) return
    const peer = new SimplePeer({ initiator: true, trickle: true, config: { iceServers } })
    peersRef.current[from] = peer
    peer.on('signal', signal => socket.emit('video-file-signal', { to: from, signal }))
    
    peer.on('data', data => {
      if (expectingBinaryRef.current) {
        chunksRef.current[expectingBinaryRef.current.index] = new Uint8Array(data)
        const receivedCount = chunksRef.current.filter(Boolean).length
        const progress = Math.round((receivedCount / chunksRef.current.length) * 100)
        setDownloadProgress(prev => ({ ...prev, [pendingFileInfo?.name || 'video']: progress }))
        expectingBinaryRef.current = null
        return
      }

      try {
        const msg = JSON.parse(data.toString())
        if (msg.type === 'transfer-start') {
          chunksRef.current = new Array(msg.fileInfo.totalChunks)
        } else if (msg.type === 'chunk-header') {
          expectingBinaryRef.current = msg
        } else if (msg.type === 'transfer-complete') {
          const blob = new Blob(chunksRef.current.filter(Boolean), { type: pendingFileInfo?.type || 'video/mp4' })
          const url = URL.createObjectURL(blob)
          setVideoBlob(blob); setSharingStatus('ready'); setDownloadProgress({ [pendingFileInfo?.name]: 100 })
          if (onVideoReady) onVideoReady(url, pendingFileInfo)
          delete peersRef.current[from]
        }
      } catch (e) {}
    })
    peer.on('error', () => setSharingStatus('error'))
  }, [socket, isHost, onVideoReady, iceServers, pendingFileInfo])

  const cancelTransfer = useCallback(() => {
    Object.values(peersRef.current).forEach(p => p?.destroy?.())
    peersRef.current = {}; setSharingStatus('idle'); setIsSharing(false); setDownloadProgress({}); setUploadProgress(0)
    if (socket) socket.emit('video-file-cancel', { roomId })
  }, [socket, roomId])

  useEffect(() => {
    const fetchIce = async () => {
      try {
        const token = localStorage.getItem('token')
        const res = await fetch(`/api/ice-servers`, { headers: { 'Authorization': `Bearer ${token}` } })
        const data = await res.json()
        setIceServers(data.iceServers)
      } catch (err) { setIceServers([{ urls: 'stun:stun.l.google.com:19302' }]) }
    }
    fetchIce()
  }, [])

  useEffect(() => {
    if (initialFileShare && !isHost && sharingStatus === 'idle') handleVideoFileInfo(initialFileShare)
  }, [initialFileShare, isHost, sharingStatus, handleVideoFileInfo])

  useEffect(() => {
    if (!socket) return
    const evs = { 'video-file-request': handleVideoFileRequest, 'video-file-signal': handleSignal, 'video-file-ready': handleVideoReady, 'video-file-info': handleVideoFileInfo, 'video-file-cancel': cancelTransfer }
    Object.entries(evs).forEach(([e, h]) => socket.on(e, h))
    return () => { Object.entries(evs).forEach(([e, h]) => socket.off(e, h)); Object.values(peersRef.current).forEach(p => p?.destroy?.()) }
  }, [socket, handleVideoFileRequest, handleSignal, handleVideoReady, handleVideoFileInfo, cancelTransfer])

  return (
    <div className="bg-white/5 backdrop-blur-xl border border-white/5 rounded-2xl p-5 space-y-5">
      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2"><Upload className="h-4 w-4 text-violet-400" />P2P Video Sharing</h3>
      {isHost && hostVideoSource === 'file' ? (
        <div className="space-y-4">
          <input ref={fileInputRef} type="file" accept="video/*" onChange={(e) => {
            const file = e.target.files[0]
            if (!file) return
            setSelectedFile(file); fileInfoRef.current = { name: file.name, size: file.size, type: file.type }; setSharingStatus('ready')
          }} className="hidden" />
          <button onClick={() => fileInputRef.current?.click()} className="glass-button w-full !py-2.5 text-xs tracking-wider" disabled={sharingStatus === 'sharing'}><Upload className="h-4 w-4" /> SELECT VIDEO FILE</button>
          {selectedFile && (
            <div className="bg-white/5 border border-white/5 rounded-xl p-4">
              <div className="flex items-center gap-3"><div className="flex-1"><p className="text-white text-sm truncate">{selectedFile.name}</p><p className="text-slate-500 text-[10px] uppercase font-mono">{formatFileSize(selectedFile.size)}</p></div>{sharingStatus === 'ready' && <CheckCircle className="h-5 w-5 text-green-400" />}</div>
              {sharingStatus === 'ready' && !isSharing && <button onClick={() => { setSharingStatus('sharing'); setIsSharing(true); const url = URL.createObjectURL(selectedFile); if (onVideoReady) onVideoReady(url, fileInfoRef.current); socket.emit('video-file-share', { roomId, fileInfo: fileInfoRef.current }) }} className="w-full mt-4 glass-button !from-green-600 !to-green-500 !py-2.5 text-[10px] tracking-widest"><Users className="h-4 w-4" /> INITIALIZE TRANSFER</button>}
              {isSharing && <div className="mt-4 space-y-3"><div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 text-center"><p className="text-green-400 text-[10px] font-bold uppercase tracking-wider">{uploadProgress}% SYNCED</p><div className="w-full bg-white/5 h-1 rounded-full mt-2 overflow-hidden"><motion.div animate={{ width: `${uploadProgress}%` }} className="h-full bg-green-400" /></div></div><button onClick={cancelTransfer} className="w-full glass-button !from-red-600 !to-red-500 !py-2 text-[10px] opacity-50 hover:opacity-100">TERMINATE</button></div>}
            </div>
          )}
        </div>
      ) : isHost ? (
        <div className="text-center py-6 px-4 bg-white/5 rounded-2xl border border-dashed border-white/10 opacity-50"><Upload className="h-10 w-10 mx-auto mb-3 text-slate-600" /><p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest leading-relaxed">Switch to "Local File (P2P)"<br/>mode to share video</p></div>
      ) : (
        <div className="space-y-4">
          {sharingStatus === 'idle' && <div className="text-center py-8 bg-white/5 rounded-2xl border border-dashed border-white/10 animate-pulse"><Users className="h-10 w-10 mx-auto mb-3 text-slate-700" /><p className="text-slate-600 text-[10px] font-bold uppercase tracking-widest">Awaiting Transmission...</p></div>}
          {sharingStatus === 'pending' && pendingFileInfo && (
            <div className="bg-violet-500/10 border border-violet-500/20 rounded-2xl p-5 text-center">
              <Download className="h-10 w-10 mx-auto mb-4 text-violet-400" />
              <p className="text-white font-bold text-sm mb-4">Incoming Data Stream</p>
              <div className="bg-black/20 rounded-xl p-3 mb-6 border border-white/5"><p className="text-violet-300 font-mono text-[10px] truncate">{pendingFileInfo.name}</p></div>
              <div className="flex gap-3"><button onClick={acceptFileTransfer} className="flex-1 glass-button !from-violet-600 !to-violet-500 !py-2.5 text-[10px]">ACCEPT</button><button onClick={() => setSharingStatus('idle')} className="flex-1 glass-button !bg-transparent !from-transparent !to-transparent !border-white/10 !py-2.5 text-[10px]">REJECT</button></div>
            </div>
          )}
          {sharingStatus === 'downloading' && (
            <div className="space-y-4 bg-white/5 border border-white/5 rounded-2xl p-5">
              <div className="text-center text-white font-bold text-[10px] uppercase tracking-widest animate-pulse">Syncing Payload...</div>
              {Object.entries(downloadProgress).map(([name, prog]) => (
                <div key={name} className="space-y-2"><div className="flex justify-between font-mono text-[10px] text-violet-400"><span>{prog}%</span></div><div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden"><motion.div animate={{ width: `${prog}%` }} className="h-full bg-gradient-to-r from-violet-500 to-cyan-500 shadow-[0_0_10px_rgba(139,92,246,0.5)]" /></div></div>
              ))}
              <button onClick={cancelTransfer} className="w-full glass-button !from-red-600 !to-red-500 !py-2 text-[10px]">ABORT</button>
            </div>
          )}
          {sharingStatus === 'ready' && <div className="text-center py-8 px-4 bg-green-500/5 rounded-2xl border border-green-500/20"><CheckCircle className="h-10 w-10 mx-auto mb-3 text-green-400" /><p className="text-green-400 text-[10px] font-bold uppercase tracking-widest leading-relaxed">Payload Synchronized</p></div>}
        </div>
      )}
      <div className="bg-black/20 rounded-xl p-3 border border-white/5"><p className="text-[9px] text-slate-500 text-center font-bold uppercase tracking-[0.1em] leading-relaxed">P2P encryption active • Direct Link<br/><span className="text-slate-600 mt-1 block">Protocols: MP4, WebM, MOV, AVI (Max 3GB)</span></p></div>
    </div>
  )
}
