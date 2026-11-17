import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  Compass,
  KeyRound,
  LayoutGrid,
  List,
  Lock,
  Plus,
  Search,
  Sparkles,
  Volume2,
} from 'lucide-react'
import { useRecentRooms, recordRoom } from '../hooks/useRecentRooms'
import { RoomCard } from '../components/RoomCard'
import { AvatarStack, LiveDot } from '../components/ui'
import CreateRoomModal from '../components/CreateRoomModal'
import JoinRoomModal from '../components/JoinRoomModal'

const CURATED_TEMPLATES = [
  {
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
  },
  {
    id: 'NEON44',
    code: 'NEON44',
    title: 'Dailies & Rough Cuts',
    contents: 'Short_Film_Cut_v04_ColorPass.mp4',
    image: '/images/room-neon.jpg',
    gradient: 'clay',
    status: 'paused',
    voiceActive: true,
    positionSec: 410,
    durationSec: 1120,
    members: [
      { id: '4', name: 'Jules' },
      { id: '5', name: 'Noor' },
    ],
  },
  {
    id: 'DUNE19',
    code: 'DUNE19',
    title: 'Sunday Ambient Sessions',
    contents: 'Brian Eno — Apollo Live Archive',
    image: '/images/hero-dunes.jpg',
    gradient: 'forest',
    status: 'playing',
    voiceActive: false,
    positionSec: 1200,
    durationSec: 3600,
    members: [{ id: '6', name: 'Aiko' }],
  },
]

