import { useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import { useAuth } from '../context/AuthContext'

export function useSocket() {
  const socketRef = useRef()
  const [connected, setConnected] = useState(false)
  const { user } = useAuth()
  const userId = user?.id || user?._id || user?.username

  useEffect(() => {
    const token = localStorage.getItem('token')
    
    // Only connect if the user is authenticated
    if (!token || !userId) {
      if (socketRef.current) {
        socketRef.current.disconnect()
        socketRef.current = null
        setConnected(false)
      }
      return
    }

    console.log('🔌 Connecting to Socket.IO backend')
    
    // Connect directly to backend port 3001 in dev to bypass Vite proxy websocket issues
    const socketUrl = import.meta.env.DEV ? 'http://localhost:3001' : undefined
    socketRef.current = io(socketUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      autoConnect: false
    })

    socketRef.current.on('connect', () => {
      console.log('✅ Socket.IO connected')
      setConnected(true)
    })

    socketRef.current.on('disconnect', () => {
      console.log('❌ Socket.IO disconnected')
      setConnected(false)
    })

    socketRef.current.on('connect_error', (error) => {
      console.error('❌ Socket.IO connection error:', error)
      setConnected(false)
    })

    socketRef.current.connect()

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect()
        socketRef.current = null
      }
    }
  }, [userId])

  // Backward compatibility properties for components reading connection state
  if (socketRef.current) {
    socketRef.current.connected = connected
    socketRef.current.connectionStatus = connected
  }

  return socketRef.current
}
