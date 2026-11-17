import React, { useState, useEffect, useRef } from 'react'
import { useParams, Link, useLocation } from 'react-router-dom'
import {
  ArrowLeft,
  Send,
  Users,
  Video,
  Link2,
  Film,
  Radio,
  Clapperboard,
  Minimize2,
  Copy,
  Check,
  UserPlus,
  MessageSquare,
  Sparkles,
  Volume2,
  ShieldCheck,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useWatchParty } from '../hooks/useWatchParty'
import { recordRoom } from '../hooks/useRecentRooms'
import { useToast } from '../context/ToastContext'
import VideoFileSharing from '../components/VideoFileSharing'
import SyncedPlayer from '../components/SyncedPlayer'
import VoicePanel from '../components/VoicePanel'
import InviteModal from '../components/InviteModal'
import { Avatar, AvatarStack, LiveDot } from '../components/ui'

const QUICK_REACTIONS = ['✦', '♥', '☕', '🌙', '🎬']

export default function WatchParty() {
  const { id: roomId } = useParams()
  const location = useLocation()
  const { user } = useAuth()
  const { notify } = useToast()

  const {
    participants,
    isHost,
    messages,
    playback,
    serverNow,
    setVideoUrl,
    playVideo,
    pauseVideo,
    seekVideo,
    sendMessage,
    connected,
    socket,
    fileShare,
    streamRequests,
    myRequest,
    requestStream,
    respondStream,
    clearMyRequest,
  } = useWatchParty(roomId, user)

  const [urlInput, setUrlInput] = useState('')
  const [suggestInput, setSuggestInput] = useState('')
  const [chatInput, setChatInput] = useState('')
  const [hostVideoSource, setHostVideoSource] = useState(
    () => location.state?.initialSourceMode || 'url'
  ) // 'url' | 'file'
  const [localFileUrl, setLocalFileUrl] = useState(null)
  const [cinema, setCinema] = useState(false)
  const [copied, setCopied] = useState(false)
  const [activeTab, setActiveTab] = useState('chat') // 'chat' | 'people'
  const [inviteOpen, setInviteOpen] = useState(false)
  const [floatingReactions, setFloatingReactions] = useState([])
  const appliedInitialUrlRef = useRef(false)

  const roomTitle = location.state?.roomTitle || `Room ${roomId}`

  // Remember this room for the sidebar's "open parties" section.
  useEffect(() => {
    if (roomId) {
      recordRoom(roomId, {
        title: roomTitle,
        url: playback?.url || '',
        contents: playback?.url || roomTitle,
      })
    }
  }, [roomId, roomTitle, playback?.url])

  // Auto-apply initial URL from CreateRoomModal
  useEffect(() => {
    const initUrl = location.state?.initialUrl
    if (initUrl && isHost && !playback?.url && !appliedInitialUrlRef.current) {
      appliedInitialUrlRef.current = true
      setVideoUrl(initUrl)
    }
  }, [location.state, isHost, playback?.url, setVideoUrl])

  // P2P-shared files travel as blob URLs, only valid in the browser that made
  // them — everyone plays their own local copy.
  const isLocalBlob = playback.url && playback.url.startsWith('blob:')
  const activeVideoSrc = isLocalBlob ? (isHost ? playback.url : localFileUrl) : playback.url

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
    setLocalFileUrl(url)
    if (isHost) setVideoUrl(url)
  }
  const handleSuggest = (e) => {
    e.preventDefault()
    if (suggestInput.trim()) {
      requestStream(suggestInput.trim())
      setSuggestInput('')
    }
  }
  const copyCode = () => {
    navigator.clipboard?.writeText(roomId).catch(() => {})
    setCopied(true)
    notify(`Copied room code · ${roomId}`, 'Share it with friends to join', 'mint')
    setTimeout(() => setCopied(false), 1500)
  }

  const triggerReaction = (symbol) => {
    const id = `${Date.now()}-${Math.random()}`
    const left = 18 + Math.round(Math.random() * 64)
    setFloatingReactions((prev) => [...prev, { id, symbol, left }])
    sendMessage(symbol)
    setTimeout(() => {
      setFloatingReactions((prev) => prev.filter((r) => r.id !== id))
    }, 2200)
  }

  // Cinema mode is pure CSS: the player stays mounted in the same place in the
  // tree and is expanded to a fixed fullscreen overlay. (Re-rendering it
  // elsewhere would unmount the <video> and kill the P2P stream.)
  const videoPane = (
    <div
      data-testid={cinema ? 'cinema-stage' : 'video-pane'}
      className={
        cinema
          ? 'fixed inset-0 z-50 grid place-items-center overflow-hidden bg-black'
          : 'relative w-full aspect-video grid place-items-center overflow-hidden bg-black rounded-2xl border border-line-strong shadow-2xl'
      }
    >
      <div className={cinema ? 'w-full h-full grid place-items-center' : 'contents'}>
        {!activeVideoSrc ? (
          <div className="text-center space-y-4 p-6">
            <div className="w-16 h-16 rounded-2xl bg-accent-soft border border-accent/30 text-accent grid place-items-center mx-auto">
              <Video size={28} />
            </div>
            <div className="space-y-1">
              <p className="font-serif text-lg text-white">
                {isHost
                  ? 'The screen is yours to light.'
                  : 'Waiting for the host to start something…'}
              </p>
              <p className="text-xs text-white/60">
                {isHost
                  ? 'Paste a link or share a local video file below.'
                  : 'You’ll automatically snap to their exact frame.'}
              </p>
            </div>
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
      </div>

      {/* Floating emoji reactions */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {floatingReactions.map((r) => (
          <div
            key={r.id}
            style={{ left: `${r.left}%` }}
            className="absolute bottom-8 text-2xl animate-[reaction-rise_2.2s_ease-out_forwards]"
          >
            {r.symbol}
          </div>
        ))}
      </div>

      {/* Cinema toggle floats over the video */}
      <button
        onClick={() => setCinema((c) => !c)}
        className="absolute top-3 right-3 z-10 h-9 w-9 grid place-items-center rounded-xl backdrop-blur-md transition-all hover:scale-105 bg-black/55 border border-white/15 text-white"
        title={cinema ? 'Exit cinema mode' : 'Cinema mode (lights down)'}
        data-testid="cinema-toggle"
      >
        {cinema ? <Minimize2 size={16} /> : <Clapperboard size={16} />}
      </button>
    </div>
  )

  const avatarPeople = participants.map((p, i) => ({
    id: p.id || String(i),
    name: p.username || 'Guest',
  }))

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Stage */}
        <div className="flex-1 space-y-4 min-w-0">
          {/* Header */}
          <header className="panel flex items-center justify-between p-4 gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Link
                to="/"
                className="icon-btn"
                title="Leave party"
              >
                <ArrowLeft size={18} />
              </Link>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={copyCode}
                    className="flex items-center gap-2 group"
                    title="Copy room code"
                  >
                    <h2 className="font-serif text-lg sm:text-xl text-ink truncate">
                      {roomTitle}
                    </h2>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-panel-2 border border-line font-mono text-xs text-accent">
                      {roomId}
                      {copied ? (
                        <Check size={12} className="text-mint" />
                      ) : (
                        <Copy
                          size={12}
                          className="text-muted group-hover:text-ink transition-colors"
                        />
                      )}
                    </span>
                  </button>
                </div>
                <div
                  className={`text-[11px] font-medium flex items-center gap-1.5 mt-0.5 ${
                    connected ? 'text-mint' : 'text-coral'
                  }`}
                >
                  <LiveDot color={connected ? 'mint' : 'amber'} />
                  <span>{connected ? 'Connected · Frame-synced' : 'Reconnecting…'}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {avatarPeople.length > 0 && (
                <div className="hidden sm:flex items-center">
                  <AvatarStack people={avatarPeople} size="xs" max={4} />
                </div>
              )}
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent-soft border border-accent/25 text-accent">
                <Users size={14} />
                <span className="text-xs font-bold" data-testid="participant-count">
                  {participants.length}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setInviteOpen(true)}
                className="btn btn-primary text-xs py-1.5 px-3 inline-flex items-center gap-1.5"
              >
                <UserPlus size={14} />
                <span className="hidden sm:inline">Invite</span>
              </button>
            </div>
          </header>

          {videoPane}

          {/* Host: pending suggestions to approve */}
          {isHost && streamRequests.length > 0 && (
            <div className="panel p-4 space-y-2" data-testid="stream-requests">
              {streamRequests.map((req) => (
                <div key={req.requestId} className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-ink">
                      <span className="text-accent">{req.from.username}</span> wants to
                      play
                    </p>
                    <p className="text-[11px] truncate text-muted font-mono">
                      {req.url}
                    </p>
                  </div>
                  <button
                    onClick={() => respondStream(req.requestId, true)}
                    className="btn btn-primary h-9 px-4 text-[11px]"
                    data-testid="approve-request"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => respondStream(req.requestId, false)}
                    className="btn btn-secondary h-9 px-4 text-[11px]"
                  >
                    Deny
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Participant: suggest a video + receive a shared file */}
          {!isHost && (
            <div className="space-y-4">
              <div className="panel p-5 space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2 text-ink">
                    <Link2 size={15} className="text-accent" /> Suggest something to watch
                  </h3>
                  <div className="flex items-center gap-1">
                    {QUICK_REACTIONS.map((sym) => (
                      <button
                        key={sym}
                        type="button"
                        onClick={() => triggerReaction(sym)}
                        className="w-7 h-7 rounded-lg bg-panel-2 hover:bg-panel-3 border border-line text-sm flex items-center justify-center transition-transform active:scale-125"
                        title={`Send ${sym}`}
                      >
                        {sym}
                      </button>
                    ))}
                  </div>
                </div>
                {myRequest?.status === 'pending' ? (
                  <p className="text-xs text-muted" data-testid="suggest-pending">
                    Waiting for the host to approve…
                  </p>
                ) : myRequest?.status === 'denied' ? (
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs text-coral" data-testid="suggest-denied">
                      The host passed on that one.
                    </p>
                    <button
                      onClick={clearMyRequest}
                      className="btn btn-secondary h-8 px-3 text-[10px]"
                    >
                      OK
                    </button>
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
                    <button
                      type="submit"
                      className="btn btn-primary px-5"
                      data-testid="suggest-submit"
                    >
                      Suggest
                    </button>
                  </form>
                )}
              </div>
              <VideoFileSharing
                socket={socket}
                roomId={roomId}
                isHost={false}
                onVideoReady={handleLocalVideoReady}
                initialFileShare={fileShare}
              />
            </div>
          )}

          {/* Host controls */}
          {isHost && (
            <div className="panel p-5 space-y-4" data-testid="host-controls">
              <div className="flex flex-wrap justify-between items-center gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2 text-ink">
                  <Film size={15} className="text-accent" /> What are we watching?
                </h3>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 mr-1">
                    {QUICK_REACTIONS.map((sym) => (
                      <button
                        key={sym}
                        type="button"
                        onClick={() => triggerReaction(sym)}
                        className="w-7 h-7 rounded-lg bg-panel-2 hover:bg-panel-3 border border-line text-sm flex items-center justify-center transition-transform active:scale-125"
                        title={`Send ${sym}`}
                      >
                        {sym}
                      </button>
                    ))}
                  </div>
                  <div className="flex p-1 rounded-xl bg-panel-2 border border-line">
                    {[
                      ['url', 'Link', Link2],
                      ['file', 'File', Film],
                    ].map(([key, label, Icon]) => (
                      <button
                        key={key}
                        onClick={() => setHostVideoSource(key)}
                        data-testid={`source-mode-${key}`}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                          hostVideoSource === key
                            ? 'bg-accent-soft text-accent'
                            : 'text-muted hover:text-ink'
                        }`}
                      >
                        <Icon size={12} /> {label}
                      </button>
                    ))}
                  </div>
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
                  <button
                    type="submit"
                    className="btn btn-primary px-6"
                    data-testid="video-url-submit"
                  >
                    Play
                  </button>
                </form>
              ) : (
                <VideoFileSharing
                  socket={socket}
                  roomId={roomId}
                  isHost={true}
                  hostVideoSource={hostVideoSource}
                  onVideoReady={handleLocalVideoReady}
                  initialFileShare={fileShare}
                />
              )}
            </div>
          )}

          {/* Reassurance strip */}
          <div className="hidden sm:grid grid-cols-3 gap-2">
            {[
              { icon: Sparkles, text: 'Everyone lands in the same frame' },
              { icon: Volume2, text: 'Voice stays opt-in' },
              { icon: ShieldCheck, text: 'Late joiners snap to sync' },
            ].map((item, idx) => {
              const Icon = item.icon
              return (
                <div
                  key={idx}
                  className="px-3 py-2 rounded-xl bg-panel/60 border border-line flex items-center gap-2 text-[11px] text-muted"
                >
                  <Icon className="w-3.5 h-3.5 text-accent shrink-0" />
                  <span className="truncate">{item.text}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Sidebar: presence + voice + chat */}
        <div className="w-full lg:w-[350px] panel flex flex-col h-[520px] lg:h-[calc(100vh-7rem)] lg:sticky lg:top-20 overflow-hidden shrink-0">
          <div className="px-4 pt-3 border-b border-line flex items-center justify-between bg-panel">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setActiveTab('chat')}
                className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
                  activeTab === 'chat'
                    ? 'border-accent text-ink'
                    : 'border-transparent text-muted hover:text-ink'
                }`}
              >
                <MessageSquare size={14} /> Room chat
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('people')}
                className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
                  activeTab === 'people'
                    ? 'border-accent text-ink'
                    : 'border-transparent text-muted hover:text-ink'
                }`}
              >
                <Users size={14} /> People ({participants.length})
              </button>
            </div>
            <Radio size={14} className="text-mint" />
          </div>

          <VoicePanel socket={socket} roomId={roomId} />

          {activeTab === 'chat' ? (
            <>
              <div
                className="flex-1 overflow-y-auto p-4 space-y-3"
                data-testid="chat-messages"
              >
                {messages.length === 0 && (
                  <p className="text-center text-xs mt-4 text-muted">
                    The booth is quiet — say hi 👋
                  </p>
                )}
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex flex-col ${
                      msg.type === 'system'
                        ? 'items-center'
                        : msg.username === user?.username
                        ? 'items-end'
                        : 'items-start'
                    }`}
                  >
                    {msg.type === 'system' ? (
                      <span className="text-[10px] font-mono px-2.5 py-1 rounded-md uppercase tracking-wider bg-panel-2 border border-line text-muted">
                        {msg.message}
                      </span>
                    ) : (
                      <>
                        {msg.username !== user?.username && (
                          <span className="text-[10px] font-semibold mb-1 px-1 text-accent">
                            {msg.username}
                          </span>
                        )}
                        <div
                          className={`max-w-[85%] px-3.5 py-2.5 text-xs rounded-2xl ${
                            msg.username === user?.username
                              ? 'bg-accent text-accent-ink font-medium rounded-tr-sm'
                              : 'bg-panel-2 text-ink border border-line rounded-tl-sm'
                          }`}
                        >
                          {msg.message}
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>

              <form
                onSubmit={handleChatSubmit}
                className="p-3 border-t border-line flex gap-2 bg-panel-2/40"
              >
                <input
                  type="text"
                  className="input-field flex-1 h-10"
                  placeholder="Message the party…"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  data-testid="chat-input"
                />
                <button type="submit" className="btn btn-primary w-10 h-10 !px-0">
                  <Send size={15} />
                </button>
              </form>
            </>
          ) : (
            <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
              {participants.map((p, idx) => (
                <div
                  key={p.id || idx}
                  className="flex items-center justify-between gap-2.5 p-2.5 rounded-xl bg-panel-2 border border-line"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Avatar name={p.username || 'Guest'} size="sm" status="online" />
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-ink truncate">
                        {p.username || 'Guest'}
                      </div>
                      <div className="text-[11px] text-muted flex items-center gap-1">
                        <LiveDot color="mint" />
                        <span>In sync</span>
                      </div>
                    </div>
                  </div>
                  {idx === 0 && (
                    <span className="px-2 py-0.5 rounded-md bg-accent-soft border border-accent/25 text-[10px] font-medium text-accent">
                      Host
                    </span>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => setInviteOpen(true)}
                className="w-full mt-2 p-3 rounded-xl border border-dashed border-line-strong hover:border-accent/50 text-xs text-ink-soft hover:text-accent flex items-center justify-center gap-2 transition-colors"
              >
                <UserPlus size={14} /> Invite another friend
              </button>
            </div>
          )}
        </div>
      </div>

      <InviteModal
        open={inviteOpen}
        roomId={roomId}
        roomTitle={roomTitle}
        onClose={() => setInviteOpen(false)}
      />
    </div>
  )
}
