import { useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import { useAuth } from '../context/AuthContext'

export function useSocket(serverUrl = window.location.origin) {
  const socketRef = useRef()
  const [connected, setConnected] = useState(false)
  const { user } = useAuth()

  useEffect(() => {
    console.log('🔌 Initializing socket connection to:', serverUrl)
    const token = localStorage.getItem('token')
    
    socketRef.current = io(serverUrl, {
      timeout: 20000,
      transports: ['polling', 'websocket'],
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      withCredentials: true,
      auth: {
        token: token
      }
    })

    socketRef.current.on('connect', () => {
      console.log('✅ Connected to server:', socketRef.current.id)
      setConnected(true)
    })

    socketRef.current.on('disconnect', (reason) => {
      console.log('❌ Disconnected from server:', reason)
      setConnected(false)
    })

    socketRef.current.on('connect_error', (error) => {
      console.error('❌ Connection error:', error.message)
      setConnected(false)
    })

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect()
      }
    }
  }, [serverUrl, user])

  // Add connected property to socket for backward compatibility
  if (socketRef.current) {
    socketRef.current.connected = connected
    socketRef.current.connectionStatus = connected
  }

  return socketRef.current
}
