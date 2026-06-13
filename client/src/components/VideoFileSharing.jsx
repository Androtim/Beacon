import { useState, useRef, useEffect, useCallback } from 'react'
import { Upload, Users, Download, Play, CheckCircle, X, ShieldCheck, AlertCircle } from 'lucide-react'
import { useWebRTC } from '../hooks/useWebRTC'
import { motion, AnimatePresence } from 'framer-motion'

export default function VideoFileSharing({ socket, roomId, isHost, onVideoReady, hostVideoSource, initialFileShare }) {
  const [selectedFile, setSelectedFile] = useState(null)
  const [uploadProgressState, setUploadProgressState] = useState(0)
  const [isSharing, setIsSharing] = useState(false)
  const [videoUrl, setVideoUrl] = useState(null)
  
  const [pendingFileInfo, setPendingFileInfo] = useState(null)
  const [pendingHostId, setPendingHostId] = useState(null)
  const [iceServers, setIceServers] = useState([])

  const fileInputRef = useRef(null)
  const fileInfoRef = useRef(null)

  // Cleanup object URLs to prevent memory leaks
  useEffect(() => {
    return () => {
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl)
      }
    }
  }, [videoUrl])

  const formatFileSize = useCallback((bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024, sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }, [])

  // Callback when P2P video file is received
  const handleVideoReceived = useCallback((blob, fileName, fileType) => {
    console.log(`📥 Completed receiving video file P2P: ${fileName}`)
    const url = URL.createObjectURL(blob)
    setVideoUrl(url)
    setSharingStatus('ready')
    if (onVideoReady) {
      onVideoReady(url, { name: fileName, size: blob.size, type: fileType })
    }
  }, [onVideoReady])

  // Setup WebRTC hook
  const {
    sharingStatus,
    setSharingStatus,
    uploadProgress,
    downloadProgress,
    dataChannelStates,
    initiateConnection,
    handleIncomingSignal,
    sendFileToPeer,
    cleanupAll
  } = useWebRTC(socket, iceServers)

  const sentPeersRef = useRef(new Set())

  // Trigger file sending when a channel opens for a peer
  useEffect(() => {
    if (!isHost || !selectedFile) return
    
    Object.entries(dataChannelStates).forEach(([peerId, state]) => {
      if (state === 'open' && !sentPeersRef.current.has(peerId)) {
        sentPeersRef.current.add(peerId)
        console.log(`🔌 Channel open! Host starting video transfer to: ${peerId}`)
        sendFileToPeer(peerId, selectedFile)
      }
    })
  }, [dataChannelStates, isHost, selectedFile, sendFileToPeer])

  // Keep progress state synchronized
  useEffect(() => {
    if (selectedFile) {
      const prog = uploadProgress[selectedFile.name] || 0
      setUploadProgressState(prog)
    }
  }, [uploadProgress, selectedFile])

  const handleVideoFileInfo = useCallback(({ fileInfo, hostId }) => {
    console.log('🎥 Received video file info:', { fileInfo, hostId, isHost })
    if (isHost) return
    setSharingStatus('pending')
    setPendingFileInfo(fileInfo)
    setPendingHostId(hostId)
  }, [isHost, setSharingStatus])

  const acceptFileTransfer = useCallback(() => {
    setSharingStatus('connecting')
    socket.emit('video-file-request', { to: pendingHostId })
  }, [socket, pendingHostId, setSharingStatus])

  const cancelTransfer = useCallback(() => {
    cleanupAll()
    sentPeersRef.current.clear()
    setSelectedFile(null)
    setUploadProgressState(0)
    setIsSharing(false)
    setPendingFileInfo(null)
    setPendingHostId(null)
    setSharingStatus('idle')
    if (videoUrl) {
      URL.revokeObjectURL(videoUrl)
      setVideoUrl(null)
    }
    if (socket) {
      socket.emit('video-file-cancel', { roomId })
    }
  }, [socket, roomId, videoUrl, cleanupAll, setSharingStatus])

  // Load ICE servers from Node backend
  useEffect(() => {
    const fetchIce = async () => {
      try {
        const token = localStorage.getItem('token')
        const res = await fetch(`/api/ice-servers`, { headers: { 'Authorization': `Bearer ${token}` } })
        const data = await res.json()
        setIceServers(data.iceServers)
      } catch (err) { 
        setIceServers([{ urls: 'stun:stun.l.google.com:19302' }]) 
      }
    }
    fetchIce()
  }, [])

  // Auto-trigger on initial room state sync
  useEffect(() => {
    if (initialFileShare && !isHost && sharingStatus === 'idle') {
      handleVideoFileInfo(initialFileShare)
    }
  }, [initialFileShare, isHost, sharingStatus, handleVideoFileInfo])

  // Socket event binding
  useEffect(() => {
    if (!socket) return

    socket.on('video-file-info', handleVideoFileInfo)
    
    socket.on('video-file-request', (data) => {
      console.log('📥 Peer requested video file:', data.from)
      // Host triggers handshake by signaling ready
      socket.emit('video-file-ready', { to: data.from, fileInfo: fileInfoRef.current })
    })

    socket.on('video-file-ready', (data) => {
      console.log('📥 Host ready for video! Initiating connection.')
      initiateConnection(data.from, handleVideoReceived, 'video-file-signal')
    })

    socket.on('video-file-signal', (data) => {
      handleIncomingSignal(data.from, data.signal, handleVideoReceived, 'video-file-signal')
    })

    socket.on('video-file-cancel', cancelTransfer)

    return () => {
      socket.off('video-file-info')
      socket.off('video-file-request')
      socket.off('video-file-ready')
      socket.off('video-file-signal')
      socket.off('video-file-cancel')
    }
  }, [socket, initiateConnection, handleIncomingSignal, handleVideoReceived, handleVideoFileInfo, cancelTransfer])

  return (
    <div className="bg-[#1e293b]/50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800 backdrop-blur-md rounded-2xl p-5 space-y-4 font-mono shadow-xl shadow-slate-100/50 dark:shadow-none">
      <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.3em] flex items-center gap-2">
        <Upload className="h-4 w-4 text-blue-500" />
        Protocol: P2P Watch Sync
      </h3>

      {isHost && hostVideoSource === 'file' ? (
        <div className="space-y-4">
          <input 
            ref={fileInputRef} 
            type="file" 
            accept="video/*" 
            onChange={(e) => {
              const file = e.target.files[0]
              if (!file) return
              setSelectedFile(file)
              sentPeersRef.current.clear()
              fileInfoRef.current = { name: file.name, size: file.size, type: file.type }
              setSharingStatus('ready')
            }} 
            className="hidden" 
          />
          <button 
            onClick={() => fileInputRef.current?.click()} 
            className="btn btn-secondary w-full h-11 text-[10px] tracking-[0.2em]" 
            disabled={sharingStatus === 'sharing'}
          >
            SELECT_PAYLOAD
          </button>
          
          {selectedFile && (
            <div className="bg-slate-50 dark:bg-slate-800/20 border border-slate-200/50 dark:border-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex-1 overflow-hidden">
                  <p className="text-slate-700 dark:text-slate-200 text-[10px] font-bold truncate uppercase">{selectedFile.name}</p>
                  <p className="text-slate-400 text-[9px] uppercase font-black">{formatFileSize(selectedFile.size)}</p>
                </div>
                {sharingStatus === 'ready' && <CheckCircle className="h-4.5 w-4.5 text-blue-500" />}
              </div>
              
              {sharingStatus === 'ready' && !isSharing && (
                <button 
                  onClick={() => { 
                    setSharingStatus('sharing')
                    setIsSharing(true)
                    const url = URL.createObjectURL(selectedFile)
                    setVideoUrl(url)
                    if (onVideoReady) {
                      onVideoReady(url, fileInfoRef.current)
                    }
                    socket.emit('video-file-share', { roomId, fileInfo: fileInfoRef.current }) 
                  }} 
                  className="btn btn-primary w-full h-11 text-[10px] tracking-[0.2em]"
                >
                  BROADCAST_PAYLOAD
                </button>
              )}
              
              {isSharing && (
                <div className="space-y-3">
                  <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-3 text-center">
                    <p className="text-blue-500 text-[10px] font-black uppercase tracking-wider">{uploadProgressState}% SYNCED</p>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                      <motion.div 
                        animate={{ width: `${uploadProgressState}%` }} 
                        className="h-full bg-blue-500" 
                      />
                    </div>
                  </div>
                  <button 
                    onClick={cancelTransfer} 
                    className="btn bg-rose-500 text-white hover:bg-rose-600 w-full h-9 text-[9px] tracking-[0.2em]"
                  >
                    TERMINATE_LINK
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      ) : isHost ? (
        <div className="text-center py-6 px-4 bg-slate-50 dark:bg-slate-850/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 opacity-60">
          <Upload className="h-7 w-7 mx-auto mb-2.5 text-slate-400" />
          <p className="text-slate-500 dark:text-slate-400 text-[9px] font-black uppercase tracking-[0.2em] leading-relaxed">
            SWITCH TO "P2P_FILE"<br/>MODE TO BROADCAST
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {sharingStatus === 'idle' && (
            <div className="text-center py-7 bg-slate-50 dark:bg-slate-850/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 opacity-60 animate-pulse">
              <Users className="h-7 w-7 mx-auto mb-2.5 text-slate-400" />
              <p className="text-slate-400 dark:text-slate-500 text-[9px] font-black uppercase tracking-[0.2em]">
                Awaiting_Transmission...
              </p>
            </div>
          )}
          
          {sharingStatus === 'pending' && pendingFileInfo && (
            <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-5 text-center">
              <Download className="h-8 w-8 mx-auto mb-3 text-blue-500" />
              <p className="text-slate-800 dark:text-slate-200 font-black text-[10px] uppercase tracking-[0.2em] mb-3">INCOMING_VIDEO_STREAM</p>
              <div className="bg-slate-50 dark:bg-black/40 rounded-lg p-3 mb-4 border border-slate-200/50 dark:border-slate-850">
                <p className="text-blue-500 font-bold text-[9px] truncate uppercase">{pendingFileInfo.name}</p>
                <p className="text-slate-400 text-[8px] mt-0.5">{formatFileSize(pendingFileInfo.size)}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={acceptFileTransfer} className="btn btn-primary flex-1 h-10 text-[10px]">ACCEPT</button>
                <button onClick={() => setSharingStatus('idle')} className="btn btn-secondary flex-1 h-10 text-[10px]">REJECT</button>
              </div>
            </div>
          )}
          
          {sharingStatus === 'connecting' && (
            <div className="text-center py-6 px-4 bg-blue-500/5 rounded-xl border border-blue-500/20 space-y-2">
              <div className="h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-blue-500 text-[9px] font-black uppercase tracking-[0.2em]">TUNNELING_CONNECTION...</p>
            </div>
          )}

          {sharingStatus === 'downloading' && (
            <div className="space-y-4 bg-slate-50 dark:bg-slate-800/10 border border-slate-200/50 dark:border-slate-800 rounded-xl p-5">
              <div className="text-center text-slate-700 dark:text-slate-300 font-black text-[9px] uppercase tracking-[0.3em] animate-pulse">Syncing_Payload...</div>
              {Object.entries(downloadProgress).map(([name, prog]) => (
                <div key={name} className="space-y-2">
                  <div className="flex justify-between font-bold text-[9px] text-blue-500">
                    <span>{prog}%</span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <motion.div 
                      animate={{ width: `${prog}%` }} 
                      className="h-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.2)]" 
                    />
                  </div>
                </div>
              ))}
              <button 
                onClick={cancelTransfer} 
                className="btn bg-rose-500 text-white w-full h-8 text-[9px]"
              >
                ABORT
              </button>
            </div>
          )}
          
          {sharingStatus === 'ready' && (
            <div className="text-center py-7 px-4 bg-emerald-500/5 rounded-xl border border-emerald-500/20">
              <CheckCircle className="h-7 w-7 mx-auto mb-2 text-emerald-500" />
              <p className="text-emerald-500 text-[10px] font-black uppercase tracking-[0.2em] leading-relaxed">
                Payload_Synchronized
              </p>
            </div>
          )}

          {sharingStatus === 'error' && (
            <div className="bg-rose-500/5 border border-rose-500/20 rounded-xl p-5 text-center space-y-3">
              <AlertCircle className="h-8 w-8 mx-auto text-rose-500" />
              <p className="text-rose-500 font-black text-[10px] uppercase tracking-[0.2em]">CONNECTION_FAILED</p>
              <button onClick={cancelTransfer} className="btn btn-secondary w-full h-9 text-[9px]">RETRY</button>
            </div>
          )}
        </div>
      )}
      
      <div className="bg-slate-50 dark:bg-slate-800/10 rounded-xl p-3 border border-slate-200/50 dark:border-slate-800">
        <p className="text-[8px] text-slate-400 dark:text-slate-500 text-center font-black uppercase tracking-[0.2em] leading-relaxed">
          E2E P2P Pipe // TLS secured signaling<br/>
          <span className="text-slate-300 dark:text-slate-650 mt-1 block">Protocols: MP4, WebM, MOV, AVI</span>
        </p>
      </div>
    </div>
  )
}
