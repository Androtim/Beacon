import { useState, useEffect, useCallback } from 'react'
import { useSocketContext } from '../context/SocketContext'

export function useWatchParty(roomId, user) {
  const { socket, connected } = useSocketContext()
  const [participants, setParticipants] = useState([])
  const [isHost, setIsHost] = useState(false)
  const [messages, setMessages] = useState([])
  const [videoState, setVideoState] = useState({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    url: null,
  })
  const [fileShare, setFileShare] = useState(null)

  // Clock sync lands in Phase 2; until then events use local time.
  const getSyncedTime = useCallback(() => Date.now(), [])

  // Join on mount AND on every reconnect: the server treats a rejoin as a
  // presence refresh and replies with the full room state (resync).
  useEffect(() => {
    if (!socket || !roomId || !user) return

    const join = () => socket.emit('join-room', { roomId })
    if (socket.connected) join()
    socket.on('connect', join)

    return () => {
      socket.off('connect', join)
      socket.emit('leave-room', { roomId })
    }
  }, [socket, roomId, user])

  useEffect(() => {
    if (!socket) return

    const handlers = {
      'room-joined': (data) => {
        setParticipants(data.participants)
        setIsHost(data.isHost)
        setVideoState((prev) => ({ ...prev, ...data.videoState }))
        setFileShare(data.fileShare ?? null)
      },
      'user-joined': (data) => {
        setParticipants(data.participants)
        setMessages((prev) => [...prev, {
          type: 'system',
          message: `${data.user.username} joined the party`,
          timestamp: Date.now(),
        }])
      },
      'user-left': (data) => {
        setParticipants(data.participants)
        setMessages((prev) => [...prev, {
          type: 'system',
          message: `${data.user.username} left the party`,
          timestamp: Date.now(),
        }])
      },
      'participants-updated': (data) => {
        setParticipants(data.participants)
      },
      'host-changed': (data) => {
        setIsHost(data.newHost === (user?.id))
        setMessages((prev) => [...prev, {
          type: 'system',
          message: 'Host changed',
          timestamp: Date.now(),
        }])
      },
      'video-url-set': (data) => {
        setVideoState((prev) => ({ ...prev, url: data.url, isPlaying: false, currentTime: 0 }))
      },
      'video-play': (data) => {
        const latency = Date.now() - data.timestamp
        const compensatedTime = data.currentTime + latency / 1000
        setVideoState((prev) => ({ ...prev, isPlaying: true, currentTime: compensatedTime }))
      },
      'video-pause': (data) => {
        setVideoState((prev) => ({ ...prev, isPlaying: false, currentTime: data.currentTime }))
      },
      'video-seek': (data) => {
        setVideoState((prev) => ({ ...prev, currentTime: data.currentTime }))
      },
      'chat-message': (data) => {
        setMessages((prev) => [...prev, {
          type: 'chat',
          username: data.username,
          message: data.message,
          timestamp: data.timestamp,
        }])
      },
    }

    for (const [event, handler] of Object.entries(handlers)) socket.on(event, handler)
    return () => {
      for (const [event, handler] of Object.entries(handlers)) socket.off(event, handler)
    }
  }, [socket, user?.id])

  const setVideoUrl = useCallback((url) => {
    if (!socket || !roomId) return
    socket.emit('video-url-set', { roomId, url })
  }, [socket, roomId])

  const playVideo = useCallback((currentTime) => {
    if (!socket || !roomId) return
    socket.emit('video-play', { roomId, currentTime, timestamp: getSyncedTime() })
  }, [socket, roomId, getSyncedTime])

  const pauseVideo = useCallback((currentTime) => {
    if (!socket || !roomId) return
    socket.emit('video-pause', { roomId, currentTime, timestamp: getSyncedTime() })
  }, [socket, roomId, getSyncedTime])

  const seekVideo = useCallback((currentTime) => {
    if (!socket || !roomId) return
    socket.emit('video-seek', { roomId, currentTime, timestamp: getSyncedTime() })
  }, [socket, roomId, getSyncedTime])

  const sendMessage = useCallback((message) => {
    if (!socket || !roomId || !user) return
    socket.emit('chat-message', { roomId, message, timestamp: Date.now() })
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
    connected,
    socket,
  }
}
