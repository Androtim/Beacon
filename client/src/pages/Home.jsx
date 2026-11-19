import React, { useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  ArrowUpRight,
  ExternalLink,
  FolderUp,
  Lock,
  MessageSquare,
  Radio,
  Tv,
  Upload,
} from 'lucide-react'
import Launcher from '../components/Launcher'
import { RoomCard } from '../components/RoomCard'
import { ProgressBar } from '../components/ui'
import CreateRoomModal from '../components/CreateRoomModal'
import { useAuth } from '../context/AuthContext'
import { useTransfers } from '../context/TransfersContext'
import { useRecentRooms, recordRoom } from '../hooks/useRecentRooms'
import { useToast } from '../context/ToastContext'

export default function Home() {
  const { user } = useAuth()
  const transfers = useTransfers()
  const { rooms: recentRooms, remove: removeRoom } = useRecentRooms()
  const { notify } = useToast()
  const navigate = useNavigate()
  const fileInputRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)

  const greeting = useMemo(() => {
    const h = new Date().getHours()
    if (h < 5) return 'Good night'
    if (h < 12) return 'Good morning'
    if (h < 18) return 'Good afternoon'
    return 'Good evening'
  }, [])

  const handleOpenRoom = (room) => {
    recordRoom(room.id, {
      title: room.title,
      contents: room.contents,
      url: room.url,
    })
    navigate(`/party/${room.id}`, {
      state: { roomTitle: room.title },
    })
  }

  const handleQuickFiles = (files) => {
    const list = Array.from(files || [])
    if (!list.length) return
    transfers.createShare(list)
    notify(`Preparing "${list[0].name}"`, 'Generating 8-character transfer code…', 'accent')
    navigate('/files')
  }

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-8 sm:py-12 max-w-4xl mx-auto space-y-10">
      {/* Centered command header */}
      <section className="space-y-5">
        <div className="space-y-1.5">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-[-0.03em] text-ink">
            {greeting},{' '}
            <span className="text-muted font-normal">{user?.username || 'friend'}</span>
          </h1>
          <p className="text-sm text-muted">
            Start a synchronized watch party, send files peer-to-peer, or jump into a room by code.
          </p>
        </div>

        {/* Single unified command bar */}
        <Launcher variant="hero" />
      </section>

      {/* Active transfer banner (only when transferring) */}
      {transfers?.active && (
        <section>
          <Link
            to="/files"
            className="panel p-4 flex items-center gap-4 hover:border-line-strong transition-colors"
          >
            <div className="w-9 h-9 rounded-lg bg-accent-soft text-accent flex items-center justify-center shrink-0">
              <FolderUp className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-ink truncate">
                  {transfers.mode === 'sharing' ? 'Sending files' : 'Receiving files'} ·{' '}
                  <span className="font-mono text-muted">{transfers.shareCode}</span>
                </span>
                <span className="font-mono text-accent">{transfers.overallPercent}%</span>
              </div>
              <ProgressBar value={transfers.overallPercent} tone="accent" />
            </div>
            <ArrowUpRight className="w-4 h-4 text-muted shrink-0" />
          </Link>
        </section>
      )}

      {/* Three direct workspace actions */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Configure a watch party */}
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="panel p-4 text-left hover:border-line-strong hover:bg-panel-2/40 transition-colors group flex flex-col justify-between min-h-[128px]"
        >
          <div className="flex items-center justify-between">
            <div className="w-8 h-8 rounded-lg bg-panel-2 border border-line flex items-center justify-center text-accent">
              <Tv className="w-4 h-4" />
            </div>
            <ArrowUpRight className="w-3.5 h-3.5 text-faint group-hover:text-ink transition-colors" />
          </div>
          <div className="mt-4">
            <div className="text-[13px] font-medium text-ink">Watch party</div>
            <p className="text-xs text-muted mt-0.5 leading-relaxed">
              Name a room and sync a URL or local video file.
            </p>
          </div>
        </button>

        {/* Direct file dropzone */}
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
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
          className={`panel p-4 text-left cursor-pointer transition-colors group flex flex-col justify-between min-h-[128px] ${
            dragging
              ? 'border-accent bg-accent-soft'
              : 'hover:border-line-strong hover:bg-panel-2/40'
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
          <div className="flex items-center justify-between">
            <div className="w-8 h-8 rounded-lg bg-panel-2 border border-line flex items-center justify-center text-accent">
              <Upload className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-mono text-faint">P2P</span>
          </div>
          <div className="mt-4">
            <div className="text-[13px] font-medium text-ink">
              {dragging ? 'Drop to share' : 'Drop files to share'}
            </div>
            <p className="text-xs text-muted mt-0.5 leading-relaxed">
              Direct browser-to-browser transfer with no size cap.
            </p>
          </div>
        </div>

        {/* Encrypted messages */}
        <Link
          to={user?.isGuest ? '/login' : '/messages'}
          className="panel p-4 text-left hover:border-line-strong hover:bg-panel-2/40 transition-colors group flex flex-col justify-between min-h-[128px]"
        >
          <div className="flex items-center justify-between">
            <div className="w-8 h-8 rounded-lg bg-panel-2 border border-line flex items-center justify-center text-mint">
              <MessageSquare className="w-4 h-4" />
            </div>
            <Lock className="w-3.5 h-3.5 text-faint group-hover:text-mint transition-colors" />
          </div>
          <div className="mt-4">
            <div className="text-[13px] font-medium text-ink">
              {user?.isGuest ? 'Sign in for messages' : 'Messages'}
            </div>
            <p className="text-xs text-muted mt-0.5 leading-relaxed">
              End-to-end encrypted direct & group conversations.
            </p>
          </div>
        </Link>
      </section>

      {/* Recent rooms (real rooms only) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-medium text-muted">Recent rooms</h2>
          {recentRooms.length > 0 && (
            <Link
              to="/rooms"
              className="text-xs text-muted hover:text-ink inline-flex items-center gap-1 transition-colors"
            >
              View all
              <ArrowRight className="w-3 h-3" />
            </Link>
          )}
        </div>

        {recentRooms.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {recentRooms.slice(0, 4).map((r) => (
              <RoomCard
                key={r.id}
                room={r}
                onOpen={handleOpenRoom}
                onRemove={removeRoom}
              />
            ))}
          </div>
        ) : (
          <div className="panel p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-panel-2 border border-line flex items-center justify-center text-faint shrink-0">
                <Radio className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-medium text-ink">No recent rooms</div>
                <p className="text-xs text-muted mt-0.5">
                  Rooms you create or join appear here for quick re-entry.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="btn btn-secondary h-8 px-3 text-xs shrink-0"
            >
              Create room
            </button>
          </div>
        )}
      </section>

      {/* Minimal footer */}
      <footer
        className="flex items-center justify-between pt-4 border-t border-line text-[11px] text-faint"
        data-testid="home-footer"
      >
        <span>Beacon · Direct P2P watch parties & transfers</span>
        <div className="flex items-center gap-4">
          <a
            href="https://flexarion.alwaysdata.net/"
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-1 hover:text-ink transition-colors"
          >
            Flexarion
            <ExternalLink className="w-3 h-3" />
          </a>
          <a
            href="https://github.com/Androtim/Beacon"
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-1 hover:text-ink transition-colors"
          >
            GitHub
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </footer>

      <CreateRoomModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  )
}
