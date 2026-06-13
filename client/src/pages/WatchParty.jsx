import { useState, useRef, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useWatchParty } from '../hooks/useWatchParty'
import VideoFileSharing from '../components/VideoFileSharing'
import { ArrowLeft, Send, Users, Video, Link2, Monitor, Info, Film, Radio } from 'lucide-react'
import videojs from 'video.js'
import 'video.js/dist/video-js.css'

export default function WatchParty() {
  const { id: roomId } = useParams()
  const { user } = useAuth()
  const { 
    participants, isHost, messages, videoState, 
    setVideoUrl, playVideo, pauseVideo, seekVideo, sendMessage, connected, socket, fileShare
  } = useWatchParty(roomId, user)

  const videoRef = useRef(null)
  const playerRef = useRef(null)
  
  const [urlInput, setUrlInput] = useState('')
  const [chatInput, setChatInput] = useState('')
  const [showInfo, setShowInfo] = useState(false)
  const [hostVideoSource, setHostVideoSource] = useState('url') // 'url' or 'file'
  const [localFileUrl, setLocalFileUrl] = useState(null)

  const isLocalBlob = videoState.url && videoState.url.startsWith('blob:')
  const activeVideoSrc = isLocalBlob ? (isHost ? videoState.url : localFileUrl) : videoState.url

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
  }, [isHost, activeVideoSrc]) // Re-initialize player if active source transitions

  // Sync player to room state (For non-hosts or remote updates)
  useEffect(() => {
    if (!playerRef.current || !activeVideoSrc) return

    // Remote URL change
    if (playerRef.current.src() !== activeVideoSrc) {
      // Determine content type
      let type = 'video/mp4'
      if (activeVideoSrc.includes('.webm')) type = 'video/webm'
      playerRef.current.src({ src: activeVideoSrc, type })
    }

    // Remote Play/Pause/Seek
    const localTime = playerRef.current.currentTime()
    if (Math.abs(localTime - videoState.currentTime) > 1.5) {
       playerRef.current.currentTime(videoState.currentTime)
    }

    if (videoState.isPlaying && playerRef.current.paused()) {
      playerRef.current.play().catch(() => {})
    } else if (!videoState.isPlaying && !playerRef.current.paused()) {
      playerRef.current.pause()
    }
  }, [videoState, activeVideoSrc])

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

  const handleLocalVideoReady = (url) => {
    console.log('🎬 Local P2P Video loaded in WatchParty:', url)
    setLocalFileUrl(url)
    if (isHost) {
      setVideoUrl(url)
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg-secondary)] pb-12">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          
          {/* Main Player Area */}
          <div className="flex-1 space-y-6">
            <header className="flex items-center justify-between bg-[var(--bg-primary)] p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center gap-4">
                <Link to="/" className="p-2 hover:bg-slate-100 dark:hover:bg-slate-850 rounded-lg transition-colors text-slate-500 dark:text-slate-400">
                  <ArrowLeft size={20} />
                </Link>
                <div>
                  <h2 className="text-lg font-bold text-[var(--text-primary)] leading-tight">Room ID: {roomId}</h2>
                  <div className={`text-[10px] font-bold uppercase tracking-wider ${connected ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {connected ? '● Connection Secured' : '● Reconnecting...'}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 px-3 py-1.5 rounded-full border border-blue-100 dark:border-blue-500/20">
                  <Users size={14} className="text-blue-500" />
                  <span className="text-xs font-bold" data-testid="participant-count">{participants.length}</span>
                </div>
                <button onClick={() => setShowInfo(!showInfo)} className="p-2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-350">
                  <Info size={20} />
                </button>
              </div>
            </header>

            {/* Video Player Card */}
            <div className="bg-slate-950 rounded-2xl overflow-hidden shadow-2xl border border-slate-200/50 dark:border-slate-800 aspect-video flex items-center justify-center relative group">
              {!activeVideoSrc ? (
                <div className="text-center space-y-4 animate-in fade-in zoom-in duration-500 p-6">
                  <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-blue-500/20">
                    <Video size={28} className="text-blue-500 animate-pulse" />
                  </div>
                  <p className="text-slate-400 dark:text-slate-500 text-sm font-medium">Awaiting transmission coordinates from host...</p>
                </div>
              ) : (
                <div data-vjs-player className="w-full h-full">
                  <video ref={videoRef} className="video-js vjs-big-play-centered" />
                </div>
              )}
            </div>

            {/* Client file sharing pane (participants only) */}
            {!isHost && (
              <VideoFileSharing 
                socket={socket} 
                roomId={roomId} 
                isHost={false} 
                onVideoReady={handleLocalVideoReady}
                initialFileShare={fileShare}
              />
            )}

            {/* Host Controls */}
            {isHost && (
              <div className="bg-[var(--bg-primary)] p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-5" data-testid="host-controls">
                <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800">
                  <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2 uppercase tracking-tight">
                    <Monitor size={16} className="text-blue-500" /> Host Controls
                  </h3>
                  <div className="flex bg-slate-100/60 dark:bg-slate-850 p-1 rounded-lg border border-slate-200/50 dark:border-slate-800/80">
                    <button 
                      onClick={() => setHostVideoSource('url')}
                      className={`px-3 py-1 rounded-md text-xs font-bold transition-all duration-150 flex items-center gap-1.5 ${
                        hostVideoSource === 'url' 
                          ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm' 
                          : 'text-slate-400 dark:text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      <Link2 size={12} />
                      URL Link
                    </button>
                    <button 
                      onClick={() => setHostVideoSource('file')}
                      className={`px-3 py-1 rounded-md text-xs font-bold transition-all duration-150 flex items-center gap-1.5 ${
                        hostVideoSource === 'file' 
                          ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm' 
                          : 'text-slate-400 dark:text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      <Film size={12} />
                      Local P2P
                    </button>
                  </div>
                </div>

                {hostVideoSource === 'url' ? (
                  <form onSubmit={handleUrlSubmit} className="flex gap-3">
                    <div className="relative flex-1">
                      <Link2 size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                      <input 
                        type="text" 
                        className="w-full bg-[var(--bg-secondary)] border border-slate-200 dark:border-slate-800 rounded-xl py-3 pl-11 pr-4 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
                        placeholder="Enter direct mp4 link (or YouTube link)..."
                        value={urlInput}
                        onChange={(e) => setUrlInput(e.target.value)}
                        data-testid="video-url-input"
                      />
                    </div>
                    <button type="submit" data-testid="video-url-submit" className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl text-sm font-bold transition-all shadow-md active:scale-95">
                      Stream
                    </button>
                  </form>
                ) : (
                  <VideoFileSharing 
                    socket={socket} 
                    roomId={roomId} 
                    isHost={true} 
                    onVideoReady={handleLocalVideoReady}
                    hostVideoSource={hostVideoSource}
                  />
                )}
              </div>
            )}
          </div>

          {/* Side Chat */}
          <div className="w-full lg:w-[360px] bg-[var(--bg-primary)] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col h-[500px] lg:h-auto overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-[var(--text-primary)] text-sm uppercase tracking-wider flex items-center gap-2">
                <Radio size={16} className="text-blue-500 shrink-0" />
                Live Chat
              </h3>
              <div className="h-2 w-2 bg-emerald-500 rounded-full animate-pulse" />
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-[var(--bg-secondary)]/30" data-testid="chat-messages">
              {messages.map((msg, i) => (
                <div key={i} className={`flex flex-col ${msg.type === 'system' ? 'items-center' : (msg.username === user.username ? 'items-end' : 'items-start')}`}>
                  {msg.type === 'system' ? (
                    <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-850 px-2.5 py-1 rounded-md uppercase tracking-wider border border-slate-200/50 dark:border-slate-800/80">{msg.message}</span>
                  ) : (
                    <>
                      <span className="text-[9px] font-bold text-slate-450 dark:text-slate-500 mb-1 px-1">{msg.username}</span>
                      <div className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-xs shadow-sm ${
                        msg.username === user.username 
                          ? 'bg-blue-600 text-white rounded-tr-none' 
                          : 'bg-[var(--bg-primary)] text-slate-800 dark:text-slate-200 rounded-tl-none border border-slate-100 dark:border-slate-850'
                      }`}>
                        {msg.message}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>

            <form onSubmit={handleChatSubmit} className="p-3 bg-[var(--bg-primary)] border-t border-slate-100 dark:border-slate-800 flex gap-2">
              <input 
                type="text" 
                className="flex-1 bg-[var(--bg-secondary)] border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                placeholder="Broadcast a message..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                data-testid="chat-input"
              />
              <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white w-9 h-9 flex items-center justify-center rounded-xl transition-all shadow-md active:scale-90">
                <Send size={15} />
              </button>
            </form>
          </div>

        </div>
      </div>
    </div>
  )
}
