import { useState, useEffect, useCallback } from 'react'
import { useSocket } from './useSocket'

export function useWatchParty(roomId, user) {
  const socket = useSocket()
  const [participants, setParticipants] = useState([])
  const [isHost, setIsHost] = useState(false)
  const [messages, setMessages] = useState([])
  const [videoState, setVideoState] = useState({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    url: null
  })
  const [fileShare, setFileShare] = useState(null)

  const [serverOffset, setServerOffset] = useState(0)

  // Clock Synchronization Protocol
  const syncClock = useCallback(() => {
    if (!socket) return
    const start = Date.now()
    socket.emit('get-server-time', (serverTime) => {
      const end = Date.now()
      const rtt = end - start
      const offset = serverTime - (end - rtt / 2)
      setServerOffset(offset)
      console.log(`⏱️ Clock sync: RTT=${rtt}ms, Offset=${offset}ms`)
    })
  }, [socket])

  // Get current synchronized time
  const getSyncedTime = useCallback(() => Date.now() + serverOffset, [serverOffset])

  // Join room on mount
  useEffect(() => {
    if (!socket || !roomId || !user) {
      return
    }

    // Initial clock sync
    syncClock()
    const syncInterval = setInterval(syncClock, 30000) // Re-sync every 30s

    console.log('🏠 Joining room:', roomId, 'as user:', user.username)
    socket.emit('join-room', {
      roomId,
      user: {
        id: user.id,
        username: user.username
      }
    })

    return () => {
      clearInterval(syncInterval)
      socket.emit('leave-room', { roomId, userId: user.id })
    }
  }, [socket, roomId, user, syncClock])

  // Set up socket event listeners
  useEffect(() => {
    if (!socket) return

    // Room events
    socket.on('room-joined', (data) => {
      setParticipants(data.participants)
      setIsHost(data.isHost)
      setVideoState(data.videoState)
      if (data.fileShare) {
        setFileShare(data.fileShare)
      }
    })

    socket.on('user-joined', (data) => {
      setParticipants(data.participants)
      setMessages(prev => [...prev, {
        type: 'system',
        message: `${data.user.username} joined the party`,
        timestamp: Date.now()
      }])
    })

    socket.on('user-left', (data) => {
      setParticipants(data.participants)
      setMessages(prev => [...prev, {
        type: 'system',
        message: `${data.user.username} left the party`,
        timestamp: Date.now()
      }])
    })

    // Video sync events
    socket.on('video-url-set', (data) => {
      setVideoState(prev => ({ ...prev, url: data.url }))
    })

    socket.on('video-play', (data) => {
      // Latency compensation
      const now = getSyncedTime()
      const latency = now - data.timestamp
      const compensatedTime = data.currentTime + (latency / 1000)
      
      console.log(`🎬 Received play: latency=${latency}ms, compensatedTime=${compensatedTime}`)
      setVideoState(prev => ({ 
        ...prev, 
        isPlaying: true, 
        currentTime: compensatedTime 
      }))
    })

    socket.on('video-pause', (data) => {
      setVideoState(prev => ({ ...prev, isPlaying: false, currentTime: data.currentTime }))
    })

    socket.on('video-seek', (data) => {
      setVideoState(prev => ({ ...prev, currentTime: data.currentTime }))
    })

    // Chat events
    socket.on('chat-message', (data) => {
      setMessages(prev => [...prev, {
        type: 'chat',
        username: data.username,
        message: data.message,
        timestamp: data.timestamp
      }])
    })

    return () => {
      socket.off('room-joined')
      socket.off('user-joined')
      socket.off('user-left')
      socket.off('video-url-set')
      socket.off('video-play')
      socket.off('video-pause')
      socket.off('video-seek')
      socket.off('chat-message')
    }
  }, [socket, getSyncedTime])

  // Video control functions
  const setVideoUrl = useCallback((url) => {
    if (!socket || !roomId) return
    socket.emit('video-url-set', { roomId, url })
  }, [socket, roomId])

  const playVideo = useCallback((currentTime) => {
    if (!socket || !roomId) return
    socket.emit('video-play', { 
      roomId, 
      currentTime, 
      timestamp: getSyncedTime() 
    })
  }, [socket, roomId, getSyncedTime])

  const pauseVideo = useCallback((currentTime) => {
    if (!socket || !roomId) return
    socket.emit('video-pause', { 
      roomId, 
      currentTime, 
      timestamp: getSyncedTime() 
    })
  }, [socket, roomId, getSyncedTime])

  const seekVideo = useCallback((currentTime) => {
    if (!socket || !roomId) return
    socket.emit('video-seek', { 
      roomId, 
      currentTime, 
      timestamp: getSyncedTime() 
    })
  }, [socket, roomId, getSyncedTime])

  const sendMessage = useCallback((message) => {
    if (!socket || !roomId || !user) return
    socket.emit('chat-message', {
      roomId,
      username: user.username,
      message,
      timestamp: Date.now()
    })
  }, [socket, roomId, user])

  return {
    participants,
    isHost,
    messages,
    videoState,
    fileShare,
    setVideoUrl,
    playVideo,
    pauseVideo,
    seekVideo,
    sendMessage,
    connected: socket?.connectionStatus || false,
    socket 
  }
}
