import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../hooks/useSocket'
import FileShare from '../components/FileShare'
import { Video, Share2, Settings, MessageSquare, LogOut, Radio, ChevronRight, LayoutGrid, FolderOpen, Tv } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'

export default function Home() {
  const { user, logout } = useAuth()
  const socket = useSocket()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('watch')
  const [partyCode, setPartyCode] = useState('')

  const createParty = () => {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase()
    navigate(`/party/${code}`)
  }

  const joinParty = (e) => {
    e.preventDefault()
    if (partyCode.trim()) {
      navigate(`/party/${partyCode.trim()}`)
    }
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8">
        {/* Navbar */}
        <nav className="flex items-center justify-between h-20 border-b border-slate-200/60 mb-8">
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-3 group">
              <div className="bg-blue-600 text-white p-2 rounded-xl shadow-lg shadow-blue-600/20 group-hover:scale-105 transition-transform">
                <Radio size={20} className="fill-current" />
              </div>
              <span className="text-xl font-bold text-slate-900 tracking-tight">Beacon</span>
            </Link>
            
            <div className="hidden md:flex bg-slate-100/50 p-1 rounded-xl border border-slate-200/60">
              <button 
                onClick={() => setActiveTab('watch')}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 flex items-center gap-2 ${
                  activeTab === 'watch' 
                    ? 'bg-white text-blue-600 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                }`}
              >
                <Tv size={16} />
                Watch Party
              </button>
              <button 
                onClick={() => setActiveTab('files')}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 flex items-center gap-2 ${
                  activeTab === 'files' 
                    ? 'bg-white text-blue-600 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                }`}
              >
                <FolderOpen size={16} />
                File Share
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:block text-right pr-4 border-r border-slate-200">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Operator</div>
              <div className="text-sm font-bold text-slate-900">{user?.username}</div>
            </div>
            <Link to="/settings" className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-all">
              <Settings size={20} />
            </Link>
            <button 
              onClick={logout} 
              className="p-2 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
              title="Sign Out"
            >
              <LogOut size={20} />
            </button>
          </div>
        </nav>

        {/* Main Content */}
        <main className="pb-12">
          <AnimatePresence mode="wait">
            {activeTab === 'watch' && (
              <motion.div
                key="watch"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <div className="mb-12 text-center md:text-left">
                  <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight mb-3">
                    Establish Connection
                  </h1>
                  <p className="text-lg text-slate-500 max-w-2xl">
                    Sync video streams, chat in real-time, and share content with anyone, anywhere.
                  </p>
                </div>

                <div className="grid md:grid-cols-2 gap-8 max-w-4xl">
                  {/* Host Card */}
                  <div className="glass-card p-8 hover:border-blue-200 transition-all duration-300 group relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                      <Video size={120} className="text-blue-500 transform rotate-12 translate-x-8 -translate-y-8" />
                    </div>
                    
                    <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-6 shadow-sm group-hover:scale-110 transition-transform duration-300">
                      <Video size={28} />
                    </div>
                    
                    <h3 className="text-xl font-bold text-slate-900 mb-2">Host New Party</h3>
                    <p className="text-slate-500 mb-8 min-h-[3rem]">
                      Create a private, synchronized viewing space and invite friends via a secure link.
                    </p>
                    
                    <button onClick={createParty} className="btn btn-primary w-full h-12 text-base shadow-blue-500/25">
                      Start New Session
                    </button>
                  </div>

                  {/* Join Card */}
                  <div className="glass-card p-8 hover:border-emerald-200 transition-all duration-300 group relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                      <LayoutGrid size={120} className="text-emerald-500 transform -rotate-12 translate-x-8 -translate-y-8" />
                    </div>

                    <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mb-6 shadow-sm group-hover:scale-110 transition-transform duration-300">
                      <LayoutGrid size={28} />
                    </div>
                    
                    <h3 className="text-xl font-bold text-slate-900 mb-2">Join Stream</h3>
                    <p className="text-slate-500 mb-8 min-h-[3rem]">
                      Enter a unique 6-character room code to connect to an existing broadcast.
                    </p>
                    
                    <form onSubmit={joinParty} className="flex gap-3">
                      <input
                        type="text"
                        placeholder="ENTER CODE"
                        className="input-field uppercase tracking-widest font-mono text-center text-lg h-12"
                        maxLength={6}
                        value={partyCode}
                        onChange={(e) => setPartyCode(e.target.value.toUpperCase())}
                      />
                      <button 
                        type="submit" 
                        disabled={!partyCode.trim()} 
                        className="btn bg-slate-900 text-white hover:bg-slate-800 h-12 px-6 shadow-lg shadow-slate-900/20"
                      >
                        Join
                      </button>
                    </form>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'files' && (
              <motion.div 
                key="files" 
                initial={{ opacity: 0, y: 10 }} 
                animate={{ opacity: 1, y: 0 }} 
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="glass-card p-6"
              >
                 <FileShare socket={socket} />
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  )
}