export default function Rooms() {
  const navigate = useNavigate()
  const { rooms: recentRooms, remove: removeRoom } = useRecentRooms()
  const [filter, setFilter] = useState('all') // 'all' | 'yours' | 'recent'
  const [view, setView] = useState('grid') // 'grid' | 'list'
  const [q, setQ] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [joinOpen, setJoinOpen] = useState(false)

  const combinedRooms = useMemo(() => {
    const recentIds = new Set(recentRooms.map((r) => r.id))
    const templates = CURATED_TEMPLATES.filter((t) => !recentIds.has(t.id))
    return [...recentRooms, ...templates]
  }, [recentRooms])

  const filtered = useMemo(() => {
    return combinedRooms.filter((r) => {
      if (filter === 'yours' && !r.isYours) return false
      if (filter === 'recent' && !recentRooms.some((rr) => rr.id === r.id)) return false
      if (q.trim()) {
        const s = q.toLowerCase()
        return (
          (r.title && r.title.toLowerCase().includes(s)) ||
          (r.contents && r.contents.toLowerCase().includes(s)) ||
          (r.id && r.id.toLowerCase().includes(s))
        )
      }
      return true
    })
  }, [combinedRooms, recentRooms, filter, q])

  const openRoom = (room) => {
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

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-6 sm:py-8 max-w-[1400px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-2 border-b border-line">
        <div>
          <div className="eyebrow flex items-center gap-2 mb-1.5">
            <Compass className="w-3.5 h-3.5 text-accent" />
            Watch rooms
          </div>
          <h1 className="font-serif text-2xl sm:text-4xl text-ink tracking-tight">
            Small rooms for shared screens.
          </h1>
          <p className="text-sm text-ink-soft mt-1 max-w-xl">
            Every room on Beacon is invite-only. You only see the rooms you’ve created,
            stepped into recently, or been invited to.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setJoinOpen(true)}
            className="btn btn-secondary text-xs inline-flex items-center gap-1.5"
          >
            <KeyRound className="w-3.5 h-3.5 text-accent" />
            Enter a code
          </button>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="btn btn-primary text-xs inline-flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            Light a room
          </button>
        </div>
      </div>

      {/* Filter & search bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="inline-flex items-center p-1 rounded-xl bg-panel border border-line self-start">
          {[
            { id: 'all', label: 'Everything', count: combinedRooms.length },
            {
              id: 'recent',
              label: 'Recent',
              count: recentRooms.length,
            },
            {
              id: 'yours',
              label: 'Hosted by you',
              count: combinedRooms.filter((r) => r.isYours).length,
            },
          ].map((t) => {
            const active = filter === t.id
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setFilter(t.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                  active ? 'bg-panel-3 text-ink shadow-sm' : 'text-muted hover:text-ink'
                }`}
              >
                {t.label}
                <span
                  className={`text-[10px] font-mono ${
                    active ? 'text-accent' : 'text-muted'
                  }`}
                >
                  {t.count}
                </span>
              </button>
            )
          })}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-3.5 h-3.5 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Filter by title, film, or code…"
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-panel border border-line text-xs text-ink placeholder:text-muted focus:outline-none focus:border-accent/60"
            />
          </div>
          <div className="inline-flex p-1 rounded-xl bg-panel border border-line">
            <button
              type="button"
              onClick={() => setView('grid')}
              className={`p-1.5 rounded-lg ${
                view === 'grid' ? 'bg-panel-3 text-ink' : 'text-muted hover:text-ink'
              }`}
              aria-label="Grid view"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setView('list')}
              className={`p-1.5 rounded-lg ${
                view === 'list' ? 'bg-panel-3 text-ink' : 'text-muted hover:text-ink'
              }`}
              aria-label="List view"
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Rooms display */}
      {filtered.length === 0 ? (
        <div className="panel p-12 text-center space-y-3">
          <div className="w-11 h-11 rounded-2xl bg-accent-soft border border-accent/25 text-accent flex items-center justify-center mx-auto">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="font-serif text-xl text-ink">No rooms match that filter</div>
          <p className="text-xs text-muted max-w-sm mx-auto">
            Start a new room of your own or ask a friend for their 6-character invite code.
          </p>
          <div className="pt-1 flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="btn btn-primary text-xs"
            >
              Light a new room
            </button>
            <button
              type="button"
              onClick={() => {
                setFilter('all')
                setQ('')
              }}
              className="btn btn-ghost text-xs"
            >
              Reset filter
            </button>
          </div>
        </div>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((room) => (
            <RoomCard
              key={room.id}
              room={room}
              onOpen={openRoom}
              onRemove={
                recentRooms.some((rr) => rr.id === room.id) ? removeRoom : undefined
              }
            />
          ))}

          {/* Always-available create tile */}
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="panel-soft border-dashed hover:border-accent/50 p-6 flex flex-col items-center justify-center text-center min-h-[240px] group transition-colors"
          >
            <div className="w-11 h-11 rounded-2xl bg-panel border border-line-strong group-hover:border-accent/50 group-hover:bg-accent-soft flex items-center justify-center text-muted group-hover:text-accent transition-colors mb-3">
              <Plus className="w-5 h-5" />
            </div>
            <div className="font-serif text-lg text-ink">Make room for something</div>
            <p className="text-xs text-muted max-w-[230px] mt-1">
              Bring a link, drop a file from your computer, or just hang out on voice.
            </p>
          </button>
        </div>
      ) : (
        <div className="panel divide-y divide-line overflow-hidden">
          {filtered.map((room) => (
            <button
              key={room.id}
              type="button"
              onClick={() => openRoom(room)}
              className="w-full p-4 flex items-center gap-4 hover:bg-panel-2/60 text-left transition-colors group"
            >
              <div className="w-24 aspect-video rounded-lg overflow-hidden bg-panel-2 shrink-0 relative border border-line">
                {room.image ? (
                  <img src={room.image} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-accent/30 to-panel-3" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-serif text-base text-ink group-hover:text-accent transition-colors truncate">
                    {room.title || `Room ${room.id}`}
                  </span>
                  {room.status !== 'idle' && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-mint">
                      <LiveDot color={room.status === 'paused' ? 'amber' : 'mint'} />
                      {room.status === 'paused' ? 'Paused' : 'In sync'}
                    </span>
                  )}
                  {room.voiceActive && <Volume2 className="w-3.5 h-3.5 text-accent" />}
                </div>
                <div className="text-xs text-muted truncate mt-0.5">
                  {room.contents || 'Direct watch party'}
                </div>
              </div>
              {Array.isArray(room.members) && room.members.length > 0 && (
                <div className="hidden sm:flex items-center gap-3">
                  <AvatarStack people={room.members} size="xs" max={4} />
                </div>
              )}
              <span className="hidden md:inline-flex items-center gap-1 px-2 py-1 rounded-md bg-panel-2 border border-line font-mono text-[11px] text-muted">
                <Lock className="w-2.5 h-2.5" /> {room.id}
              </span>
              <ArrowRight className="w-4 h-4 text-muted group-hover:text-accent group-hover:translate-x-0.5 transition-all" />
            </button>
          ))}
        </div>
      )}

      {/* Bottom invite explainer */}
      <div className="panel-soft p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-accent-soft border border-accent/25 flex items-center justify-center text-accent shrink-0">
            <KeyRound className="w-4 h-4" />
          </div>
          <div>
            <div className="text-sm font-medium text-ink">
              Waiting on a friend’s room?
            </div>
            <p className="text-xs text-muted mt-0.5">
              Every room has a 6-character code in the top bar. Paste it to jump straight to their current frame.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setJoinOpen(true)}
          className="btn btn-secondary text-xs shrink-0 self-start sm:self-center"
        >
          Join with code
        </button>
      </div>

      <CreateRoomModal open={createOpen} onClose={() => setCreateOpen(false)} />
      <JoinRoomModal open={joinOpen} onClose={() => setJoinOpen(false)} />
    </div>
  )
}
