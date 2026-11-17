import React, { useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  ArrowUpRight,
  Film,
  FolderUp,
  KeyRound,
  Lock,
  Play,
  Plus,
  Radio,
  ShieldCheck,
  Sparkles,
  Upload,
} from 'lucide-react'
import Launcher from '../components/Launcher'
import { RoomCard } from '../components/RoomCard'
import { AvatarStack, LiveDot, ProgressBar } from '../components/ui'
import CreateRoomModal from '../components/CreateRoomModal'
import JoinRoomModal from '../components/JoinRoomModal'
import { useAuth } from '../context/AuthContext'
import { useTransfers } from '../context/TransfersContext'
import { useRecentRooms, recordRoom } from '../hooks/useRecentRooms'
import { useToast } from '../context/ToastContext'

const FEATURED_ROOM = {
  id: 'WAVE82',
  code: 'WAVE82',
  title: 'Late-night Cinema · Criterion Picks',
  contents: 'Wings of Desire (1987) · 4K Remaster',
  image: '/images/room-lighthouse.jpg',
  gradient: 'noir',
  status: 'playing',
  voiceActive: true,
  positionSec: 2540,
  durationSec: 7680,
  members: [
    { id: '1', name: 'Clara' },
    { id: '2', name: 'Mateo' },
    { id: '3', name: 'Soren' },
  ],
}

