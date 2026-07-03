import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { SocketProvider } from './context/SocketContext'
import { TransfersProvider } from './context/TransfersContext'
import { ThemeProvider } from './context/ThemeContext'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Home from './pages/Home'
import Files from './pages/Files'
import WatchParty from './pages/WatchParty'
import Settings from './pages/Settings'
import Messages from './pages/Messages'
import Profile from './pages/Profile'
import Leaderboard from './pages/Leaderboard'
import Layout from './components/Layout'
import { sweepOrphanedTransfers } from './lib/p2p/transfer'
import { Gem, AlertTriangle, RefreshCw } from 'lucide-react'

// Reclaim disk from transfers abandoned more than a week ago.
sweepOrphanedTransfers()

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
        <div className="beacon-mark w-12 h-12 rounded-xl grid place-items-center animate-beacon">
          <Gem size={22} className="text-white" />
        </div>
        <p className="mt-5 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
          Lighting the beacon…
        </p>
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
        <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
           <div className="glass-card max-w-md w-full p-10 text-center">
              <div className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-6" style={{ background: 'rgb(var(--accent) / 0.12)' }}>
                 <AlertTriangle className="h-7 w-7" style={{ color: 'rgb(var(--accent))' }} />
              </div>
              <h1 className="text-xl font-bold mb-3">Something went wrong</h1>
              <p className="text-sm mb-8 font-mono" style={{ color: 'var(--text-secondary)' }}>{this.state.error?.message || 'An unexpected error broke the page.'}</p>
              <button onClick={() => window.location.reload()} className="btn btn-primary w-full">
                <RefreshCw className="h-4 w-4 mr-2" />
                Reload
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
          <SocketProvider>
          <TransfersProvider>
          <Router>
            <Layout>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
                <Route path="/" element={
                  <ProtectedRoute>
                    <Home />
                  </ProtectedRoute>
                } />
                <Route path="/files" element={
                  <ProtectedRoute>
                    <Files />
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
                <Route path="/leaderboard" element={
                  <ProtectedRoute>
                    <Leaderboard />
                  </ProtectedRoute>
                } />
                <Route path="/u/:id" element={
                  <ProtectedRoute>
                    <Profile />
                  </ProtectedRoute>
                } />
                <Route path="/profile" element={
                  <ProtectedRoute>
                    <Profile />
                  </ProtectedRoute>
                } />
              </Routes>
            </Layout>
        </Router>
          </TransfersProvider>
          </SocketProvider>
      </AuthProvider>
    </ThemeProvider>
    </ErrorBoundary>
  )
}

export default App
