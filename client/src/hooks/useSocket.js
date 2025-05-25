import { useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import { useAuth } from '../context/AuthContext'

export function useSocket(serverUrl = 'http://localhost:3001') {
  const socketRef = useRef()
  const [connected, setConnected] = useState(false)
  const { user } = useAuth()

  useEffect(() => {
    console.log('🔌 Initializing socket connection to:', serverUrl)
    socketRef.current = io(serverUrl, {
      timeout: 20000,
      transports: ['polling', 'websocket'], // Try polling first
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: 3,
      reconnectionDelay: 1000
    })

    socketRef.current.on('connect', () => {
      console.log('✅ Connected to server:', socketRef.current.id)
      setConnected(true)
    })

    socketRef.current.on('disconnect', () => {
      console.log('❌ Disconnected from server')
      setConnected(false)
    })

    socketRef.current.on('connect_error', (error) => {
      console.error('❌ Connection error:', error)
      setConnected(false)
    })

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect()
      }
    }
  }, [serverUrl])

  // Authenticate user when user changes or socket connects
  useEffect(() => {
    if (socketRef.current && connected && user) {
      console.log('🔐 Authenticating user:', user.username)
      socketRef.current.emit('authenticate', {
        id: user.id,
        username: user.username
      })
    } else {
      console.log('⏳ Not ready to authenticate:', { socket: !!socketRef.current, connected, user: !!user })
    }
  }, [connected, user])

  // Add connected property to socket for backward compatibility
  if (socketRef.current) {
    socketRef.current.connected = connected
    socketRef.current.connectionStatus = connected
  }

  // Ensure we don't return undefined
  if (!socketRef.current) {
    console.warn('⚠️ Socket not yet initialized')
    return null
  }

  return socketRef.current
}