export default function Home() {
  const { user } = useAuth()
  const transfers = useTransfers()
  const { rooms: recentRooms, remove: removeRoom } = useRecentRooms()
  const { notify } = useToast()
  const navigate = useNavigate()
  const fileInputRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [joinOpen, setJoinOpen] = useState(false)

  const greeting = useMemo(() => {
    const h = new Date().getHours()
    if (h < 5) return 'Still up'
    if (h < 12) return 'Good morning'
    if (h < 18) return 'Good afternoon'
    return 'Good evening'
  }, [])

  const todayLabel = useMemo(() => {
    try {
      return new Intl.DateTimeFormat('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
      }).format(new Date())
    } catch {
      return 'Tonight'
    }
  }, [])

  const spotlightRoom = recentRooms[0] || FEATURED_ROOM

  const handleOpenRoom = (room) => {
    recordRoom(room.id, {
      title: room.title,
      contents: room.contents,
      image: room.image,
      gradient: room.gradient,
    })
    navigate(`/party/${room.id}`, {
      state: { roomTitle: room.title },
    })
  }

  const handleQuickFiles = (files) => {
    const list = Array.from(files || [])
    if (!list.length) return
    transfers.createShare(list)
    notify(`Preparing "${list[0].name}"`, 'Generating 8-character share code…', 'accent')
    navigate('/files')
  }

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-6 sm:py-8 max-w-[1400px] mx-auto space-y-8">
      {/* Greeting header */}
      <section className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <div className="eyebrow flex items-center gap-2 mb-2">
            <span>{todayLabel}</span>
            <span className="text-faint">·</span>
            <span className="inline-flex items-center gap-1.5 text-mint normal-case tracking-normal font-medium">
              <LiveDot color="mint" />
              {recentRooms.length > 0
                ? `${recentRooms.length} room${recentRooms.length === 1 ? '' : 's'} in your logbook`
                : 'Ready to connect'}
            </span>
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl lg:text-[42px] text-ink leading-[1.08] tracking-tight">
            {greeting},{' '}
            <span className="italic font-normal text-accent">
              {user?.username || 'friend'}
            </span>
            .
          </h1>
          <p className="text-sm sm:text-base text-ink-soft mt-1.5 max-w-xl">
            Pull up a chair. Watch something in frame-accurate sync, hand a huge file
            across the room, or leave a quiet note.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setJoinOpen(true)}
            className="btn btn-secondary text-xs inline-flex items-center gap-2"
          >
            <KeyRound className="w-3.5 h-3.5 text-accent" />
            Join a room
          </button>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="btn btn-primary text-xs inline-flex items-center gap-2"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.25]" />
            Light a room
          </button>
        </div>
      </section>

      {/* Hero banner with Launcher + Continue Watching spotlight */}
      <section className="relative rounded-2xl overflow-hidden border border-line-strong shadow-2xl">
        <img
          src="/images/hero-dunes.jpg"
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-55"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(100deg, rgba(10,11,13,0.94) 0%, rgba(10,11,13,0.82) 52%, rgba(10,11,13,0.58) 100%), radial-gradient(80% 90% at 15% 10%, rgba(234,182,109,0.22), transparent 60%)',
          }}
        />
        <div className="relative p-6 sm:p-8 lg:p-10 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-7 space-y-5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-xs text-white/90">
              <Sparkles className="w-3.5 h-3.5 text-accent" />
              <span>No uploads · No public lobbies · Just your people</span>
            </div>

            <div className="space-y-2">
              <h2 className="font-serif text-2xl sm:text-4xl lg:text-[40px] text-white leading-[1.1] tracking-tight">
                Same frame.{' '}
                <span className="italic font-normal text-accent">Same feeling.</span>
              </h2>
              <p className="text-sm text-white/75 max-w-lg leading-relaxed">
                Start a watch party or file drop in one click, or paste a 6-character
                room code or 8-character file code below.
              </p>
            </div>

            {/* Unified Launcher (preserves all E2E data-testids) */}
            <div className="pt-1 max-w-xl">
              <Launcher variant="hero" />
            </div>
          </div>

          {/* Right: Spotlight room card */}
          <div className="lg:col-span-5">
            <div className="rounded-2xl bg-black/55 backdrop-blur-xl border border-white/15 p-4 sm:p-5 space-y-3.5 text-white shadow-2xl">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-mint">
                  <LiveDot color="mint" />
                  {recentRooms.length > 0 ? 'Continue watching' : 'Sample room · Tonight'}
                </span>
                <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-white/10 border border-white/10 text-white/80">
                  {spotlightRoom.id}
                </span>
              </div>

              <div>
                <div className="text-xs text-white/65 flex items-center gap-1.5 mb-0.5">
                  <Film className="w-3.5 h-3.5 text-accent" />
                  <span className="truncate">
                    {spotlightRoom.contents || spotlightRoom.url || 'Direct stream'}
                  </span>
                </div>
                <div className="font-serif text-xl text-white leading-snug">
                  {spotlightRoom.title || `Room ${spotlightRoom.id}`}
                </div>
              </div>

              <div className="space-y-1.5">
                <ProgressBar value={34} tone="accent" />
                <div className="flex items-center justify-between text-[11px] text-white/60 font-mono">
                  <span>Frame-synced playback</span>
                  <span>WebRTC + Socket</span>
                </div>
              </div>

              <div className="pt-1 flex items-center justify-between gap-3">
                {Array.isArray(spotlightRoom.members) && spotlightRoom.members.length > 0 ? (
                  <div className="flex items-center gap-2">
                    <AvatarStack people={spotlightRoom.members} size="xs" max={4} />
                    <span className="text-xs text-white/75">
                      {spotlightRoom.members.length} inside
                    </span>
                  </div>
                ) : (
                  <span className="text-xs text-white/75">Instant room access</span>
                )}

                <button
                  type="button"
                  onClick={() => handleOpenRoom(spotlightRoom)}
                  className="btn btn-primary text-xs py-2 px-3.5 inline-flex items-center gap-1.5"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  Step inside
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Two-column body: In your orbit + Direct Files & Quiet Signals */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 7 cols: In your orbit */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="eyebrow">In your orbit</div>
              <h2 className="font-serif text-xl sm:text-2xl text-ink mt-0.5">
                Rooms you can step right into
              </h2>
            </div>
            <Link
              to="/rooms"
              className="text-xs font-medium text-ink-soft hover:text-accent inline-flex items-center gap-1 transition-colors"
            >
              All rooms
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {recentRooms.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {recentRooms.slice(0, 4).map((r) => (
                <RoomCard
                  key={r.id}
                  room={r}
                  onOpen={handleOpenRoom}
                  onRemove={removeRoom}
                  compact
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <RoomCard room={FEATURED_ROOM} onOpen={handleOpenRoom} compact />
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="panel-soft border-dashed hover:border-accent/50 p-6 flex flex-col items-center justify-center text-center min-h-[210px] group transition-colors"
              >
                <div className="w-10 h-10 rounded-2xl bg-panel border border-line-strong group-hover:border-accent/50 group-hover:bg-accent-soft flex items-center justify-center text-muted group-hover:text-accent transition-colors mb-2.5">
                  <Plus className="w-5 h-5" />
                </div>
                <div className="font-serif text-lg text-ink">Start your first room</div>
                <p className="text-xs text-muted max-w-[220px] mt-1">
                  Paste a video URL or stream a file straight from your disk.
                </p>
              </button>
            </div>
          )}

          {/* Have a code strip */}
          <div className="panel-soft p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-accent-soft border border-accent/25 flex items-center justify-center text-accent shrink-0">
                <KeyRound className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-medium text-ink">
                  Have a room or transfer code from a friend?
                </div>
                <div className="text-[11px] text-muted">
                  Enter a 6-character watch code or 8-character file transfer code.
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setJoinOpen(true)}
              className="btn btn-secondary text-xs py-2 px-3 shrink-0"
            >
              Enter code
            </button>
          </div>
        </div>

        {/* Right 5 cols: Direct file handoff + Quiet Signals */}
        <div className="lg:col-span-5 space-y-4">
          {/* Direct file drop card */}
          <div className="panel p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="eyebrow">Files, direct</div>
                <h3 className="font-serif text-lg text-ink mt-0.5">
                  Hand a file across the room
                </h3>
              </div>
              <Link
                to="/files"
                className="text-xs text-ink-soft hover:text-accent inline-flex items-center gap-1 transition-colors"
              >
                Open transfer center
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div
              onDragOver={(e) => {
                e.preventDefault()
                setDragging(true)
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragging(false)
                if (e.dataTransfer.files?.length) handleQuickFiles(e.dataTransfer.files)
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`cursor-pointer rounded-xl border border-dashed p-5 text-center transition-all ${
                dragging
                  ? 'border-accent bg-accent-soft'
                  : 'border-line-strong bg-panel-2/70 hover:border-accent/50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.length) handleQuickFiles(e.target.files)
                  e.target.value = ''
                }}
              />
              <div className="w-10 h-10 rounded-xl bg-accent-soft border border-accent/25 text-accent flex items-center justify-center mx-auto mb-2.5">
                <Upload className="w-4 h-4" />
              </div>
              <div className="text-xs font-medium text-ink">
                Drop any file here, or{' '}
                <span className="text-accent underline underline-offset-2">browse</span>
              </div>
              <div className="text-[11px] text-muted mt-1">
                Streams browser-to-browser via WebRTC · Zero cloud storage limits
              </div>
            </div>

            {transfers?.active && (
              <Link
                to="/files"
                className="block p-3 rounded-xl bg-panel-2 border border-line hover:border-line-strong transition-colors"
              >
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-medium text-ink truncate">
                    {transfers.mode === 'sharing' ? 'Sending' : 'Receiving'} ·{' '}
                    <span className="font-mono">{transfers.shareCode}</span>
                  </span>
                  <span className="font-mono text-accent">{transfers.overallPercent}%</span>
                </div>
                <ProgressBar value={transfers.overallPercent} tone="accent" />
              </Link>
            )}
          </div>

          {/* Quiet Signals / Messages card */}
          <div className="panel p-5 space-y-3.5">
            <div className="flex items-center justify-between">
              <div>
                <div className="eyebrow">Quiet signals</div>
                <h3 className="font-serif text-lg text-ink mt-0.5">
                  End-to-end encrypted notes
                </h3>
              </div>
              <Link
                to={user?.isGuest ? '/login' : '/messages'}
                className="text-xs text-ink-soft hover:text-accent inline-flex items-center gap-1 transition-colors"
              >
                {user?.isGuest ? 'Sign in' : 'Open messages'}
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="p-3.5 rounded-xl bg-panel-2 border border-line flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-mint-soft border border-mint/25 text-mint flex items-center justify-center shrink-0 mt-0.5">
                <Lock className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium text-ink">
                  Sealed on your device before it leaves
                </div>
                <p className="text-[11px] text-muted leading-relaxed mt-0.5">
                  Direct messages and group notes use ECDH P-256 + AES-GCM encryption,
                  with instant watch-party cards and direct file attachments.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why Beacon 3-column strip */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
        {[
          {
            icon: Radio,
            title: 'Frame-locked playback',
            body: 'Play, pause, or scrub and everyone in the room snaps to your exact timestamp automatically.',
          },
          {
            icon: FolderUp,
            title: 'Nothing sits in the cloud',
            body: 'Local video files and transfers travel directly between browsers over encrypted WebRTC data channels.',
          },
          {
            icon: ShieldCheck,
            title: 'Private by default',
            body: 'No public room directories or algorithmic feeds. Rooms exist only for the people with the code.',
          },
        ].map((item, i) => {
          const Icon = item.icon
          return (
            <div key={i} className="panel-soft p-5 flex items-start gap-3.5">
              <div className="w-9 h-9 rounded-xl bg-accent-soft border border-accent/25 text-accent flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4" />
              </div>
              <div>
                <div className="font-serif text-base text-ink">{item.title}</div>
                <p className="text-xs text-muted leading-relaxed mt-1">{item.body}</p>
              </div>
            </div>
          )
        })}
      </section>

      <CreateRoomModal open={createOpen} onClose={() => setCreateOpen(false)} />
      <JoinRoomModal open={joinOpen} onClose={() => setJoinOpen(false)} />
    </div>
  )
}
