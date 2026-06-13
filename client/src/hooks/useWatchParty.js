import { useState, useEffect, useCallback, useRef } from 'react'
import { useSocketContext } from '../context/SocketContext'
import { createClock } from '../lib/clock'

export function useWatchParty(roomId, user) {
  const { socket, connected } = useSocketContext()
  const [participants, setParticipants] = useState([])
  const [isHost, setIsHost] = useState(false)
  const [messages, setMessages] = useState([])
  // Authoritative playback state from the server (see shared/sync.ts).
  const [playback, setPlayback] = useState({ url: null, isPlaying: false, position: 0, atServerTime: 0 })
  const [fileShare, setFileShare] = useState(null)
  const [streamRequests, setStreamRequests] = useState([]) // host: pending suggestions
  const [myRequest, setMyRequest] = useState(null) // requester: { status: 'pending'|'approved'|'denied', url }

  // Clock offset to the server, recalibrated on every (re)connect.
  // serverNow() is null until the first calibration completes.
  const clockRef = useRef(null)
  const serverNow = useCallback(() => clockRef.current?.serverNow() ?? null, [])

  // Join on mount AND on every reconnect: the server treats a rejoin as a
  // presence refresh and replies with the full room state (resync).
  useEffect(() => {
    if (!socket || !roomId || !user) return

    clockRef.current = createClock(socket)
    const onConnect = () => {
      socket.emit('join-room', { roomId })
      clockRef.current?.calibrate()
    }
    if (socket.connected) onConnect()
    socket.on('connect', onConnect)

    return () => {
      socket.off('connect', onConnect)
      socket.emit('leave-room', { roomId })
    }
  }, [socket, roomId, user])

  useEffect(() => {
    if (!socket) return

    const handlers = {
      'room-joined': (data) => {
        setParticipants(data.participants)
        setIsHost(data.isHost)
        setPlayback(data.playback)
        setFileShare(data.fileShare ?? null)
      },
      'video-state': (data) => {
        setPlayback(data.playback)
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
        setIsHost(data.newHost === user?.id)
        setMessages((prev) => [...prev, {
          type: 'system',
          message: 'Host changed',
          timestamp: Date.now(),
        }])
      },
      'chat-message': (data) => {
        setMessages((prev) => [...prev, {
          type: 'chat',
          username: data.username,
          message: data.message,
          timestamp: data.timestamp,
        }])
      },
      'stream-request': (data) => {
        // Host received a suggestion to approve.
        setStreamRequests((prev) => [...prev.filter((r) => r.requestId !== data.requestId), data])
      },
      'stream-request-resolved': (data) => {
        // Requester learns the outcome.
        setMyRequest((prev) => (prev ? { ...prev, status: data.approved ? 'approved' : 'denied' } : prev))
      },
    }

    for (const [event, handler] of Object.entries(handlers)) socket.on(event, handler)
    return () => {
      for (const [event, handler] of Object.entries(handlers)) socket.off(event, handler)
    }
  }, [socket, user?.id])

  // Host intents. The server validates, persists, and broadcasts video-state;
  // nobody (including the host) applies state locally ahead of the broadcast.
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
    socket.emit('chat-message', { roomId, message })
  }, [socket, roomId, user])

  // Suggest a video. Host suggestions auto-apply server-side; others wait for approval.
  const requestStream = useCallback((url) => {
    if (!socket || !roomId) return
    socket.emit('stream-request', { roomId, url })
    if (!isHost) setMyRequest({ status: 'pending', url })
  }, [socket, roomId, isHost])

  const respondStream = useCallback((requestId, approve) => {
    if (!socket || !roomId) return
    socket.emit('stream-respond', { roomId, requestId, approve })
    setStreamRequests((prev) => prev.filter((r) => r.requestId !== requestId))
  }, [socket, roomId])

  const clearMyRequest = useCallback(() => setMyRequest(null), [])

  return {
    participants,
    isHost,
    messages,
    playback,
    serverNow,
    fileShare,
    streamRequests,
    myRequest,
    setVideoUrl,
    playVideo,
    pauseVideo,
    seekVideo,
    sendMessage,
    requestStream,
    respondStream,
    clearMyRequest,
    connected,
    socket,
  }
}
