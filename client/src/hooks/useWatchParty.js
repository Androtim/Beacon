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

  // Join room on mount
  useEffect(() => {
    if (!socket || !roomId || !user) {
      console.log('⏳ Not ready to join room:', { socket: !!socket, roomId, user: !!user })
      return
    }

    console.log('🏠 Joining room:', roomId, 'as user:', user.username)
    socket.emit('join-room', {
      roomId,
      user: {
        id: user.id,
        username: user.username
      }
    })

    return () => {
      socket.emit('leave-room', { roomId, userId: user.id })
    }
  }, [socket, roomId, user])

  // Set up socket event listeners
  useEffect(() => {
    if (!socket) {
      console.log('⏳ WatchParty: Waiting for socket connection')
      return
    }
    console.log('🎬 WatchParty: Setting up socket listeners')

    // Room events
    socket.on('room-joined', (data) => {
      setParticipants(data.participants)
      setIsHost(data.isHost)
      setVideoState(data.videoState)
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
      setVideoState(prev => ({ ...prev, isPlaying: true, currentTime: data.currentTime }))
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
  }, [socket])

  // Video control functions
  const setVideoUrl = useCallback((url) => {
    if (!socket || !roomId) return
    socket.emit('video-url-set', { roomId, url })
  }, [socket, roomId])

  const playVideo = useCallback((currentTime) => {
    if (!socket || !roomId) return
    socket.emit('video-play', { roomId, currentTime })
  }, [socket, roomId])

  const pauseVideo = useCallback((currentTime) => {
    if (!socket || !roomId) return
    socket.emit('video-pause', { roomId, currentTime })
  }, [socket, roomId])

  const seekVideo = useCallback((currentTime) => {
    if (!socket || !roomId) return
    socket.emit('video-seek', { roomId, currentTime })
  }, [socket, roomId])

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
    setVideoUrl,
    playVideo,
    pauseVideo,
    seekVideo,
    sendMessage,
    connected: socket?.connectionStatus || false,
    socket // Return the socket instance that joined the room
  }
}