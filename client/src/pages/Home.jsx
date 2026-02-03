import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../hooks/useSocket'
import FileShare from '../components/FileShare'
import { Plus, Video, Share2, Settings, MessageSquare, LogOut, Layout, Zap, Users } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'

export default function Home() {
  const { user, logout } = useAuth()
  const socket = useSocket()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('watch')
  const [partyCode, setPartyCode] = useState('')
  const [customCode, setCustomCode] = useState('')
  const [showCustomCode, setShowCustomCode] = useState(false)

  const createParty = () => {
    const code = customCode.trim() || Math.random().toString(36).substring(2, 8).toUpperCase()
    navigate(`/party/${code}`)
  }

  const joinParty = (e) => {
    if (e) e.preventDefault()
    if (partyCode.trim()) {
      navigate(`/party/${partyCode.trim()}`)
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden selection:bg-violet-500/30">
      {/* Ambient Background Elements */}
      <div className="orb w-[500px] h-[500px] bg-violet-600 top-[-200px] left-[-100px]" />
      <div className="orb w-[400px] h-[400px] bg-cyan-500 bottom-[-100px] right-[-100px]" />
      <div className="orb w-[300px] h-[300px] bg-purple-600 top-[40%] right-[10%] opacity-20" />

      {/* Navigation */}
      <nav className="sticky top-0 z-50 px-2 sm:px-6 py-2 sm:py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center glass-card px-3 sm:px-6 py-2 sm:py-3 border-white/5">
          <div className="flex items-center gap-4 sm:gap-12">
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-2 cursor-pointer"
              onClick={() => navigate('/')}
            >
              <div className="w-7 h-7 sm:w-8 sm:h-8 bg-gradient-to-br from-violet-500 to-cyan-400 rounded-lg flex items-center justify-center shadow-lg shadow-violet-500/20">
                <Zap className="h-4 w-4 sm:h-5 sm:w-5 text-white" fill="currentColor" />
              </div>
              <h1 className="text-lg sm:text-xl font-bold tracking-tighter text-gradient hidden xs:block">BEACON</h1>
            </motion.div>

            <div className="hidden lg:flex items-center gap-1">
              <button
                onClick={() => setActiveTab('watch')}
                className={`nav-item ${activeTab === 'watch' ? 'nav-item-active' : ''}`}
              >
                <Video className="h-4 w-4" />
                <span>Watch Party</span>
              </button>
              <button
                onClick={() => setActiveTab('files')}
                className={`nav-item ${activeTab === 'files' ? 'nav-item-active' : ''}`}
              >
                <Share2 className="h-4 w-4" />
                <span>Transfers</span>
              </button>
              <Link to="/messages" className="nav-item">
                <MessageSquare className="h-4 w-4" />
                <span>Network</span>
              </Link>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <div className="hidden sm:flex flex-col items-end mr-2">
              <span className="text-xs text-slate-500 font-medium uppercase tracking-widest">Active Operator</span>
              <span className="text-sm font-semibold text-white">{user?.username}</span>
            </div>
            <Link to="/settings" className="p-2 sm:p-2.5 glass-card rounded-xl hover:bg-white/10 transition-colors">
              <Settings className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-400" />
            </Link>
            <button
              onClick={logout}
              className="p-2 sm:p-2.5 glass-card rounded-xl border-red-500/20 hover:bg-red-500/10 text-red-400 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-12 relative z-10">
        <header className="text-center mb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="inline-block px-4 py-1 rounded-full bg-violet-500/10 text-violet-400 text-xs font-bold tracking-widest uppercase mb-4 border border-violet-500/20">
              Protocol V2.0 Active
            </span>
            <h2 className="text-5xl md:text-6xl font-bold mb-6 tracking-tight leading-tight">
              Synchronize your <span className="text-gradient">Experience.</span>
            </h2>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto font-medium">
              Enterprise-grade P2P file transfers and perfect-sync watch parties.
              No servers, no limits, just pure connection.
            </p>
          </motion.div>
        </header>

        <AnimatePresence mode="wait">
          {activeTab === 'watch' && (
            <motion.div
              key="watch"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto"
            >
              <div className="glass-card p-10 flex flex-col items-center group">
                <div className="w-16 h-16 bg-violet-500/10 rounded-2xl flex items-center justify-center mb-6 border border-violet-500/20 group-hover:scale-110 transition-transform duration-500">
                  <Layout className="h-8 w-8 text-violet-400" />
                </div>
                <h3 className="text-2xl font-bold mb-2">Initialize Room</h3>
                <p className="text-slate-400 text-center mb-8">
                  Host a new encrypted session and command your squad.
                </p>
                <div className="w-full space-y-4">
                  <AnimatePresence>
                    {showCustomCode && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                      >
                        <input
                          type="text"
                          placeholder="ASSIGN CUSTOM CODE"
                          className="glass-input text-center tracking-[0.2em] font-mono"
                          value={customCode}
                          onChange={(e) => setCustomCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                          maxLength={8}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <button onClick={createParty} className="w-full glass-button group">
                    <span>CREATE PARTY</span>
                    <Plus className="h-4 w-4 group-hover:rotate-90 transition-transform" />
                  </button>
                  <button
                    onClick={() => setShowCustomCode(!showCustomCode)}
                    className="w-full text-xs font-bold tracking-widest text-slate-500 hover:text-slate-300 transition-colors uppercase"
                  >
                    {showCustomCode ? '[-] Default Random Code' : '[+] Override with Custom Code'}
                  </button>
                </div>
              </div>

              <div className="glass-card p-10 flex flex-col items-center group">
                <div className="w-16 h-16 bg-cyan-500/10 rounded-2xl flex items-center justify-center mb-6 border border-cyan-500/20 group-hover:scale-110 transition-transform duration-500">
                  <Users className="h-8 w-8 text-cyan-400" />
                </div>
                <h3 className="text-2xl font-bold mb-2">Intercept Session</h3>
                <p className="text-slate-400 text-center mb-8">
                  Enter existing coordinates to join the watch party.
                </p>
                <form onSubmit={joinParty} className="w-full space-y-4">
                  <input
                    type="text"
                    placeholder="ENTER 8-DIGIT CODE"
                    className="glass-input text-center tracking-[0.2em] font-mono"
                    value={partyCode}
                    onChange={(e) => setPartyCode(e.target.value.toUpperCase())}
                  />
                  <button
                    type="submit"
                    disabled={!partyCode.trim()}
                    className="w-full glass-button !from-cyan-500 !to-cyan-400 shadow-cyan-500/20 disabled:opacity-30"
                  >
                    <span>JOIN EXPEDITION</span>
                  </button>
                </form>
              </div>
            </motion.div>
          )}

          {activeTab === 'files' && (
            <motion.div
              key="files"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-4xl mx-auto"
            >
              <div className="glass-card p-2 overflow-hidden">
                 <FileShare socket={socket} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer info */}
        <footer className="mt-20 flex flex-wrap justify-center gap-12 border-t border-white/5 pt-12">
            <div className="flex flex-col items-center gap-1">
                <span className="text-2xl font-bold text-white">100%</span>
                <span className="text-xs uppercase tracking-widest text-slate-500 font-bold">P2P Encryption</span>
            </div>
            <div className="flex flex-col items-center gap-1">
                <span className="text-2xl font-bold text-white">0.0ms</span>
                <span className="text-xs uppercase tracking-widest text-slate-500 font-bold">Latency Sync</span>
            </div>
            <div className="flex flex-col items-center gap-1">
                <span className="text-2xl font-bold text-white">∞</span>
                <span className="text-xs uppercase tracking-widest text-slate-500 font-bold">Bandwidth Cap</span>
            </div>
        </footer>
      </main>
    </div>
  )
}
