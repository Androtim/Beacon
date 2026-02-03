import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useWatchParty } from '../hooks/useWatchParty'
import VideoPlayer from '../components/VideoPlayer'
import ChatBox from '../components/ChatBox'
import VideoFileSharing from '../components/VideoFileSharing'
import { Users, Video, Wifi, WifiOff, Crown, Upload, Link as LinkIcon, Copy, Check, LogOut, MessageSquare, MonitorPlay, Zap } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export default function WatchParty() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const playerRef = useRef()
  const [videoUrl, setVideoUrl] = useState('')
  const [showUrlInput, setShowUrlInput] = useState(false)
  const [videoSource, setVideoSource] = useState('url')
  const [copied, setCopied] = useState(false)
  const [localVideoUrl, setLocalVideoUrl] = useState(null)
  const [localVideoInfo, setLocalVideoInfo] = useState(null)
  
  const {
    participants,
    isHost,
    messages,
    videoState,
    fileShare,
    setVideoUrl: setSharedVideoUrl,
    playVideo,
    pauseVideo,
    seekVideo,
    sendMessage,
    connected,
    socket
  } = useWatchParty(id, user)
  
  const [syncingFromRemote, setSyncingFromRemote] = useState(false)

  const handlePlay = (currentTime) => {
    if (!syncingFromRemote) playVideo(currentTime)
  }

  const handlePause = (currentTime) => {
    if (!syncingFromRemote) pauseVideo(currentTime)
  }

  const handleSeeked = (currentTime) => {
    if (!syncingFromRemote) seekVideo(currentTime)
  }

  useEffect(() => {
    if (!playerRef.current) return
    const player = playerRef.current
    
    const getCurrentTime = () => {
      if (typeof player.currentTime === 'number') return player.currentTime
      if (player.currentTime && typeof player.currentTime === 'function') return player.currentTime()
      if (player.getCurrentTime) return player.getCurrentTime()
      return 0
    }
    
    const setCurrentTime = (time) => {
      if (typeof player.currentTime === 'number') player.currentTime = time
      else if (player.currentTime && typeof player.currentTime === 'function') player.currentTime(time)
      else if (player.seekTo) player.seekTo(time)
    }
    
    const isPlayerPaused = () => {
      if (typeof player.paused === 'boolean') return player.paused
      if (player.paused && typeof player.paused === 'function') return player.paused()
      if (player.isPaused) return player.isPaused()
      return false
    }
    
    const playVideo = () => {
      if (player.play) {
        const p = player.play()
        if (p && p.catch) p.catch(() => {})
      }
    }
    
    const pauseVideo = () => player.pause?.()

    const currentTime = getCurrentTime()
    const timeDiff = Math.abs(currentTime - videoState.currentTime)

    if (timeDiff > 1.5) {
      setSyncingFromRemote(true)
      setCurrentTime(videoState.currentTime)
      setTimeout(() => setSyncingFromRemote(false), 200)
    }

    if (videoState.isPlaying && isPlayerPaused()) {
      setSyncingFromRemote(true)
      playVideo()
      setTimeout(() => setSyncingFromRemote(false), 200)
    } else if (!videoState.isPlaying && !isPlayerPaused()) {
      setSyncingFromRemote(true)
      pauseVideo()
      setTimeout(() => setSyncingFromRemote(false), 200)
    }
  }, [videoState])

  const handleVideoUrlSubmit = (e) => {
    e.preventDefault()
    if (videoUrl.trim()) {
      setSharedVideoUrl(videoUrl.trim())
      setShowUrlInput(false)
      setVideoUrl('')
    }
  }

  const handleVideoFileReady = (url, fileInfo) => {
    setLocalVideoUrl(url)
    setLocalVideoInfo(fileInfo)
    setVideoSource('file')
  }

  const copyPartyCode = () => {
    navigator.clipboard.writeText(id)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!user) return null

  return (
    <div className="min-h-screen relative overflow-x-hidden selection:bg-violet-500/30">
      {/* Background Orbs */}
      <div className="orb w-[600px] h-[600px] bg-violet-600/10 top-[-200px] left-[-200px]" />
      <div className="orb w-[500px] h-[500px] bg-cyan-500/10 bottom-[-100px] right-[-100px]" />

      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4 sm:py-6 relative z-10 flex flex-col min-h-screen min-h-[100dvh]">
        {/* Header */}
        <header className="glass-card px-3 sm:px-6 py-3 sm:py-4 border-white/5 flex flex-wrap items-center justify-between gap-4 mb-6 shrink-0">
          <div className="flex items-center gap-3 sm:gap-6">
            <motion.button 
              whileHover={{ scale: 1.05 }}
              onClick={() => navigate('/')}
              className="w-9 h-9 sm:w-10 sm:h-10 bg-white/5 rounded-xl flex items-center justify-center hover:bg-white/10 transition-colors border border-white/5"
            >
              <LogOut className="h-4 w-4 sm:h-5 sm:w-5 text-slate-400 rotate-180" />
            </motion.button>
            <div className="h-6 sm:h-8 w-px bg-white/10 hidden sm:block" />
            <div>
              <div className="flex items-center gap-2 sm:gap-3">
                <h1 className="text-base sm:text-xl font-bold text-white tracking-tight">Session: <span className="font-mono text-violet-400">{id}</span></h1>
                <button onClick={copyPartyCode} className="p-1.5 hover:bg-white/5 rounded-lg transition-colors group">
                  {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} className="text-slate-500 group-hover:text-white" />}
                </button>
              </div>
              <div className="flex items-center gap-3 mt-0.5">
                <div className="flex items-center gap-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'} animate-pulse`} />
                  <span className="text-[8px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-widest">{connected ? 'Relay Active' : 'Relay Offline'}</span>
                </div>
                {isHost && (
                  <div className="flex items-center gap-1.5">
                    <Crown size={10} className="text-yellow-500" />
                    <span className="text-[8px] sm:text-[10px] font-bold text-yellow-500/70 uppercase tracking-widest hidden xs:inline">Host Privileges</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 ml-auto sm:ml-0">
             <div className="hidden md:flex -space-x-2 mr-2">
                {participants.slice(0, 5).map((p, i) => (
                   <div key={p.id} className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-violet-500 border-2 border-[#0F172A] flex items-center justify-center text-[9px] font-bold text-white uppercase" title={p.username}>
                      {p.username[0]}
                   </div>
                ))}
                {participants.length > 5 && (
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-700 border-2 border-[#0F172A] flex items-center justify-center text-[9px] font-bold text-white">
                    +{participants.length - 5}
                  </div>
                )}
             </div>
             <button onClick={() => navigate('/')} className="glass-button !py-1.5 !px-3 sm:!py-2 sm:!px-4 !rounded-xl !from-red-600 !to-red-500 shadow-red-500/20 text-[10px]">
               LEAVE
             </button>
          </div>
        </header>

        <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0 overflow-visible lg:overflow-hidden">
          {/* Main Stage */}
          <div className="flex-1 flex flex-col gap-6 min-h-0">
            <div className="aspect-video lg:flex-1 bg-black/40 rounded-3xl border border-white/5 overflow-hidden relative group">
              <AnimatePresence mode="wait">
                {(localVideoUrl || videoState.url) ? (
                  <motion.div 
                    key={localVideoUrl || videoState.url}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="h-full w-full"
                  >
                    <VideoPlayer
                      src={localVideoUrl || videoState.url}
                      playerRef={playerRef}
                      onPlay={handlePlay}
                      onPause={handlePause}
                      onSeeked={handleSeeked}
                      fileType={localVideoInfo?.type}
                    />
                  </motion.div>
                ) : (
                  <div className="h-full w-full flex flex-col items-center justify-center p-8 text-center">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white/5 rounded-3xl flex items-center justify-center mb-6 border border-white/10 group-hover:scale-110 transition-transform duration-700">
                      <MonitorPlay className="h-8 w-8 sm:h-10 sm:w-10 text-slate-600" />
                    </div>
                    <p className="text-slate-500 font-medium text-base sm:text-lg">
                      {isHost 
                        ? "Configure source coordinates to begin" 
                        : "Waiting for host to initialize stream..."
                      }
                    </p>
                  </div>
                )}
              </AnimatePresence>
            </div>

            {/* Host Controls */}
            {isHost && (
              <div className="glass-card p-4 shrink-0 border-violet-500/10">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                  <div className="flex bg-white/5 p-1 rounded-xl border border-white/5">
                    <button
                      onClick={() => setVideoSource('url')}
                      className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-[10px] font-bold tracking-widest uppercase transition-all flex items-center justify-center gap-2 ${videoSource === 'url' ? 'bg-violet-500 text-white shadow-lg shadow-violet-500/20' : 'text-slate-500 hover:text-white'}`}
                    >
                      <LinkIcon size={14} /> URL
                    </button>
                    <button
                      onClick={() => setVideoSource('file')}
                      className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-[10px] font-bold tracking-widest uppercase transition-all flex items-center justify-center gap-2 ${videoSource === 'file' ? 'bg-violet-500 text-white shadow-lg shadow-violet-500/20' : 'text-slate-500 hover:text-white'}`}
                    >
                      <Upload size={14} /> P2P FILE
                    </button>
                  </div>

                  <div className="flex-1">
                    {videoSource === 'url' && (
                      <form onSubmit={handleVideoUrlSubmit} className="flex gap-2">
                        <input
                          type="url"
                          value={videoUrl}
                          onChange={(e) => setVideoUrl(e.target.value)}
                          placeholder="STREAM SOURCE URL (MP4, HLS...)"
                          className="glass-input !py-2 text-xs sm:text-sm font-mono tracking-wider flex-1"
                        />
                        <button type="submit" className="glass-button !py-2 !px-4 sm:!px-6 text-[10px] !from-cyan-500 !to-cyan-400">
                          LOAD
                        </button>
                      </form>
                    )}
                    {videoSource === 'file' && (
                      <div className="flex items-center gap-3 text-slate-400 text-xs sm:text-sm italic px-2 sm:px-4 py-2">
                         <Zap size={14} className="text-violet-400 shrink-0" />
                         Local file protocol active. Use sidebar tools.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Comms Sidebar */}
          <aside className="w-full lg:w-[400px] shrink-0 flex flex-col gap-6 min-h-[400px] lg:min-h-0 lg:h-auto overflow-visible lg:overflow-hidden pb-8 lg:pb-0">
             {/* Participants & Comms */}
             <div className="glass-card flex-1 flex flex-col overflow-hidden border-white/5 min-h-[300px]">
                <div className="px-6 py-4 border-b border-white/5 bg-white/5 flex items-center justify-between shrink-0">
                   <div className="flex items-center gap-2">
                      <MessageSquare size={16} className="text-violet-400" />
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">COMMS CENTER</span>
                   </div>
                   <div className="flex items-center gap-1.5">
                      <Users size={12} className="text-slate-500" />
                      <span className="text-[10px] font-bold text-slate-500">{participants.length}</span>
                   </div>
                </div>
                
                <div className="flex-1 overflow-hidden flex flex-col">
                  <ChatBox messages={messages} onSendMessage={sendMessage} />
                </div>
             </div>

             {/* Protocol Tools */}
             <div className="glass-card p-6 shrink-0 border-white/5">
               {socket && (
                <VideoFileSharing
                  socket={socket}
                  roomId={id}
                  isHost={isHost}
                  participants={participants}
                  onVideoReady={handleVideoFileReady}
                  hostVideoSource={videoSource}
                  initialFileShare={fileShare}
                />
              )}
             </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
