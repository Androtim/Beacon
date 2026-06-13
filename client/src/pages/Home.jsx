import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../hooks/useSocket'
import FileShare from '../components/FileShare'
import { Video, Share2, Settings, Tv, FolderOpen, Shield, HelpCircle, Activity } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'

export default function Home() {
  const { user } = useAuth()
  const socket = useSocket()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('watch')
  const [partyCode, setPartyCode] = useState('')

  const createParty = () => {
    // Generate a 6-character party room code
    const code = Math.random().toString(36).substring(2, 8).toUpperCase()
    navigate(`/party/${code}`)
  }

  const joinParty = (e) => {
    e.preventDefault()
    if (partyCode.trim()) {
      navigate(`/party/${partyCode.trim().toUpperCase()}`)
    }
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-16">
        
        {/* Connection status header / User welcome */}
        <header className="mb-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200/50 dark:border-slate-800 pb-8">
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
              <Shield size={24} className="text-blue-500 dark:text-indigo-400" />
              Beacon Control Panel
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-450 mt-1 uppercase font-semibold">
              Authorized User: <span className="text-slate-700 dark:text-slate-350">{user?.username}</span> // Node ID: <span className="text-slate-700 dark:text-slate-350 font-mono">BCN-{socket?.id?.slice(0, 5) || 'DISCONNECTED'}</span>
            </p>
          </div>

          <div className="flex bg-slate-100/60 dark:bg-slate-850 p-1 rounded-xl border border-slate-200/60 dark:border-slate-800/80">
            <button 
              onClick={() => setActiveTab('watch')}
              className={`px-4.5 py-2 rounded-lg text-xs font-bold transition-all duration-200 flex items-center gap-2 uppercase tracking-wider ${
                activeTab === 'watch' 
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm' 
                  : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <Tv size={14} />
              Watch Room
            </button>
            <button 
              onClick={() => setActiveTab('files')}
              className={`px-4.5 py-2 rounded-lg text-xs font-bold transition-all duration-200 flex items-center gap-2 uppercase tracking-wider ${
                activeTab === 'files' 
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm' 
                  : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <FolderOpen size={14} />
              P2P File Share
            </button>
          </div>
        </header>

        {/* Main Content Area */}
        <main>
          <AnimatePresence mode="wait">
            {activeTab === 'watch' && (
              <motion.div
                key="watch"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-8"
              >
                <div className="text-left max-w-xl">
                  <h2 className="text-lg font-bold text-slate-800 dark:text-slate-250"> Watch Party Terminal </h2>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 leading-relaxed">
                    Instantly spin up a private watch party room. Paste direct URLs, HLS streams, or broadcast local video files peer-to-peer. Playback controls seek and synchronize instantly for all operators.
                  </p>
                </div>

                <div className="grid md:grid-cols-2 gap-8 max-w-4xl">
                  {/* Host Card */}
                  <div className="glass-card p-8 hover:border-blue-500/30 dark:hover:border-indigo-500/30 transition-all duration-300 group relative overflow-hidden flex flex-col justify-between border border-slate-200/50 dark:border-slate-800">
                    <div className="absolute top-0 right-0 p-3 opacity-[0.02] dark:opacity-[0.03] group-hover:opacity-[0.05] transition-opacity">
                      <Video size={160} className="text-blue-500 transform rotate-12 translate-x-12 -translate-y-12" />
                    </div>
                    
                    <div>
                      <div className="w-12 h-12 bg-blue-500/10 text-blue-600 dark:text-indigo-400 rounded-xl flex items-center justify-center mb-6 shadow-sm group-hover:scale-105 transition-transform duration-300">
                        <Video size={24} />
                      </div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2 uppercase tracking-wide">Host Watch Room</h3>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mb-8 leading-relaxed">
                        Generate a secure watch party room coordinates. You retain master playback privileges unless you disconnect, in which case leadership is auto-delegated.
                      </p>
                    </div>
                    
                    <button 
                      onClick={createParty} 
                      className="btn btn-primary w-full h-12 text-xs uppercase tracking-wider"
                    >
                      Start Watch Session
                    </button>
                  </div>

                  {/* Join Card */}
                  <div className="glass-card p-8 hover:border-emerald-500/30 dark:hover:border-indigo-500/30 transition-all duration-300 group relative overflow-hidden flex flex-col justify-between border border-slate-200/50 dark:border-slate-800">
                    <div className="absolute top-0 right-0 p-3 opacity-[0.02] dark:opacity-[0.03] group-hover:opacity-[0.05] transition-opacity">
                      <Activity size={160} className="text-emerald-500 transform -rotate-12 translate-x-12 -translate-y-12" />
                    </div>

                    <div>
                      <div className="w-12 h-12 bg-emerald-500/10 text-emerald-600 dark:text-emerald-450 rounded-xl flex items-center justify-center mb-6 shadow-sm group-hover:scale-105 transition-transform duration-300">
                        <Activity size={24} />
                      </div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2 uppercase tracking-wide">Join Watching Session</h3>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mb-8 leading-relaxed">
                        Input an active 6-character room coordinate to join a stream. Latency compensation is applied dynamically to guarantee you play in sync.
                      </p>
                    </div>
                    
                    <form onSubmit={joinParty} className="flex gap-3">
                      <input
                        type="text"
                        placeholder="ROOM CODE"
                        className="input-field uppercase tracking-widest font-mono text-center text-sm h-12 flex-1"
                        maxLength={6}
                        value={partyCode}
                        onChange={(e) => setPartyCode(e.target.value.toUpperCase())}
                      />
                      <button 
                        type="submit" 
                        disabled={partyCode.trim().length !== 6} 
                        className="btn bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 h-12 px-6 tracking-wider text-xs uppercase"
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
