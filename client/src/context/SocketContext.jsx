import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { io } from 'socket.io-client'
import { useAuth } from './AuthContext'

// One socket connection for the whole app. Components consume it via
// useSocket()/useSocketConnected(); it reconnects automatically and survives
// route changes.

const SocketContext = createContext({ socket: null, connected: false })

export function SocketProvider({ children }) {
  const { user } = useAuth()
  const [socket, setSocket] = useState(null)
  const [connected, setConnected] = useState(false)
  const userId = user?.id

  useEffect(() => {
    if (!userId) {
      setSocket(null)
      setConnected(false)
      return
    }
    const token = localStorage.getItem('token')
    if (!token) return

    // Same-origin connection: in dev the Vite proxy forwards /socket.io to the
    // backend, which also makes access through tunnels work for remote users.
    const s = io({ auth: { token } })

    s.on('connect', () => setConnected(true))
    s.on('disconnect', () => setConnected(false))
    s.on('connect_error', (err) => {
      console.error('Socket connection error:', err.message)
      setConnected(false)
    })

    setSocket(s)
    return () => {
      s.disconnect()
      setSocket(null)
      setConnected(false)
    }
  }, [userId])

  const value = useMemo(() => ({ socket, connected }), [socket, connected])
  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
}

export function useSocketContext() {
  return useContext(SocketContext)
}
