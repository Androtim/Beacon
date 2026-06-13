import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useWatchParty } from '../hooks/useWatchParty'
import VideoFileSharing from '../components/VideoFileSharing'
import SyncedPlayer from '../components/SyncedPlayer'
import VoicePanel from '../components/VoicePanel'
import { ArrowLeft, Send, Users, Video, Link2, Film, Radio, Clapperboard, Minimize2, Copy, Check } from 'lucide-react'

export default function WatchParty() {
  const { id: roomId } = useParams()
  const { user } = useAuth()
  const {
    participants, isHost, messages, playback, serverNow,
    setVideoUrl, playVideo, pauseVideo, seekVideo, sendMessage, connected, socket, fileShare,
    streamRequests, myRequest, requestStream, respondStream, clearMyRequest,
  } = useWatchParty(roomId, user)

  const [urlInput, setUrlInput] = useState('')
  const [suggestInput, setSuggestInput] = useState('')
  const [chatInput, setChatInput] = useState('')
  const [hostVideoSource, setHostVideoSource] = useState('url') // 'url' | 'file'
  const [localFileUrl, setLocalFileUrl] = useState(null)
  const [cinema, setCinema] = useState(false)
  const [copied, setCopied] = useState(false)

  // P2P-shared files travel as blob URLs, only valid in the browser that made
  // them — everyone plays their own local copy.
  const isLocalBlob = playback.url && playback.url.startsWith('blob:')
  const activeVideoSrc = isLocalBlob ? (isHost ? playback.url : localFileUrl) : playback.url

  const handleUrlSubmit = (e) => {
    e.preventDefault()
    if (urlInput.trim()) { setVideoUrl(urlInput.trim()); setUrlInput('') }
  }
  const handleChatSubmit = (e) => {
    e.preventDefault()
    if (chatInput.trim()) { sendMessage(chatInput.trim()); setChatInput('') }
  }
  const handleLocalVideoReady = (url) => {
    setLocalFileUrl(url)
    if (isHost) setVideoUrl(url)
  }
  const handleSuggest = (e) => {
    e.preventDefault()
    if (suggestInput.trim()) { requestStream(suggestInput.trim()); setSuggestInput('') }
  }
  const copyCode = () => {
    navigator.clipboard?.writeText(roomId).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const videoPane = (
    <div
      className="relative w-full aspect-video grid place-items-center overflow-hidden bg-black"
      style={{ borderRadius: cinema ? 0 : 'var(--radius)', boxShadow: cinema ? 'none' : '0 12px 50px -10px rgba(0,0,0,0.6)' }}
    >
      {!activeVideoSrc ? (
        <div className="text-center space-y-4 p-6">
          <div className="beacon-mark w-16 h-16 rounded-2xl grid place-items-center mx-auto animate-beacon">
            <Video size={28} className="text-white" />
          </div>
          <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
            {isHost ? 'Pick something to watch below to get started.' : 'Waiting for the host to start something…'}
          </p>
        </div>
      ) : (
        <SyncedPlayer
          src={activeVideoSrc}
          playback={playback}
          serverNow={serverNow}
          isHost={isHost}
          onIntent={{ play: playVideo, pause: pauseVideo, seek: seekVideo }}
        />
      )}

      {/* Cinema toggle floats over the video */}
      <button
        onClick={() => setCinema((c) => !c)}
        className="absolute top-3 right-3 z-10 h-9 w-9 grid place-items-center rounded-xl backdrop-blur-md transition-all hover:scale-105"
        style={{ background: 'rgba(0,0,0,0.45)', color: '#fff' }}
        title={cinema ? 'Exit cinema mode' : 'Cinema mode (lights down)'}
        data-testid="cinema-toggle"
      >
        {cinema ? <Minimize2 size={16} /> : <Clapperboard size={16} />}
      </button>
    </div>
  )

  // ---- Cinema mode: video fills the screen, everything else recedes ----
  if (cinema) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#000' }} data-testid="cinema-stage">
        <div className="flex-1 grid place-items-center">{videoPane}</div>
        <Link
          to="/"
          className="absolute top-3 left-3 h-9 px-3 inline-flex items-center gap-2 rounded-xl backdrop-blur-md text-xs font-bold"
          style={{ background: 'rgba(0,0,0,0.45)', color: '#fff' }}
        >
          <ArrowLeft size={15} /> Leave
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Stage */}
        <div className="flex-1 space-y-5 min-w-0">
          {/* Header */}
          <header className="glass-card flex items-center justify-between p-4">
            <div className="flex items-center gap-3 min-w-0">
              <Link to="/" className="nav-item !px-2 !py-2" title="Leave party"><ArrowLeft size={18} /></Link>
              <div className="min-w-0">
                <button onClick={copyCode} className="flex items-center gap-2 group" title="Copy room code">
                  <h2 className="text-base font-bold truncate" style={{ color: 'var(--text-primary)' }}>Room {roomId}</h2>
                  {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} style={{ color: 'var(--text-secondary)' }} className="opacity-0 group-hover:opacity-100 transition-opacity" />}
                </button>
                <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: connected ? 'rgb(16 185 129)' : 'rgb(244 63 94)' }}>
                  {connected ? '● Connected' : '● Reconnecting…'}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ background: 'rgb(var(--accent) / 0.14)', color: 'rgb(var(--accent))' }}>
              <Users size={14} />
              <span className="text-xs font-bold" data-testid="participant-count">{participants.length}</span>
            </div>
          </header>

          {videoPane}

          {/* Host: pending suggestions to approve */}
          {isHost && streamRequests.length > 0 && (
            <div className="glass-card p-4 space-y-2" data-testid="stream-requests">
              {streamRequests.map((req) => (
                <div key={req.requestId} className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
                      <span style={{ color: 'rgb(var(--accent))' }}>{req.from.username}</span> wants to play
                    </p>
                    <p className="text-[11px] truncate" style={{ color: 'var(--text-secondary)' }}>{req.url}</p>
                  </div>
                  <button onClick={() => respondStream(req.requestId, true)} className="btn btn-primary h-9 px-4 text-[11px]" data-testid="approve-request">Approve</button>
                  <button onClick={() => respondStream(req.requestId, false)} className="btn btn-secondary h-9 px-4 text-[11px]">Deny</button>
                </div>
              ))}
            </div>
          )}

          {/* Participant: suggest a video + receive a shared file */}
          {!isHost && (
            <div className="space-y-5">
              <div className="glass-card p-5 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                  <Link2 size={15} style={{ color: 'rgb(var(--accent))' }} /> Suggest something to watch
                </h3>
                {myRequest?.status === 'pending' ? (
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }} data-testid="suggest-pending">Waiting for the host to approve…</p>
                ) : myRequest?.status === 'denied' ? (
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs text-rose-400" data-testid="suggest-denied">The host passed on that one.</p>
                    <button onClick={clearMyRequest} className="btn btn-secondary h-8 px-3 text-[10px]">OK</button>
                  </div>
                ) : (
                  <form onSubmit={handleSuggest} className="flex gap-2.5">
                    <input
                      type="text"
                      className="input-field flex-1"
                      placeholder="Paste a video link or YouTube URL…"
                      value={suggestInput}
                      onChange={(e) => setSuggestInput(e.target.value)}
                      data-testid="suggest-input"
                    />
                    <button type="submit" className="btn btn-primary px-5" data-testid="suggest-submit">Suggest</button>
                  </form>
                )}
              </div>
              <VideoFileSharing socket={socket} roomId={roomId} isHost={false} onVideoReady={handleLocalVideoReady} initialFileShare={fileShare} />
            </div>
          )}

          {/* Host controls */}
          {isHost && (
            <div className="glass-card p-5 space-y-4" data-testid="host-controls">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                  <Film size={15} style={{ color: 'rgb(var(--accent))' }} /> What are we watching?
                </h3>
                <div className="flex p-1 rounded-xl" style={{ background: 'rgb(0 0 0 / 0.2)' }}>
                  {[['url', 'Link', Link2], ['file', 'File', Film]].map(([key, label, Icon]) => (
                    <button
                      key={key}
                      onClick={() => setHostVideoSource(key)}
                      data-testid={`source-mode-${key}`}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
                      style={hostVideoSource === key
                        ? { background: 'rgb(var(--accent) / 0.2)', color: 'rgb(var(--accent))' }
                        : { color: 'var(--text-secondary)' }}
                    >
                      <Icon size={12} /> {label}
                    </button>
                  ))}
                </div>
              </div>

              {hostVideoSource === 'url' ? (
                <form onSubmit={handleUrlSubmit} className="flex gap-2.5">
                  <input
                    type="text"
                    className="input-field flex-1"
                    placeholder="Paste a video link or YouTube URL…"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    data-testid="video-url-input"
                  />
                  <button type="submit" className="btn btn-primary px-6" data-testid="video-url-submit">Play</button>
                </form>
              ) : (
                <VideoFileSharing socket={socket} roomId={roomId} isHost onVideoReady={handleLocalVideoReady} hostVideoSource={hostVideoSource} />
              )}
            </div>
          )}
        </div>

        {/* Sidebar: presence + voice + chat */}
        <div className="w-full lg:w-[340px] glass-card flex flex-col h-[520px] lg:h-[calc(100vh-7rem)] lg:sticky lg:top-6 overflow-hidden">
          <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
            <h3 className="font-bold text-sm uppercase tracking-wider flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <Radio size={15} style={{ color: 'rgb(var(--accent))' }} /> Party
            </h3>
            <div className="flex -space-x-2">
              {participants.slice(0, 5).map((p) => (
                <div key={p.id} className="w-7 h-7 rounded-full grid place-items-center text-[9px] font-bold ring-2"
                  style={{ background: 'rgb(var(--accent-2) / 0.3)', color: 'var(--text-primary)', ringColor: 'var(--surface)' }}
                  title={p.username}>
                  {(p.username ?? '?').slice(0, 2).toUpperCase()}
                </div>
              ))}
            </div>
          </div>

          <VoicePanel socket={socket} roomId={roomId} />

          <div className="flex-1 overflow-y-auto p-4 space-y-3" data-testid="chat-messages">
            {messages.length === 0 && (
              <p className="text-center text-[11px] mt-4" style={{ color: 'var(--text-secondary)' }}>Say hi 👋</p>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`flex flex-col ${msg.type === 'system' ? 'items-center' : (msg.username === user.username ? 'items-end' : 'items-start')}`}>
                {msg.type === 'system' ? (
                  <span className="text-[9px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wider"
                    style={{ background: 'rgb(var(--accent-2) / 0.12)', color: 'var(--text-secondary)' }}>
                    {msg.message}
                  </span>
                ) : (
                  <>
                    {msg.username !== user.username && (
                      <span className="text-[9px] font-bold mb-1 px-1" style={{ color: 'var(--text-secondary)' }}>{msg.username}</span>
                    )}
                    <div className="max-w-[85%] px-3.5 py-2.5 text-xs"
                      style={msg.username === user.username
                        ? { background: 'rgb(var(--accent))', color: '#1a0f0d', borderRadius: 'var(--radius)', borderTopRightRadius: 4 }
                        : { background: 'var(--surface-raised)', color: 'var(--text-primary)', borderRadius: 'var(--radius)', borderTopLeftRadius: 4 }}>
                      {msg.message}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>

          <form onSubmit={handleChatSubmit} className="p-3 border-t flex gap-2" style={{ borderColor: 'var(--border)' }}>
            <input
              type="text"
              className="input-field flex-1 h-10"
              placeholder="Message the party…"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              data-testid="chat-input"
            />
            <button type="submit" className="btn btn-primary w-10 h-10 !px-0"><Send size={15} /></button>
          </form>
        </div>
      </div>
    </div>
  )
}
