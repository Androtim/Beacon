import { useState, useRef, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useWatchParty } from '../hooks/useWatchParty'
import { ArrowLeft, Send, Users, Video, Link2, Monitor, Info } from 'lucide-react'
import videojs from 'video.js'
import 'video.js/dist/video-js.css'

export default function WatchParty() {
  const { id: roomId } = useParams()
  const { user } = useAuth()
  const { 
    participants, isHost, messages, videoState, 
    setVideoUrl, playVideo, pauseVideo, seekVideo, sendMessage, connected 
  } = useWatchParty(roomId, user)

  const videoRef = useRef(null)
  const playerRef = useRef(null)
  const [urlInput, setUrlInput] = useState('')
  const [chatInput, setChatInput] = useState('')
  const [showInfo, setShowInfo] = useState(false)

  // Initialize Video.js
  useEffect(() => {
    if (videoRef.current && !playerRef.current) {
      playerRef.current = videojs(videoRef.current, {
        controls: true,
        responsive: true,
        fluid: true,
        userActions: { doubleClick: false }
      })

      // Sync local controls to room (Host only)
      if (isHost) {
        playerRef.current.on('play', () => playVideo(playerRef.current.currentTime()))
        playerRef.current.on('pause', () => pauseVideo(playerRef.current.currentTime()))
        playerRef.current.on('seeked', () => seekVideo(playerRef.current.currentTime()))
      }
    }

    return () => {
      if (playerRef.current) {
        playerRef.current.dispose()
        playerRef.current = null
      }
    }
  }, [isHost])

  // Sync player to room state (For non-hosts or remote updates)
  useEffect(() => {
    if (!playerRef.current) return

    // Remote URL change
    if (videoState.url && playerRef.current.src() !== videoState.url) {
      playerRef.current.src({ src: videoState.url, type: 'video/mp4' })
    }

    // Remote Play/Pause/Seek
    const localTime = playerRef.current.currentTime()
    if (Math.abs(localTime - videoState.currentTime) > 1) {
       playerRef.current.currentTime(videoState.currentTime)
    }

    if (videoState.isPlaying && playerRef.current.paused()) {
      playerRef.current.play().catch(() => {})
    } else if (!videoState.isPlaying && !playerRef.current.paused()) {
      playerRef.current.pause()
    }
  }, [videoState])

  const handleUrlSubmit = (e) => {
    e.preventDefault()
    if (urlInput.trim()) {
      setVideoUrl(urlInput.trim())
      setUrlInput('')
    }
  }

  const handleChatSubmit = (e) => {
    e.preventDefault()
    if (chatInput.trim()) {
      sendMessage(chatInput.trim())
      setChatInput('')
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg-secondary)]">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          
          {/* Main Player Area */}
          <div className="flex-1 space-y-6">
            <header className="flex items-center justify-between bg-[var(--bg-primary)] p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
              <div className="flex items-center gap-4">
                <Link to="/" className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-500 dark:text-slate-400 dark:text-slate-500">
                  <ArrowLeft size={20} />
                </Link>
                <div>
                  <h2 className="text-lg font-bold text-[var(--text-primary)] leading-tight">Room: {roomId}</h2>
                  <div className={`text-[10px] font-bold uppercase tracking-wider ${connected ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {connected ? '● Sync Active' : '● Disconnected'}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full border border-blue-100">
                  <Users size={14} className="text-blue-500" />
                  <span className="text-xs font-bold">{participants.length}</span>
                </div>
                <button onClick={() => setShowInfo(!showInfo)} className="p-2 text-slate-400 dark:text-slate-500 hover:text-slate-600">
                  <Info size={20} />
                </button>
              </div>
            </header>

            {/* Video Card */}
            <div className="bg-slate-950 rounded-2xl overflow-hidden shadow-2xl border border-slate-800 ring-1 ring-slate-900/5 aspect-video flex items-center justify-center relative group">
              {!videoState.url ? (
                <div className="text-center space-y-4 animate-in fade-in zoom-in duration-500">
                  <div className="w-20 h-20 bg-[var(--text-primary)] rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-800">
                    <Video size={32} className="text-slate-700" />
                  </div>
                  <p className="text-slate-400 dark:text-slate-500 font-medium">Waiting for host to load content...</p>
                </div>
              ) : (
                <div data-vjs-player className="w-full h-full">
                  <video ref={videoRef} className="video-js vjs-big-play-centered" />
                </div>
              )}
            </div>

            {/* Host Controls */}
            {isHost && (
              <div className="bg-[var(--bg-primary)] p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2 uppercase tracking-tight">
                  <Monitor size={16} className="text-blue-500" /> Host Controls
                </h3>
                <form onSubmit={handleUrlSubmit} className="flex gap-3">
                  <div className="relative flex-1">
                    <Link2 size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                    <input 
                      type="text" 
                      className="w-full bg-[var(--bg-secondary)] border border-slate-200 dark:border-slate-700 rounded-xl py-3 pl-11 pr-4 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
                      placeholder="Enter direct mp4/m4v URL..."
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                    />
                  </div>
                  <button type="submit" className="bg-[var(--text-primary)] hover:opacity-90 text-[var(--bg-primary)] px-6 py-3 rounded-xl text-sm font-bold transition-all shadow-lg active:scale-95">
                    Stream Now
                  </button>
                </form>
              </div>
            )}
          </div>

          {/* Side Chat */}
          <div className="w-full lg:w-[400px] bg-[var(--bg-primary)] rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col h-[600px] lg:h-auto overflow-hidden">
            <div className="p-5 border-bottom border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-[var(--text-primary)]">Live Chat</h3>
              <div className="h-2 w-2 bg-emerald-500 rounded-full animate-pulse" />
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-[var(--bg-secondary)]/50">
              {messages.map((msg, i) => (
                <div key={i} className={`flex flex-col ${msg.type === 'system' ? 'items-center' : (msg.username === user.username ? 'items-end' : 'items-start')}`}>
                  {msg.type === 'system' ? (
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 bg-slate-200/50 px-2 py-1 rounded-md uppercase tracking-wider">{msg.message}</span>
                  ) : (
                    <>
                      <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mb-1 px-1">{msg.username}</span>
                      <div className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm shadow-sm ${
                        msg.username === user.username 
                          ? 'bg-blue-600 text-white rounded-tr-none' 
                          : 'bg-[var(--bg-primary)] text-slate-800 dark:text-slate-200 rounded-tl-none border border-slate-100 dark:border-slate-800'
                      }`}>
                        {msg.message}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>

            <form onSubmit={handleChatSubmit} className="p-4 bg-[var(--bg-primary)] border-t border-slate-100 dark:border-slate-800 flex gap-2">
              <input 
                type="text" 
                className="flex-1 bg-[var(--bg-secondary)] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                placeholder="Say something..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
              />
              <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white w-10 h-10 flex items-center justify-center rounded-xl transition-all shadow-md active:scale-90">
                <Send size={18} />
              </button>
            </form>
          </div>

        </div>
      </div>
    </div>
  )
}
