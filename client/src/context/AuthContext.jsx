import { createContext, useContext, useState, useEffect } from 'react'
import axios from 'axios'

const AuthContext = createContext()

// Same-origin in dev (Vite proxies /api); production serves client and API
// from the same origin.
axios.defaults.baseURL = window.location.origin
axios.defaults.withCredentials = true

function applyToken(token) {
  if (token) {
    localStorage.setItem('token', token)
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
  } else {
    localStorage.removeItem('token')
    delete axios.defaults.headers.common['Authorization']
  }
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // Guest-first bootstrap: with no (or an invalid) token, silently create a
  // guest identity so anyone can join or host from just a link.
  useEffect(() => {
    const bootstrap = async () => {
      const token = localStorage.getItem('token')
      if (token) {
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
        try {
          const response = await axios.get('/api/auth/me')
          setUser(response.data.user)
          setLoading(false)
          return
        } catch {
          applyToken(null)
        }
      }
      try {
        const response = await axios.post('/api/auth/guest', {})
        applyToken(response.data.token)
        setUser(response.data.user)
      } catch (error) {
        console.error('Failed to create guest session:', error)
      } finally {
        setLoading(false)
      }
    }
    bootstrap()
  }, [])

  const login = async (email, password) => {
    try {
      const response = await axios.post('/api/auth/login', { email, password })
      applyToken(response.data.token)
      setUser(response.data.user)
      return { success: true }
    } catch (error) {
      return { success: false, error: error.response?.data?.message || 'Login failed' }
    }
  }

  // If the current identity is a guest, the server upgrades it in place
  // (same id, party/DM history kept).
  const signup = async (username, email, password) => {
    try {
      const response = await axios.post('/api/auth/signup', { username, email, password })
      applyToken(response.data.token)
      setUser(response.data.user)
      return { success: true }
    } catch (error) {
      return { success: false, error: error.response?.data?.message || 'Signup failed' }
    }
  }

  const rename = async (username) => {
    try {
      const response = await axios.post('/api/auth/rename', { username })
      applyToken(response.data.token)
      setUser(response.data.user)
      return { success: true }
    } catch (error) {
      return { success: false, error: error.response?.data?.message || 'Rename failed' }
    }
  }

  // Logging out of an account drops back to a fresh guest identity.
  const logout = async () => {
    try {
      await axios.post('/api/auth/logout')
    } catch {
      // best effort
    }
    applyToken(null)
    try {
      const response = await axios.post('/api/auth/guest', {})
      applyToken(response.data.token)
      setUser(response.data.user)
    } catch {
      setUser(null)
    }
  }

  const value = {
    user,
    isGuest: !!user?.isGuest,
    login,
    signup,
    rename,
    logout,
    loading,
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
