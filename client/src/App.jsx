import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { SocketProvider } from './context/SocketContext'
import { TransfersProvider } from './context/TransfersContext'
import { ThemeProvider } from './context/ThemeContext'
import { ToastProvider } from './context/ToastContext'
import { BeaconMark } from './components/Logo'
import ThemeReset from './components/ThemeReset'
import Layout from './components/Layout'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Home from './pages/Home'
import Rooms from './pages/Rooms'
import WatchParty from './pages/WatchParty'
import Files from './pages/Files'
import Messages from './pages/Messages'
import Leaderboard from './pages/Leaderboard'
import Profile from './pages/Profile'
import Settings from './pages/Settings'
import { sweepOrphanedTransfers } from './lib/p2p/transfer'
import { AlertTriangle, RefreshCw } from 'lucide-react'

// Reclaim disk from transfers abandoned more than a week ago.
sweepOrphanedTransfers()

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-app">
        <div className="animate-pulse">
          <BeaconMark size={48} />
        </div>
        <p className="mt-5 text-xs font-semibold text-muted">
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
        <div className="min-h-screen flex items-center justify-center p-6 bg-app text-ink">
          <div className="panel max-w-md w-full p-10 text-center">
            <div className="w-14 h-14 rounded-xl bg-accent-soft text-accent flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="h-7 w-7" />
            </div>
            <h1 className="font-serif text-xl font-bold mb-3">Something went wrong</h1>
            <p className="text-sm mb-8 font-mono text-muted">
              {this.state.error?.message || 'An unexpected error broke the page.'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="btn btn-primary w-full"
            >
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

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ThemeReset />
        <ToastProvider>
          <AuthProvider>
            <SocketProvider>
              <TransfersProvider>
                <Router>
                  <Layout>
                    <Routes>
                      <Route path="/login" element={<Login />} />
                      <Route path="/signup" element={<Signup />} />
                      <Route
                        path="/"
                        element={
                          <ProtectedRoute>
                            <Home />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/rooms"
                        element={
                          <ProtectedRoute>
                            <Rooms />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/files"
                        element={
                          <ProtectedRoute>
                            <Files />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/party/:id"
                        element={
                          <ProtectedRoute>
                            <WatchParty />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/settings"
                        element={
                          <ProtectedRoute>
                            <Settings />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/messages"
                        element={
                          <ProtectedRoute>
                            <Messages />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/leaderboard"
                        element={
                          <ProtectedRoute>
                            <Leaderboard />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/u/:id"
                        element={
                          <ProtectedRoute>
                            <Profile />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/profile"
                        element={
                          <ProtectedRoute>
                            <Profile />
                          </ProtectedRoute>
                        }
                      />
                      <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                  </Layout>
                </Router>
              </TransfersProvider>
            </SocketProvider>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}
