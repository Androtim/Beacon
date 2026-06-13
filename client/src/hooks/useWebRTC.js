import { useEffect, useRef, useState, useCallback } from 'react'

export function useWebRTC(socket, iceServers = []) {
  const [sharingStatus, setSharingStatus] = useState('idle') // idle, connecting, transferring, complete, error
  const [uploadProgress, setUploadProgress] = useState({})
  const [downloadProgress, setDownloadProgress] = useState({})
  const [dataChannelStates, setDataChannelStates] = useState({}) // Map of peerId -> 'connecting' | 'open' | 'closed'
  
  const peerConnectionsRef = useRef({}) // Map of targetSocketId -> RTCPeerConnection
  const dataChannelsRef = useRef({}) // Map of targetSocketId -> RTCDataChannel
  const downloadChunksRef = useRef({}) // Map of fileIndex/name -> array of chunks
  const downloadMetaRef = useRef(null) // Current metadata for receiving file
  const activeTransfersRef = useRef(new Set()) // Tracks ongoing transfers
  
  const defaultIceServers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ]

  const getIceConfig = useCallback(() => {
    return {
      iceServers: iceServers && iceServers.length > 0 ? iceServers : defaultIceServers,
      iceCandidatePoolSize: 10
    }
  }, [iceServers])

  // Clean up a specific connection
  const cleanupConnection = useCallback((peerId) => {
    console.log(`🧹 Cleaning up WebRTC connection for peer: ${peerId}`)
    setDataChannelStates(prev => ({ ...prev, [peerId]: 'closed' }))
    
    if (dataChannelsRef.current[peerId]) {
      try {
        dataChannelsRef.current[peerId].close()
      } catch (e) {}
      delete dataChannelsRef.current[peerId]
    }

    if (peerConnectionsRef.current[peerId]) {
      try {
        peerConnectionsRef.current[peerId].close()
      } catch (e) {}
      delete peerConnectionsRef.current[peerId]
    }

    activeTransfersRef.current.delete(peerId)
    if (activeTransfersRef.current.size === 0) {
      setSharingStatus('idle')
    }
  }, [])

  // Clean up all connections
  const cleanupAll = useCallback(() => {
    Object.keys(peerConnectionsRef.current).forEach(peerId => {
      cleanupConnection(peerId)
    })
    setUploadProgress({})
    setDownloadProgress({})
    setDataChannelStates({})
    downloadChunksRef.current = {}
    downloadMetaRef.current = null
    setSharingStatus('idle')
  }, [cleanupConnection])

  // Set up data channel event listeners
  const setupDataChannel = useCallback((channel, peerId, onFileReceived) => {
    channel.binaryType = 'arraybuffer'
    
    channel.onopen = () => {
      if (dataChannelsRef.current[peerId] !== channel) return
      console.log(`🔌 Data channel opened with peer: ${peerId}`)
      setSharingStatus('transferring')
      setDataChannelStates(prev => ({ ...prev, [peerId]: 'open' }))
    }

    channel.onclose = () => {
      if (dataChannelsRef.current[peerId] !== channel) return
      console.log(`🔌 Data channel closed with peer: ${peerId}`)
      setDataChannelStates(prev => ({ ...prev, [peerId]: 'closed' }))
      cleanupConnection(peerId)
    }

    channel.onerror = (error) => {
      if (dataChannelsRef.current[peerId] !== channel) return
      console.error(`❌ Data channel error with peer ${peerId}:`, error)
      setSharingStatus('error')
    }

    channel.onmessage = (event) => {
      if (dataChannelsRef.current[peerId] !== channel) return
      // Handle string messages (metadata or control)
      if (typeof event.data === 'string') {
        try {
          const message = JSON.parse(event.data)
          if (message.type === 'file-meta') {
            console.log('📄 Received file metadata:', message)
            downloadMetaRef.current = message
            downloadChunksRef.current[message.fileName] = []
            setDownloadProgress(prev => ({ ...prev, [message.fileName]: 0 }))
            setSharingStatus('transferring')
          } else if (message.type === 'file-complete') {
            const meta = downloadMetaRef.current
            if (meta && meta.fileName === message.fileName) {
              console.log('✅ File transfer complete:', meta.fileName)
              const chunks = downloadChunksRef.current[meta.fileName] || []
              const blob = new Blob(chunks, { type: meta.fileType })
              
              if (onFileReceived) {
                onFileReceived(blob, meta.fileName, meta.fileType)
              }
              
              setDownloadProgress(prev => ({ ...prev, [meta.fileName]: 100 }))
              setSharingStatus('complete')
              downloadMetaRef.current = null
            }
          }
        } catch (err) {
          console.error('❌ Error parsing data channel string message:', err)
        }
      } else {
        // Handle binary chunk message
        const meta = downloadMetaRef.current
        if (meta) {
          const chunks = downloadChunksRef.current[meta.fileName]
          if (chunks) {
            chunks.push(event.data)
            const receivedChunks = chunks.length
            const percent = Math.round((receivedChunks / meta.totalChunks) * 100)
            
            if (receivedChunks % 20 === 0 || receivedChunks === meta.totalChunks) {
              setDownloadProgress(prev => ({ ...prev, [meta.fileName]: percent }))
            }
          }
        }
      }
    }
  }, [cleanupConnection])

  // Initiate connection to a target peer
  const initiateConnection = useCallback(async (targetSocketId, onFileReceived, signalEventName = 'video-file-signal') => {
    console.log(`🚀 Initiating WebRTC connection to: ${targetSocketId}`)
    cleanupConnection(targetSocketId)

    setSharingStatus('connecting')
    setDataChannelStates(prev => ({ ...prev, [targetSocketId]: 'connecting' }))
    const pc = new RTCPeerConnection(getIceConfig())
    peerConnectionsRef.current[targetSocketId] = pc

    // Create the data channel
    const dc = pc.createDataChannel('fileTransfer', { ordered: true })
    dataChannelsRef.current[targetSocketId] = dc
    setupDataChannel(dc, targetSocketId, onFileReceived)

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (peerConnectionsRef.current[targetSocketId] !== pc) return
      if (event.candidate && socket) {
        socket.emit(signalEventName, { to: targetSocketId, signal: { candidate: event.candidate } })
      }
    }

    pc.onconnectionstatechange = () => {
      console.log(`🌐 Connection state change with ${targetSocketId}: ${pc.connectionState}`)
      if (peerConnectionsRef.current[targetSocketId] !== pc) return
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        cleanupConnection(targetSocketId)
      }
    }

    try {
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      if (socket) {
        socket.emit(signalEventName, { to: targetSocketId, signal: offer })
      }
    } catch (error) {
      console.error('❌ Error creating SDP offer:', error)
      setSharingStatus('error')
    }
  }, [getIceConfig, socket, setupDataChannel, cleanupConnection])

  // Handle incoming signaling message (offer, answer, or candidate)
  const handleIncomingSignal = useCallback(async (from, signal, onFileReceived, signalEventName = 'video-file-signal') => {
    let pc = peerConnectionsRef.current[from]

    // Create connection if it doesn't exist (responder side)
    if (!pc) {
      console.log(`📥 Creating RTCPeerConnection for signal from: ${from}`)
      setDataChannelStates(prev => ({ ...prev, [from]: 'connecting' }))
      pc = new RTCPeerConnection(getIceConfig())
      peerConnectionsRef.current[from] = pc

      pc.onicecandidate = (event) => {
        if (peerConnectionsRef.current[from] !== pc) return
        if (event.candidate && socket) {
          socket.emit(signalEventName, { to: from, signal: { candidate: event.candidate } })
        }
      }

      pc.onconnectionstatechange = () => {
        console.log(`🌐 Connection state change with ${from}: ${pc.connectionState}`)
        if (peerConnectionsRef.current[from] !== pc) return
        if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
          cleanupConnection(from)
        }
      }

      pc.ondatachannel = (event) => {
        if (peerConnectionsRef.current[from] !== pc) return
        console.log(`📥 Received data channel from: ${from}`)
        dataChannelsRef.current[from] = event.channel
        setupDataChannel(event.channel, from, onFileReceived)
      }
    }

    try {
      if (signal.type === 'offer') {
        console.log(`📥 Handling SDP offer from: ${from}`)
        await pc.setRemoteDescription(new RTCSessionDescription(signal))
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        if (socket) {
          socket.emit(signalEventName, { to: from, signal: answer })
        }
      } else if (signal.type === 'answer') {
        console.log(`📥 Handling SDP answer from: ${from}`)
        await pc.setRemoteDescription(new RTCSessionDescription(signal))
      } else if (signal.candidate) {
        // Wait a split second if remote description isn't set yet
        if (pc.remoteDescription) {
          await pc.addIceCandidate(new RTCIceCandidate(signal.candidate))
        } else {
          // Retry queue if remote description isn't set yet
          const checkDesc = setInterval(async () => {
            if (pc.remoteDescription) {
              clearInterval(checkDesc)
              try {
                await pc.addIceCandidate(new RTCIceCandidate(signal.candidate))
              } catch (e) {}
            }
          }, 100)
          setTimeout(() => clearInterval(checkDesc), 5000) // Timeout after 5s
        }
      }
    } catch (err) {
      console.error('❌ Error handling incoming signaling message:', err)
    }
  }, [getIceConfig, socket, setupDataChannel, cleanupConnection])

  // Send a file to a specific peer using flow control
  const sendFileToPeer = useCallback(async (peerId, file) => {
    const dc = dataChannelsRef.current[peerId]
    if (!dc || dc.readyState !== 'open') {
      console.warn(`[WebRTC] Cannot send file to ${peerId}. Data channel not open.`)
      return false
    }

    console.log(`📤 Starting transfer of ${file.name} to ${peerId} (Size: ${file.size} bytes)`)
    activeTransfersRef.current.add(peerId)
    setSharingStatus('transferring')

    const chunkSize = 64 * 1025 // 64KB chunks
    const totalChunks = Math.ceil(file.size / chunkSize)
    
    // Set bufferedAmountLowThreshold to avoid drying out the pipeline
    dc.bufferedAmountLowThreshold = 256 * 1025 // 256KB

    // Send metadata
    dc.send(JSON.stringify({
      type: 'file-meta',
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      totalChunks
    }))

    // Helper to pause sending when buffer is full
    const waitBufferLow = () => new Promise((resolve) => {
      if (dc.bufferedAmount <= 256 * 1025) {
        resolve()
        return
      }
      const handleAmountLow = () => {
        dc.removeEventListener('bufferedamountlow', handleAmountLow)
        resolve()
      }
      dc.addEventListener('bufferedamountlow', handleAmountLow)
    })

    try {
      for (let index = 0; index < totalChunks; index++) {
        // Read file slice
        const start = index * chunkSize
        const end = Math.min(start + chunkSize, file.size)
        const chunk = await file.slice(start, end).arrayBuffer()

        // Wait if data channel buffer is full
        await waitBufferLow()

        // Send binary chunk directly
        dc.send(chunk)

        // Update progress
        if (index % 10 === 0 || index === totalChunks - 1) {
          const percent = Math.round(((index + 1) / totalChunks) * 100)
          setUploadProgress(prev => ({ ...prev, [file.name]: percent }))
        }
      }

      // Signal completion
      dc.send(JSON.stringify({
        type: 'file-complete',
        fileName: file.name
      }))

      console.log(`📤 Finished sending ${file.name} to ${peerId}`)
      activeTransfersRef.current.delete(peerId)
      if (activeTransfersRef.current.size === 0) {
        setSharingStatus('complete')
      }
      return true
    } catch (err) {
      console.error(`❌ Error during file send to ${peerId}:`, err)
      setSharingStatus('error')
      activeTransfersRef.current.delete(peerId)
      return false
    }
  }, [])

  // Auto clean up on unmount
  useEffect(() => {
    return () => {
      cleanupAll()
    }
  }, [cleanupAll])

  return {
    sharingStatus,
    setSharingStatus,
    uploadProgress,
    setUploadProgress,
    downloadProgress,
    setDownloadProgress,
    dataChannelStates,
    initiateConnection,
    handleIncomingSignal,
    sendFileToPeer,
    cleanupConnection,
    cleanupAll
  }
}
