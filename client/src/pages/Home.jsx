import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../hooks/useSocket'
import FileShare from '../components/FileShare'
import { Plus, Video, Share2, Settings, MessageSquare, LogOut, Layout, Zap, Users, Shield, Radio, ChevronRight } from 'lucide-react'
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
    <div className="relative min-h-screen bg-[#0F172A] text-slate-200 selection:bg-violet-500/30 overflow-x-hidden">
      {/* Background elements */}
      <div className="orb w-[600px] h-[600px] bg-violet-600/10 top-[-200px] left-[-200px]" />
      <div className="orb w-[500px] h-[500px] bg-cyan-500/10 bottom-[-100px] right-[-100px]" />

      {/* Desktop Header */}
      <nav className="sticky top-0 z-50 p-4 sm:p-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex justify-between items-center glass-card px-6 py-3 border-white/5 shadow-2xl">
          <div className="flex items-center gap-12">
            <motion.div 
              whileHover={{ scale: 1.02 }}
              onClick={() => setActiveTab('watch')}
              className="flex items-center gap-2.5 cursor-pointer"
            >
              <div className="w-9 h-9 bg-gradient-to-br from-violet-500 to-cyan-400 rounded-xl flex items-center justify-center shadow-lg shadow-violet-500/20">
                <Zap className="h-5 w-5 text-white" fill="currentColor" />
              </div>
              <h1 className="text-xl font-bold tracking-tighter text-gradient uppercase hidden xs:block">Beacon</h1>
            </motion.div>

            <div className="hidden lg:flex items-center gap-1">
              <NavButton active={activeTab === 'watch'} onClick={() => setActiveTab('watch')} icon={<Video size={16} />} label="Stream Sync" />
              <NavButton active={activeTab === 'files'} onClick={() => setActiveTab('files')} icon={<Share2 size={16} />} label="Payload" />
              <Link to="/messages" className="nav-item">
                <MessageSquare size={16} />
                <span className="uppercase text-[10px] font-bold tracking-widest">Network</span>
              </Link>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex flex-col items-end mr-2">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Operator Active</span>
              <span className="text-sm font-bold text-white tracking-tight">{user?.username}</span>
            </div>
            <Link to="/settings" className="w-10 h-10 glass-card rounded-xl flex items-center justify-center hover:bg-white/10 transition-all border-white/5">
              <Settings className="h-4 w-4 text-slate-400" />
            </Link>
            <button
              onClick={logout}
              className="w-10 h-10 glass-card rounded-xl flex items-center justify-center border-red-500/20 hover:bg-red-500/10 text-red-400 transition-all"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8 sm:py-16 pb-32 lg:pb-16 relative z-10">
        <AnimatePresence mode="wait">
          {activeTab === 'watch' && (
            <motion.div
              key="watch"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col gap-16"
            >
              <header className="text-center">
                 <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.5 }}>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-[10px] font-bold tracking-widest uppercase mb-6">
                       <Radio size={12} className="animate-pulse" /> Protocol v2.4 Engaged
                    </div>
                    <h2 className="text-4xl sm:text-6xl font-black mb-6 tracking-tighter leading-[0.9] text-white">
                      SYNCHRONIZE<br/><span className="text-gradient">REALITY.</span>
                    </h2>
                    <p className="text-slate-500 max-w-xl mx-auto text-sm sm:text-base font-medium leading-relaxed">
                      Encrypted P2P watch parties and direct payload delivery.<br className="hidden sm:block"/> No servers. No compromise. Pure connection.
                    </p>
                 </motion.div>
              </header>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto w-full">
                <div className="glass-card p-10 flex flex-col items-center group relative overflow-hidden">
                  <div className="absolute -top-10 -right-10 w-32 h-32 bg-violet-500/5 rounded-full blur-3xl group-hover:bg-violet-500/10 transition-colors" />
                  <div className="w-16 h-16 bg-violet-500/10 rounded-2xl flex items-center justify-center mb-8 border border-violet-500/20 group-hover:scale-110 transition-all duration-500 shadow-lg shadow-violet-500/10">
                    <Layout className="h-7 w-7 text-violet-400" />
                  </div>
                  <h3 className="text-2xl font-bold mb-3 tracking-tight">INITIALIZE</h3>
                  <p className="text-slate-500 text-center mb-10 text-sm leading-relaxed">
                    Host an encrypted subspace and invite your squad using secure coordinates.
                  </p>
                  <div className="w-full space-y-4">
                    <AnimatePresence>
                      {showCustomCode && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                          <input
                            type="text"
                            placeholder="ASSIGN COORDINATES"
                            className="glass-input text-center tracking-[0.4em] font-mono text-sm"
                            value={customCode}
                            onChange={(e) => setCustomCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                            maxLength={8}
                          />
                        </motion.div>
                      )}
                    </AnimatePresence>
                    <button onClick={createParty} className="w-full glass-button group !py-4 shadow-xl">
                      <span>CREATE SESSION</span>
                      <Plus className="h-4 w-4 group-hover:rotate-90 transition-transform" />
                    </button>
                    <button
                      onClick={() => setShowCustomCode(!showCustomCode)}
                      className="w-full text-[10px] font-bold tracking-widest text-slate-500 hover:text-slate-300 transition-colors uppercase"
                    >
                      {showCustomCode ? '[-] USE RANDOM SEED' : '[+] OVERRIDE WITH CUSTOM CODE'}
                    </button>
                  </div>
                </div>

                <div className="glass-card p-10 flex flex-col items-center group relative overflow-hidden">
                  <div className="absolute -top-10 -right-10 w-32 h-32 bg-cyan-500/5 rounded-full blur-3xl group-hover:bg-cyan-500/10 transition-colors" />
                  <div className="w-16 h-16 bg-cyan-500/10 rounded-2xl flex items-center justify-center mb-8 border border-cyan-500/20 group-hover:scale-110 transition-all duration-500 shadow-lg shadow-cyan-500/10">
                    <Users className="h-7 w-7 text-cyan-400" />
                  </div>
                  <h3 className="text-2xl font-bold mb-3 tracking-tight">INTERCEPT</h3>
                  <p className="text-slate-500 text-center mb-10 text-sm leading-relaxed">
                    Enter session coordinates to join an active point-to-point stream.
                  </p>
                  <form onSubmit={joinParty} className="w-full space-y-4">
                    <input
                      type="text"
                      placeholder="ENTER 8-DIGIT CODE"
                      className="glass-input text-center tracking-[0.4em] font-mono text-sm"
                      value={partyCode}
                      onChange={(e) => setPartyCode(e.target.value.toUpperCase())}
                    />
                    <button
                      type="submit"
                      disabled={!partyCode.trim()}
                      className="w-full glass-button !from-cyan-500 !to-cyan-400 shadow-xl disabled:opacity-30 !py-4"
                    >
                      <span>ESTABLISH LINK</span>
                      <ChevronRight size={16} />
                    </button>
                  </form>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'files' && (
            <motion.div key="files" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} className="max-w-5xl mx-auto w-full">
               <div className="glass-card overflow-hidden">
                  <FileShare socket={socket} />
               </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Mobile Bottom Nav */}
      <div className="fixed bottom-0 left-0 right-0 z-50 lg:hidden p-4 pointer-events-none">
         <div className="max-w-md mx-auto glass-card flex items-center justify-around p-2 pointer-events-auto border-white/10 shadow-2xl">
            <MobileNavButton active={activeTab === 'watch'} onClick={() => setActiveTab('watch')} icon={<Video size={20} />} label="Stream" />
            <MobileNavButton active={activeTab === 'files'} onClick={() => setActiveTab('files')} icon={<Share2 size={20} />} label="Payload" />
            <Link to="/messages" className="flex flex-col items-center justify-center gap-1 p-3 rounded-2xl transition-all text-slate-500 hover:text-white">
               <MessageSquare size={20} />
               <span className="text-[9px] font-bold uppercase tracking-widest">Network</span>
            </Link>
         </div>
      </div>
    </div>
  )
}

function NavButton({ active, onClick, icon, label }) {
  return (
    <button
      onClick={onClick}
      className={`nav-item ${active ? 'nav-item-active' : ''}`}
    >
      {icon}
      <span>{label.toUpperCase()}</span>
    </button>
  )
}

function MobileNavButton({ active, onClick, icon, label }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-1 p-3 rounded-2xl transition-all ${active ? 'bg-violet-500/10 text-violet-400' : 'text-slate-500 hover:text-white'}`}
    >
      {icon}
      <span className="text-[9px] font-bold uppercase tracking-widest">{label}</span>
    </button>
  )
}
