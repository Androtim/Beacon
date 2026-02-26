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
  const [videoUrl, setVideoUrl] = useState(null)
  
  // Cleanup URLs to prevent memory leaks
  useEffect(() => {
    return () => {
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
      }
    };
  }, [videoUrl]);
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

  const acceptFileTransfer = useCallback(() => {
    setSharingStatus('downloading')
    socket.emit('video-file-request', { to: pendingHostId })
  }, [socket, pendingHostId])

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
    
    // Signal to client that we are ready to start P2P transfer
    socket.emit('video-file-ready', { to: from, fileInfo: fileInfoRef.current })
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
          setVideoUrl(url); setSharingStatus('ready'); setDownloadProgress({ [pendingFileInfo?.name]: 100 })
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
    <div className="bg-[#1A1A1A] border border-white/5 rounded-none p-5 space-y-5 font-mono">
      <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] flex items-center gap-2"><Upload className="h-4 w-4 text-orange-500" />PROTOCOL: P2P_SYNC</h3>
      {isHost && hostVideoSource === 'file' ? (
        <div className="space-y-4">
          <input ref={fileInputRef} type="file" accept="video/*" onChange={(e) => {
            const file = e.target.files[0]
            if (!file) return
            setSelectedFile(file); fileInfoRef.current = { name: file.name, size: file.size, type: file.type }; setSharingStatus('ready')
          }} className="hidden" />
          <button onClick={() => fileInputRef.current?.click()} className="glass-button w-full !py-3 text-[10px] tracking-[0.2em]" disabled={sharingStatus === 'sharing'}><Upload size={14} /> SELECT_PAYLOAD</button>
          {selectedFile && (
            <div className="bg-white/5 border border-white/5 rounded-none p-4">
              <div className="flex items-center gap-3"><div className="flex-1"><p className="text-white text-[10px] font-bold truncate uppercase">{selectedFile.name}</p><p className="text-slate-600 text-[9px] uppercase font-black">{formatFileSize(selectedFile.size)}</p></div>{sharingStatus === 'ready' && <CheckCircle className="h-4 w-4 text-orange-500" />}</div>
              {sharingStatus === 'ready' && !isSharing && <button onClick={() => { 
                setSharingStatus('sharing'); 
                setIsSharing(true); 
                const url = URL.createObjectURL(selectedFile); 
                setVideoUrl(url);
                if (onVideoReady) onVideoReady(url, fileInfoRef.current); 
                socket.emit('video-file-share', { roomId, fileInfo: fileInfoRef.current }) 
              }} className="w-full mt-4 glass-button !bg-orange-600 !py-3 text-[10px] tracking-[0.2em]"><Users size={14} /> BROADCAST_PAYLOAD</button>}
              {isSharing && <div className="mt-4 space-y-3"><div className="bg-orange-500/5 border border-orange-500/20 rounded-none p-3 text-center"><p className="text-orange-500 text-[10px] font-black uppercase tracking-wider">{uploadProgress}% SYNCED</p><div className="w-full bg-white/5 h-1 rounded-none mt-2 overflow-hidden"><motion.div animate={{ width: `${uploadProgress}%` }} className="h-full bg-orange-500" /></div></div><button onClick={cancelTransfer} className="w-full glass-button !bg-red-600 !py-2 text-[9px] tracking-[0.2em]">TERMINATE_LINK</button></div>}
            </div>
          )}
        </div>
      ) : isHost ? (
        <div className="text-center py-6 px-4 bg-white/5 rounded-none border border-dashed border-white/5 opacity-50"><Upload className="h-8 w-8 mx-auto mb-3 text-slate-800" /><p className="text-slate-600 text-[9px] font-black uppercase tracking-[0.2em] leading-relaxed">SWITCH TO "P2P_FILE"<br/>MODE TO BROADCAST</p></div>
      ) : (
        <div className="space-y-4">
          {sharingStatus === 'idle' && <div className="text-center py-8 bg-white/5 rounded-none border border-dashed border-white/5 animate-pulse"><Users className="h-8 w-8 mx-auto mb-3 text-slate-800" /><p className="text-slate-600 text-[9px] font-black uppercase tracking-[0.2em]">Awaiting_Transmission...</p></div>}
          {sharingStatus === 'pending' && pendingFileInfo && (
            <div className="bg-orange-500/5 border border-orange-500/20 rounded-none p-5 text-center">
              <Download className="h-8 w-8 mx-auto mb-4 text-orange-500" />
              <p className="text-white font-black text-[10px] uppercase tracking-[0.2em] mb-4">INCOMING_DATA_STREAM</p>
              <div className="bg-black/40 rounded-none p-3 mb-6 border border-white/5"><p className="text-orange-500 font-bold text-[9px] truncate uppercase">{pendingFileInfo.name}</p></div>
              <div className="flex gap-3"><button onClick={acceptFileTransfer} className="flex-1 glass-button !bg-orange-500 !py-3 text-[10px]">ACCEPT</button><button onClick={() => setSharingStatus('idle')} className="flex-1 glass-button !bg-transparent !border-white/10 !py-3 text-[10px]">REJECT</button></div>
            </div>
          )}
          {sharingStatus === 'downloading' && (
            <div className="space-y-4 bg-white/5 border border-white/5 rounded-none p-5">
              <div className="text-center text-white font-black text-[9px] uppercase tracking-[0.3em] animate-pulse">Syncing_Payload...</div>
              {Object.entries(downloadProgress).map(([name, prog]) => (
                <div key={name} className="space-y-2"><div className="flex justify-between font-bold text-[9px] text-orange-500"><span>{prog}%</span></div><div className="w-full bg-white/5 h-1 rounded-none overflow-hidden"><motion.div animate={{ width: `${prog}%` }} className="h-full bg-orange-500 shadow-[0_0_10px_rgba(255,87,34,0.2)]" /></div></div>
              ))}
              <button onClick={cancelTransfer} className="w-full glass-button !bg-red-600 !py-2 text-[9px]">ABORT</button>
            </div>
          )}
          {sharingStatus === 'ready' && <div className="text-center py-8 px-4 bg-orange-500/5 rounded-none border border-orange-500/20"><CheckCircle className="h-8 w-8 mx-auto mb-3 text-orange-500" /><p className="text-orange-500 text-[10px] font-black uppercase tracking-[0.2em] leading-relaxed">Payload_Synchronized</p></div>}
        </div>
      )}
      <div className="bg-black/40 rounded-none p-3 border border-white/5"><p className="text-[8px] text-slate-700 text-center font-black uppercase tracking-[0.2em] leading-relaxed">ENCRYPTION: ACTIVE // LINK: DIRECT<br/><span className="text-slate-800 mt-1 block">PROTOCOLS: MP4, WEBM, MOV, AVI</span></p></div>
    </div>
  )
}
