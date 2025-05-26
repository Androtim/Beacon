import { useState, useRef, useEffect, useCallback } from 'react'
import { Upload, Users, Play, Pause, Download, AlertCircle, CheckCircle } from 'lucide-react'
import SimplePeer from 'simple-peer'

// Detect if running in Chrome
const isChrome = () => {
  return /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor)
}

export default function VideoFileSharing({ socket, roomId, isHost, participants, onVideoReady, hostVideoSource }) {
  const [selectedFile, setSelectedFile] = useState(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isSharing, setIsSharing] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState({})
  const [videoBlob, setVideoBlob] = useState(null)
  const [sharingStatus, setSharingStatus] = useState('idle') // idle, uploading, sharing, ready, pending, downloading, error
  const [pendingFileInfo, setPendingFileInfo] = useState(null)
  const [pendingHostId, setPendingHostId] = useState(null)
  
  const fileInputRef = useRef(null)
  const peersRef = useRef({})
  const chunksRef = useRef([])
  const fileInfoRef = useRef(null)
  const currentTransferRef = useRef(null)

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
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:stun3.l.google.com:19302' },
          { urls: 'stun:stun4.l.google.com:19302' },
          // Add more STUN servers for better connectivity
          { urls: 'stun:stun.services.mozilla.com' },
          { urls: 'stun:stun.stunprotocol.org:3478' },
          // Add public TURN servers for NAT traversal
          {
            urls: 'turn:openrelay.metered.ca:80',
            username: 'openrelayproject',
            credential: 'openrelayproject'
          },
          {
            urls: 'turn:openrelay.metered.ca:443',
            username: 'openrelayproject',
            credential: 'openrelayproject'
          }
        ],
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
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:stun3.l.google.com:19302' },
          { urls: 'stun:stun4.l.google.com:19302' },
          // Add more STUN servers for better connectivity
          { urls: 'stun:stun.services.mozilla.com' },
          { urls: 'stun:stun.stunprotocol.org:3478' },
          // Add public TURN servers for NAT traversal
          {
            urls: 'turn:openrelay.metered.ca:80',
            username: 'openrelayproject',
            credential: 'openrelayproject'
          },
          {
            urls: 'turn:openrelay.metered.ca:443',
            username: 'openrelayproject',
            credential: 'openrelayproject'
          }
        ],
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
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-4">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
        <Upload className="h-5 w-5" />
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
              className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors"
              disabled={sharingStatus === 'sharing'}
            >
              <Upload className="h-4 w-4" />
              Select Video File
            </button>
          </div>

          {selectedFile && (
            <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-3">
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <p className="text-gray-900 dark:text-white font-medium">{selectedFile.name}</p>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">{formatFileSize(selectedFile.size)}</p>
                </div>
                {sharingStatus === 'ready' && (
                  <CheckCircle className="h-5 w-5 text-green-500 dark:text-green-400" />
                )}
              </div>

              {sharingStatus === 'ready' && !isSharing && (
                <button
                  onClick={shareVideoFile}
                  className="w-full mt-3 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors"
                >
                  <Users className="h-4 w-4" />
                  Share with Participants ({participants.length - 1})
                </button>
              )}

              {isSharing && (
                <div className="mt-3 space-y-2">
                  <div className="text-center text-green-500 dark:text-green-400 text-sm">
                    <CheckCircle className="h-4 w-4 inline mr-2" />
                    Video shared! Participants are downloading...
                  </div>
                  <button
                    onClick={cancelTransfer}
                    className="w-full bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg"
                  >
                    Cancel Transfer
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      ) : isHost && hostVideoSource !== 'file' ? (
        <div className="text-center text-gray-500 dark:text-gray-400 py-4">
          <Upload className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Switch to "Local File (P2P)" mode to share video files</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sharingStatus === 'idle' && (
            <div className="text-center text-gray-500 dark:text-gray-400 py-4">
              <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Waiting for host to share a video file...</p>
            </div>
          )}

          {sharingStatus === 'pending' && pendingFileInfo && (
            <div className="space-y-3">
              <div className="bg-yellow-100 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-600/50 rounded-lg p-4">
                <div className="text-center mb-4">
                  <Download className="h-8 w-8 mx-auto mb-2 text-yellow-600 dark:text-yellow-400" />
                  <p className="text-yellow-700 dark:text-yellow-400 font-semibold">Incoming Video File</p>
                </div>
                <div className="bg-white dark:bg-gray-700 rounded p-3 mb-4">
                  <p className="text-gray-900 dark:text-white font-medium">{pendingFileInfo.name}</p>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">{formatFileSize(pendingFileInfo.size)}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={acceptFileTransfer}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg"
                  >
                    Accept
                  </button>
                  <button
                    onClick={rejectFileTransfer}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg"
                  >
                    Reject
                  </button>
                </div>
              </div>
            </div>
          )}

          {sharingStatus === 'downloading' && (
            <div className="space-y-3">
              <div className="text-center text-blue-600 dark:text-blue-400">
                <Download className="h-6 w-6 mx-auto mb-2" />
                <p>Downloading video file...</p>
              </div>
              {Object.entries(downloadProgress).map(([fileName, progress]) => (
                <div key={fileName} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-900 dark:text-white">{fileName}</span>
                    <span className="text-gray-600 dark:text-gray-400">{progress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              ))}
              <button
                onClick={cancelTransfer}
                className="w-full bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg"
              >
                Cancel Download
              </button>
            </div>
          )}

          {sharingStatus === 'ready' && (
            <div className="text-center text-green-600 dark:text-green-400 py-4">
              <CheckCircle className="h-8 w-8 mx-auto mb-2" />
              <p>Video file downloaded and ready!</p>
            </div>
          )}

          {sharingStatus === 'error' && (
            <div className="text-center text-red-600 dark:text-red-400 py-4">
              <AlertCircle className="h-8 w-8 mx-auto mb-2" />
              <p>Error downloading video file. Please try again.</p>
            </div>
          )}
        </div>
      )}

      <div className="text-xs text-gray-500 dark:text-gray-500 text-center">
        <p>P2P sharing - files are transferred directly between browsers</p>
        <p>Supported formats: MP4, WebM, MOV, AVI (max 3GB)</p>
      </div>
    </div>
  )
}