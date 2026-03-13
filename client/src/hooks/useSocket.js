import { useEffect, useRef, useState } from 'react'
import { SignalingClient } from '../lib/SignalingClient'
import { useAuth } from '../context/AuthContext'

export function useSocket(serverUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.hostname}:8080/ws`) {
  const socketRef = useRef()
  const [connected, setConnected] = useState(false)
  const { user } = useAuth()

  useEffect(() => {
    console.log('🔌 Initializing socket connection to:', serverUrl)
    const token = localStorage.getItem('token') || 'demo-token'
    
    socketRef.current = new SignalingClient(serverUrl)
    
    socketRef.current.on('connect', () => {
      console.log('✅ Socket connected')
      setConnected(true)
    })

    socketRef.current.on('disconnect', () => {
      console.log('❌ Socket disconnected')
      setConnected(false)
    })

    socketRef.current.on('error', (error) => {
      console.error('❌ Socket error:', error)
      setConnected(false)
    })

    socketRef.current.connect(token)

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect()
      }
    }
  }, [serverUrl, user])

  // Backward compatibility properties
  if (socketRef.current) {
    socketRef.current.connected = connected
    socketRef.current.connectionStatus = connected
  }

  return socketRef.current
}
