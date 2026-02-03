import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Home from './pages/Home'
import WatchParty from './pages/WatchParty'
import Settings from './pages/Settings'
import Messages from './pages/Messages'
import { Loader, Zap, AlertTriangle, RefreshCw } from 'lucide-react'
import { motion } from 'framer-motion'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0F172A] flex flex-col items-center justify-center relative overflow-hidden">
        <div className="orb w-[300px] h-[300px] bg-violet-600/20 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 blur-[100px]" />
        <motion.div 
          animate={{ scale: [1, 1.1, 1], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="relative z-10"
        >
          <Zap className="h-12 w-12 text-violet-400 mb-4 mx-auto" fill="currentColor" />
        </motion.div>
        <p className="text-violet-400 font-mono text-xs tracking-[0.3em] uppercase animate-pulse relative z-10">Initialising Protocol...</p>
      </div>
    )
  }
  
  return user ? children : <Navigate to="/login" />
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0F172A] text-white flex items-center justify-center p-6">
           <div className="glass-card max-w-md w-full p-10 text-center border-red-500/20">
              <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-red-500/20">
                 <AlertTriangle className="h-8 w-8 text-red-400" />
              </div>
              <h1 className="text-2xl font-bold mb-4">Critical System Error</h1>
              <p className="text-slate-400 text-sm mb-8 font-mono">{this.state.error?.message || 'Kernel panic detected.'}</p>
              <button 
                onClick={() => window.location.reload()} 
                className="w-full glass-button !from-red-600 !to-red-500 shadow-red-500/20"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                REBOOT SYSTEM
              </button>
           </div>
        </div>
      )
    }

    return this.props.children
  }
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <Router>
            <div className="min-h-screen">
              <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/" element={
                <ProtectedRoute>
                  <Home />
                </ProtectedRoute>
              } />
              <Route path="/party/:id" element={
                <ProtectedRoute>
                  <WatchParty />
                </ProtectedRoute>
              } />
              <Route path="/settings" element={
                <ProtectedRoute>
                  <Settings />
                </ProtectedRoute>
              } />
              <Route path="/messages" element={
                <ProtectedRoute>
                  <Messages />
                </ProtectedRoute>
              } />
            </Routes>
          </div>
        </Router>
      </AuthProvider>
    </ThemeProvider>
    </ErrorBoundary>
  )
}

export default App
