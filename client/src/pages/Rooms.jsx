import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { KeyRound, Plus, Radio, Search } from 'lucide-react'
import { useRecentRooms, recordRoom } from '../hooks/useRecentRooms'
import { RoomCard } from '../components/RoomCard'
import CreateRoomModal from '../components/CreateRoomModal'
import JoinRoomModal from '../components/JoinRoomModal'

export default function Rooms() {
  const navigate = useNavigate()
  const { rooms: recentRooms, remove: removeRoom } = useRecentRooms()
  const [q, setQ] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [joinOpen, setJoinOpen] = useState(false)

  const filtered = useMemo(() => {
    if (!q.trim()) return recentRooms
    const s = q.toLowerCase()
    return recentRooms.filter(
      (r) =>
        (r.title && r.title.toLowerCase().includes(s)) ||
        (r.contents && r.contents.toLowerCase().includes(s)) ||
        (r.id && r.id.toLowerCase().includes(s))
    )
  }, [recentRooms, q])

  const openRoom = (room) => {
    recordRoom(room.id, {
      title: room.title,
      contents: room.contents,
      url: room.url,
    })
    navigate(`/party/${room.id}`, {
      state: { roomTitle: room.title },
    })
  }

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-[-0.025em] text-ink">Rooms</h1>
          <p className="text-xs text-muted mt-0.5">
            Invite-only watch rooms you’ve created or visited recently.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setJoinOpen(true)}
            className="btn btn-secondary h-9 px-3 text-xs"
          >
            <KeyRound className="w-3.5 h-3.5 text-muted" />
            Join by code
          </button>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="btn btn-primary h-9 px-3.5 text-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            New room
          </button>
        </div>
      </div>

      {/* Search bar (when rooms exist) */}
      {recentRooms.length > 0 && (
        <div className="relative max-w-sm">
          <Search className="w-3.5 h-3.5 text-faint absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter by title or code…"
            className="input-field h-9 pl-9 text-xs"
          />
        </div>
      )}

      {/* Room grid or clean empty state */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((room) => (
            <RoomCard
              key={room.id}
              room={room}
              onOpen={openRoom}
              onRemove={removeRoom}
            />
          ))}
        </div>
      ) : (
        <div className="panel p-10 text-center space-y-3">
          <div className="w-10 h-10 rounded-xl bg-panel-2 border border-line text-muted flex items-center justify-center mx-auto">
            <Radio className="w-4 h-4" />
          </div>
          <div className="space-y-1">
            <div className="text-sm font-medium text-ink">
              {q.trim() ? 'No matching rooms' : 'No rooms yet'}
            </div>
            <p className="text-xs text-muted max-w-xs mx-auto">
              {q.trim()
                ? `No rooms matched "${q}".`
                : 'Create a private watch room or enter a 6-character code from a friend.'}
            </p>
          </div>
          {!q.trim() && (
            <div className="pt-1 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setJoinOpen(true)}
                className="btn btn-secondary h-8 px-3 text-xs"
              >
                Join by code
              </button>
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="btn btn-primary h-8 px-3 text-xs"
              >
                New room
              </button>
            </div>
          )}
        </div>
      )}

      <CreateRoomModal open={createOpen} onClose={() => setCreateOpen(false)} />
      <JoinRoomModal open={joinOpen} onClose={() => setJoinOpen(false)} />
    </div>
  )
}
