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
    <div className="container" style={{ maxWidth: '1400px', height: '100vh', display: 'flex', padding: 0, backgroundColor: '#f1f5f9' }}>
      {/* Main Player Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <header style={{ padding: '1rem 2rem', backgroundColor: 'white', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            <Link to="/" style={{ color: '#64748b' }}><ArrowLeft size={20} /></Link>
            <div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 'bold', margin: 0 }}>Room: {roomId}</h2>
              <div style={{ fontSize: '0.75rem', color: connected ? '#22c55e' : '#ef4444' }}>
                 {connected ? '● SYNCED' : '● DISCONNECTED'}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
             <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: '#f8fafc', padding: '0.4rem 0.8rem', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
               <Users size={16} style={{ color: '#2563eb' }} />
               <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>{participants.length}</span>
             </div>
             <button onClick={() => setShowInfo(!showInfo)} style={{ background: 'none', border: 'none', color: '#94a3b8' }}><Info size={20} /></button>
          </div>
        </header>

        <main style={{ flex: 1, padding: '2rem', display: 'flex', flexDirection: 'column', gap: '2rem', overflowY: 'auto' }}>
          {/* Player */}
          <div className="card" style={{ padding: 0, overflow: 'hidden', backgroundColor: 'black', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            {!videoState.url ? (
               <div style={{ aspectRatio: '16/9', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                  <Video size={64} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                  <p>Wait for host to initialize stream</p>
               </div>
            ) : (
              <div data-vjs-player>
                <video ref={videoRef} className="video-js vjs-big-play-centered" />
              </div>
            )}
          </div>

          {/* Host Controls */}
          {isHost && (
            <div className="card">
              <h3 style={{ fontSize: '0.9rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Monitor size={16} /> Stream Configuration
              </h3>
              <form onSubmit={handleUrlSubmit} style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ flex: 1, position: 'relative' }}>
                  <Link2 size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: '#94a3b8' }} />
                  <input 
                    type="text" 
                    className="input-field" 
                    style={{ marginBottom: 0, paddingLeft: '2.5rem' }}
                    placeholder="Paste direct video URL (mp4, m4v)..."
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                  />
                </div>
                <button type="submit" className="btn btn-primary">Load Stream</button>
              </form>
            </div>
          )}
        </main>
      </div>

      {/* Side Chat */}
      <div style={{ width: '380px', backgroundColor: 'white', borderLeft: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)' }}>
          <h3 style={{ margin: 0, fontSize: '1rem' }}>Live Conversation</h3>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {messages.map((msg, i) => (
            <div key={i} style={{ alignSelf: msg.type === 'system' ? 'center' : (msg.username === user.username ? 'flex-end' : 'flex-start'), maxWidth: '85%' }}>
              {msg.type === 'system' ? (
                 <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{msg.message}</div>
              ) : (
                <>
                  <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginBottom: '0.2rem', marginLeft: '0.5rem' }}>{msg.username}</div>
                  <div style={{ 
                    padding: '0.6rem 1rem', 
                    borderRadius: '18px', 
                    backgroundColor: msg.username === user.username ? '#2563eb' : '#f1f5f9',
                    color: msg.username === user.username ? 'white' : '#1e293b',
                    fontSize: '0.9rem'
                  }}>
                    {msg.message}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        <form onSubmit={handleChatSubmit} style={{ padding: '1.5rem', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '0.75rem' }}>
          <input 
            type="text" 
            className="input-field" 
            style={{ marginBottom: 0, borderRadius: '24px' }}
            placeholder="Type a message..."
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
          />
          <button type="submit" className="btn btn-primary" style={{ borderRadius: '50%', width: '42px', height: '42px', padding: 0 }}>
            <Send size={18} />
          </button>
        </form>
      </div>
    </div>
  )
}
