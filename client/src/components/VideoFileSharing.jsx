import { useState, useRef, useEffect, useCallback } from 'react'
import { Upload, Users, Play, Pause, Download, AlertCircle, CheckCircle } from 'lucide-react'
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
  const [sharingStatus, setSharingStatus] = useState('idle') // idle, uploading, sharing, ready, pending, downloading, error
  const [pendingFileInfo, setPendingFileInfo] = useState(null)
  const [pendingHostId, setPendingHostId] = useState(null)
  const [iceServers, setIceServers] = useState([])
  
  const fileInputRef = useRef(null)
  const peersRef = useRef({})
  const chunksRef = useRef([])
  const fileInfoRef = useRef(null)
  const currentTransferRef = useRef(null)

  // Handle latecomer sync
  useEffect(() => {
    if (initialFileShare && !isHost && sharingStatus === 'idle') {
      console.log('🎥 Latecomer Sync: Received initial file share', initialFileShare)
      handleVideoFileInfo(initialFileShare)
    }
  }, [initialFileShare, isHost, sharingStatus, handleVideoFileInfo])

  // Fetch ICE servers on mount
  useEffect(() => {
    const fetchIceServers = async () => {
      try {
        const token = localStorage.getItem('token')
        const response = await fetch(`${window.location.origin}/api/ice-servers`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
        const data = await response.json()
        setIceServers(data.iceServers)
      } catch (err) {
        console.error('Failed to fetch ICE servers:', err)
        // Fallback to STUN only if TURN fetch fails
        setIceServers([{ urls: 'stun:stun.l.google.com:19302' }])
      }
    }
    fetchIceServers()
  }, [])

  const sendVideoFile = useCallback((peer, file) => {
    const reader = new FileReader()
    reader.onload = async () => {
      const chunks = []
      const chunkSize = 16384 // 16KB chunks
      const buffer = reader.result
      
      for (let i = 0; i < buffer.byteLength; i += chunkSize) {
        chunks.push(buffer.slice(i, i + chunkSize))
      }
      
      // Send chunks with flow control
      for (let index = 0; index < chunks.length; index++) {
        try {
          const chunk = chunks[index]
          const message = JSON.stringify({
            type: 'chunk',
            data: Array.from(new Uint8Array(chunk)),
            index,
            total: chunks.length
          })
          
          // Wait for buffer to be ready (reduced threshold for Chrome)
          while (peer._channel && peer._channel.bufferedAmount > 16384) {
            await new Promise(resolve => setTimeout(resolve, 50))
          }
          
          peer.send(message)
          
          // Log upload progress
          if (index % Math.floor(chunks.length / 20) === 0) {
            const progress = Math.round((index / chunks.length) * 100)
          }
          
          // Small delay between chunks to prevent overwhelming
          if (index % 100 === 0) {
            await new Promise(resolve => setTimeout(resolve, 10))
          }
        } catch (err) {
        }
      }

      // Wait a bit before sending complete message
      await new Promise(resolve => setTimeout(resolve, 100))
      peer.send(JSON.stringify({ type: 'complete', total: chunks.length }))
    }
    reader.readAsArrayBuffer(file)
  }, [])

  const handleSignal = useCallback(({ from, signal }) => {
    if (peersRef.current[from]) {
      peersRef.current[from].signal(signal)
    }
  }, [])

  const handleVideoFileRequest = useCallback(({ from }) => {
    if (!selectedFile || !isHost) {
      return
    }
    const peer = new SimplePeer({ 
      initiator: false,
      trickle: isChrome() ? true : false,  // Enable trickle for Chrome
      config: {
        iceServers: iceServers,
        // Chrome-specific ICE configuration
        iceTransportPolicy: 'all',
        bundlePolicy: 'balanced',
        rtcpMuxPolicy: 'require'
      },
      // Enhanced offer options for Chrome
      offerOptions: {
        offerToReceiveAudio: false,
        offerToReceiveVideo: false,
        iceRestart: true
      },
      // Chrome-compatible channel configuration
      channelConfig: {
        ordered: true,
        maxRetransmits: 10,
        protocol: 'video-transfer'
      },
      // Chrome-specific constraints
      constraints: {
        mandatory: {
          OfferToReceiveAudio: false,
          OfferToReceiveVideo: false
        }
      }
    })
    peersRef.current[from] = peer

    peer.on('signal', signal => {
      socket.emit('video-file-signal', { to: from, signal })
    })

    peer.on('connect', () => {
      console.log('Connected to peer for video sharing')
      sendVideoFile(peer, selectedFile)
    })

    peer.on('error', err => {
      console.error('Peer error:', err)
      delete peersRef.current[from]
    })
    
    // Monitor connection state for debugging
    peer.on('iceStateChange', (iceConnectionState, iceGatheringState) => {
      console.log('ICE state change:', iceConnectionState, iceGatheringState)
    })
    
    peer.on('connect', () => {
      console.log('Peer connected successfully')
    })
    
    // Send ready signal to requester
    socket.emit('video-file-ready', { to: from, fileInfo: fileInfoRef.current })
  }, [socket, selectedFile, isHost, sendVideoFile])

  const handleVideoFileInfo = useCallback(({ fileInfo, hostId }) => {
    console.log('🎥 Received video file info:', {
      fileInfo,
      hostId,
      isHost,
      mySocketId: socket?.id
    })
    if (isHost) {
      console.log('🎥 Ignoring - I am the host')
      return // Host doesn't need to download their own file
    }

    // Show confirmation dialog
    setSharingStatus('pending')
    setPendingFileInfo(fileInfo)
    setPendingHostId(hostId)
  }, [isHost, socket])

  const handleVideoReady = useCallback(({ from, fileInfo }) => {
    console.log('Received video-file-ready from:', from)
    if (isHost) return

    const peer = new SimplePeer({ 
      initiator: true,
      trickle: isChrome() ? true : false,  // Enable trickle for Chrome
      config: {
        iceServers: iceServers,
        // Chrome-specific ICE configuration
        iceTransportPolicy: 'all',
        bundlePolicy: 'balanced',
        rtcpMuxPolicy: 'require'
      },
      // Enhanced offer options for Chrome
      offerOptions: {
        offerToReceiveAudio: false,
        offerToReceiveVideo: false,
        iceRestart: true
      },
      // Chrome-compatible channel configuration
      channelConfig: {
        ordered: true,
        maxRetransmits: 10,
        protocol: 'video-transfer'
      },
      // Chrome-specific constraints
      constraints: {
        mandatory: {
          OfferToReceiveAudio: false,
          OfferToReceiveVideo: false
        }
      }
    })
    peersRef.current[from] = peer
    const chunks = []

    peer.on('signal', signal => {
      socket.emit('video-file-signal', { to: from, signal })
    })

    peer.on('data', data => {
      try {
        const message = JSON.parse(data.toString())
        
        if (message.type === 'chunk') {
          chunks[message.index] = new Uint8Array(message.data)
          const receivedCount = chunks.filter(Boolean).length
          const progress = Math.round((receivedCount / message.total) * 100)
          
          setDownloadProgress(prev => ({ ...prev, [fileInfo.name]: progress }))
          
          // Log progress every 10%
          if (receivedCount % Math.floor(message.total / 10) === 0) {
            console.log(`Download progress: ${receivedCount}/${message.total} chunks (${progress}%)`)
          }
        } else if (message.type === 'complete') {
          console.log('Received complete signal')
          
          // Check if we have all chunks
          const receivedCount = chunks.filter(Boolean).length
          const totalChunks = message.total || chunks.length
          
          if (receivedCount < totalChunks) {
            console.warn(`Missing chunks: received ${receivedCount}/${totalChunks}`)
            // Find missing chunks
            const missing = []
            for (let i = 0; i < totalChunks; i++) {
              if (!chunks[i]) missing.push(i)
            }
            console.log('Missing chunk indices:', missing)
          }
          
          // Create blob from received chunks
          const validChunks = chunks.filter(Boolean)
          const blob = new Blob(validChunks, { type: fileInfo.type })
          const url = URL.createObjectURL(blob)
          
          console.log(`Created blob: ${blob.size} bytes (expected: ${fileInfo.size} bytes)`)
          
          setVideoBlob(blob)
          setSharingStatus('ready')
          setDownloadProgress(prev => ({ ...prev, [fileInfo.name]: 100 }))
          
          // Notify parent component that video is ready
          if (onVideoReady) {
            console.log('Calling onVideoReady with URL:', url)
            onVideoReady(url, fileInfo)
          }
          
          // Force a small delay to ensure state updates propagate
          setTimeout(() => {
          }, 100)
          
          delete peersRef.current[from]
        }
      } catch (err) {
      }
    })

    peer.on('error', err => {
      setSharingStatus('error')
      delete peersRef.current[from]
    })
    
    // Monitor connection state for debugging
    peer.on('iceStateChange', (iceConnectionState, iceGatheringState) => {
      console.log('ICE state change:', iceConnectionState, iceGatheringState)
    })
    
    peer.on('connect', () => {
      console.log('Peer connected successfully')
    })
  }, [socket, isHost, onVideoReady])

  // Set up socket listeners
  useEffect(() => {
    if (!socket) {
      return
    }

    // Test listener to debug
    const testHandler = (data) => {
      handleVideoFileInfo(data)
    }
    
    // Handle cancellation
    const handleCancel = () => {
      cancelTransfer()
    }
    
    // Add listeners with logging
    const events = {
      'video-file-request': handleVideoFileRequest,
      'video-file-signal': handleSignal,
      'video-file-ready': handleVideoReady,
      'video-file-info': testHandler,
      'video-file-cancel': handleCancel
    }
    
    Object.entries(events).forEach(([event, handler]) => {
      socket.on(event, handler)
    })

    return () => {
      Object.entries(events).forEach(([event, handler]) => {
        socket.off(event, handler)
      })
      Object.values(peersRef.current).forEach(peer => peer.destroy())
    }
  }, [socket, handleVideoFileRequest, handleSignal, handleVideoReady, handleVideoFileInfo, isHost, participants])

  const handleFileSelect = (e) => {
    const file = e.target.files[0]
    if (!file) return

    // Check if it's a video file
    if (!file.type.startsWith('video/')) {
      alert('Please select a video file')
      return
    }

    // Check file size (limit to 3GB)
    if (file.size > 3 * 1024 * 1024 * 1024) {
      alert('File too large. Please select a video under 3GB')
      return
    }

    // Clean up previous file/state
    if (videoBlob && typeof videoBlob === 'string') {
      URL.revokeObjectURL(videoBlob)
    }
    setVideoBlob(null)
    setIsSharing(false)
    setSharingStatus('idle')
    setDownloadProgress({})
    setUploadProgress(0)
    
    // Close any existing peer connections
    Object.values(peersRef.current).forEach(peer => {
      if (peer && !peer.destroyed) {
        peer.destroy()
      }
    })
    peersRef.current = {}

    setSelectedFile(file)
    fileInfoRef.current = {
      name: file.name,
      size: file.size,
      type: file.type
    }

    // If host, prepare file for sharing
    if (isHost) {
      setSharingStatus('ready')
    }
    
    // Reset the file input to allow selecting the same file again
    e.target.value = null
  }

  const shareVideoFile = () => {
    if (!selectedFile || !isHost) {
      return
    }

    setSharingStatus('sharing')
    setIsSharing(true)

    // Create video URL for host
    const url = URL.createObjectURL(selectedFile)
    setVideoBlob(selectedFile)
    
    // Notify parent component that video is ready for host
    if (onVideoReady) {
      onVideoReady(url, fileInfoRef.current)
    }

    // Broadcast video file info to all participants
    console.log('🎥 Broadcasting video file share:', {
      roomId,
      fileInfo: fileInfoRef.current,
      socketId: socket.id
    })
    socket.emit('video-file-share', {
      roomId,
      fileInfo: fileInfoRef.current
    })
  }

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  // Accept file transfer
  const acceptFileTransfer = () => {
    if (!pendingFileInfo || !pendingHostId) return
    
    setSharingStatus('downloading')
    setDownloadProgress(prev => ({ ...prev, [pendingFileInfo.name]: 0 }))
    
    // Request video file from host
    socket.emit('video-file-request', { to: pendingHostId })
  }

  // Reject file transfer
  const rejectFileTransfer = () => {
    setSharingStatus('idle')
    setPendingFileInfo(null)
    setPendingHostId(null)
  }

  // Cancel ongoing transfer
  const cancelTransfer = () => {
    
    // Close all peer connections
    Object.values(peersRef.current).forEach(peer => {
      if (peer && !peer.destroyed) {
        peer.destroy()
      }
    })
    peersRef.current = {}
    
    // Reset states
    setSharingStatus('idle')
    setIsSharing(false)
    setDownloadProgress({})
    setUploadProgress(0)
    currentTransferRef.current = null
    
    // Notify peers about cancellation
    if (socket) {
      socket.emit('video-file-cancel', { roomId })
    }
  }

  return (
    <div className="bg-white/5 backdrop-blur-xl border border-white/5 rounded-2xl p-5 space-y-5">
      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
        <Upload className="h-4 w-4 text-violet-400" />
        P2P Video Sharing
      </h3>

      {isHost && hostVideoSource === 'file' ? (
        <div className="space-y-4">
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="glass-button w-full !from-violet-600 !to-violet-500 !py-2.5 text-xs tracking-wider"
              disabled={sharingStatus === 'sharing'}
            >
              <Upload className="h-4 w-4" />
              SELECT VIDEO FILE
            </button>
          </div>

          {selectedFile && (
            <div className="bg-white/5 border border-white/5 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium text-sm truncate">{selectedFile.name}</p>
                  <p className="text-slate-500 text-[10px] font-mono mt-0.5">{formatFileSize(selectedFile.size)}</p>
                </div>
                {sharingStatus === 'ready' && (
                  <CheckCircle className="h-5 w-5 text-green-400" />
                )}
              </div>

              {sharingStatus === 'ready' && !isSharing && (
                <button
                  onClick={shareVideoFile}
                  className="w-full mt-4 glass-button !from-green-600 !to-green-500 !py-2.5 text-[10px] tracking-widest"
                >
                  <Users className="h-4 w-4" />
                  INITIALIZE TRANSFER ({participants.length - 1} PEERS)
                </button>
              )}

              {isSharing && (
                <div className="mt-4 space-y-3">
                  <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 text-center">
                    <p className="text-green-400 text-[10px] font-bold uppercase tracking-wider">Protocol Active</p>
                    <p className="text-slate-400 text-[10px] mt-1">Participants are synchronizing...</p>
                  </div>
                  <button
                    onClick={cancelTransfer}
                    className="w-full glass-button !from-red-600 !to-red-500 !py-2 text-[10px] tracking-widest opacity-50 hover:opacity-100"
                  >
                    TERMINATE TRANSFER
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      ) : isHost && hostVideoSource !== 'file' ? (
        <div className="text-center py-6 px-4 bg-white/5 rounded-2xl border border-dashed border-white/10 group">
          <Upload className="h-10 w-10 mx-auto mb-3 text-slate-600 group-hover:text-violet-500/50 transition-colors" />
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest leading-relaxed">
            Switch to "Local File (P2P)"<br/>mode to share video files
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {sharingStatus === 'idle' && (
            <div className="text-center py-8 px-4 bg-white/5 rounded-2xl border border-dashed border-white/10">
              <Users className="h-10 w-10 mx-auto mb-3 text-slate-700 animate-pulse" />
              <p className="text-slate-600 text-[10px] font-bold uppercase tracking-widest">Awaiting host transmission...</p>
            </div>
          )}

          {sharingStatus === 'pending' && pendingFileInfo && (
            <div className="space-y-3">
              <div className="bg-violet-500/10 border border-violet-500/20 rounded-2xl p-5 text-center">
                <Download className="h-10 w-10 mx-auto mb-4 text-violet-400" />
                <p className="text-white font-bold text-sm mb-1 tracking-tight">Incoming Data Stream</p>
                <div className="bg-black/20 rounded-xl p-3 my-4 border border-white/5">
                  <p className="text-violet-300 font-mono text-[10px] truncate">{pendingFileInfo.name}</p>
                  <p className="text-slate-500 text-[10px] font-mono mt-1 uppercase">{formatFileSize(pendingFileInfo.size)}</p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={acceptFileTransfer}
                    className="flex-1 glass-button !from-violet-600 !to-violet-500 !py-2.5 text-[10px] tracking-widest"
                  >
                    ACCEPT
                  </button>
                  <button
                    onClick={rejectFileTransfer}
                    className="flex-1 glass-button !bg-transparent !border-white/10 !from-transparent !to-transparent hover:!bg-white/5 !py-2.5 text-[10px] tracking-widest"
                  >
                    REJECT
                  </button>
                </div>
              </div>
            </div>
          )}

          {sharingStatus === 'downloading' && (
            <div className="space-y-4 bg-white/5 border border-white/5 rounded-2xl p-5">
              <div className="text-center">
                <div className="w-12 h-12 bg-violet-500/20 rounded-full flex items-center justify-center mx-auto mb-3 border border-violet-500/30">
                  <Download className="h-6 w-6 text-violet-400 animate-bounce" />
                </div>
                <p className="text-white font-bold text-xs uppercase tracking-widest">Synchronizing Data...</p>
              </div>
              
              {Object.entries(downloadProgress).map(([fileName, progress]) => (
                <div key={fileName} className="space-y-3">
                  <div className="flex justify-between items-end">
                    <span className="text-slate-400 text-[10px] font-mono truncate max-w-[150px]">{fileName}</span>
                    <span className="text-violet-400 font-bold text-xs">{progress}%</span>
                  </div>
                  <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden border border-white/5">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      className="bg-gradient-to-r from-violet-500 to-cyan-500 h-full shadow-[0_0_10px_rgba(139,92,246,0.5)]"
                    />
                  </div>
                </div>
              ))}
              
              <button
                onClick={cancelTransfer}
                className="w-full glass-button !from-red-600 !to-red-500 !py-2 text-[10px] tracking-widest opacity-50 hover:opacity-100"
              >
                ABORT DOWNLOAD
              </button>
            </div>
          )}

          {sharingStatus === 'ready' && (
            <div className="text-center py-8 px-4 bg-green-500/5 rounded-2xl border border-green-500/20">
              <CheckCircle className="h-10 w-10 mx-auto mb-3 text-green-400" />
              <p className="text-green-400 text-[10px] font-bold uppercase tracking-widest">Buffer Ready</p>
              <p className="text-slate-500 text-[10px] mt-1 uppercase">Media pipeline initialized</p>
            </div>
          )}

          {sharingStatus === 'error' && (
            <div className="text-center py-8 px-4 bg-red-500/5 rounded-2xl border border-red-500/20">
              <AlertCircle className="h-10 w-10 mx-auto mb-3 text-red-400" />
              <p className="text-red-400 text-[10px] font-bold uppercase tracking-widest">Protocol Failure</p>
              <p className="text-slate-500 text-[10px] mt-1 uppercase">Connection terminated by peer</p>
            </div>
          )}
        </div>
      )}

      <div className="bg-black/20 rounded-xl p-3 border border-white/5">
        <p className="text-[9px] text-slate-500 text-center font-bold uppercase tracking-[0.1em] leading-relaxed">
          P2P encryption active • End-to-end direct link<br/>
          <span className="text-slate-600 mt-1 block">Protocols: MP4, WebM, MOV, AVI (Max 3GB)</span>
        </p>
      </div>
    </div>
  )
}