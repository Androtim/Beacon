import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  Compass,
  FolderUp,
  Home,
  KeyRound,
  MessageSquare,
  Plus,
  Radio,
  Search,
  Settings,
  Sun,
  Trophy,
  User,
} from 'lucide-react'
import { useRecentRooms } from '../hooks/useRecentRooms'
import { useTheme } from '../context/ThemeContext'

export function CommandPalette({ open, onClose, onCreateRoom, onJoinByCode }) {
  const navigate = useNavigate()
  const { rooms } = useRecentRooms()
  const { mode, toggleTheme } = useTheme()
  const [q, setQ] = useState('')
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    if (open) {
      setQ('')
      setIdx(0)
    }
  }, [open])

  const items = useMemo(() => {
    const list = [
      {
        id: 'act-create',
        group: 'Actions',
        label: 'Light a new watch room…',
        hint: 'Create',
        icon: Plus,
        run: () => {
          onClose?.()
          onCreateRoom?.()
        },
      },
      {
        id: 'act-join',
        group: 'Actions',
        label: 'Join with a room or file code…',
        hint: '6 or 8 chars',
        icon: KeyRound,
        run: () => {
          onClose?.()
          onJoinByCode?.()
        },
      },
      {
        id: 'act-send',
        group: 'Actions',
        label: 'Send a file peer-to-peer',
        hint: 'Direct transfer',
        icon: FolderUp,
        run: () => {
          onClose?.()
          navigate('/files')
        },
      },
      {
        id: 'act-theme',
        group: 'Actions',
        label: `Switch to ${mode === 'dark' ? 'Warm Daylight (light)' : 'Beacon Amber (dark)'} theme`,
        hint: 'Appearance',
        icon: Sun,
        run: () => {
          onClose?.()
          toggleTheme()
        },
      },
      {
        id: 'nav-home',
        group: 'Navigate',
        label: 'Go to Home',
        hint: 'H',
        icon: Home,
        run: () => {
          onClose?.()
          navigate('/')
        },
      },
      {
        id: 'nav-rooms',
        group: 'Navigate',
        label: 'Browse Rooms',
        hint: 'R',
        icon: Compass,
        run: () => {
          onClose?.()
          navigate('/rooms')
        },
      },
      {
        id: 'nav-files',
        group: 'Navigate',
        label: 'Open Files & Transfers',
        hint: 'F',
        icon: FolderUp,
        run: () => {
          onClose?.()
          navigate('/files')
        },
      },
      {
        id: 'nav-messages',
        group: 'Navigate',
        label: 'Open Messages',
        hint: 'M',
        icon: MessageSquare,
        run: () => {
          onClose?.()
          navigate('/messages')
        },
      },
      {
        id: 'nav-leaderboard',
        group: 'Navigate',
        label: 'Open Leaderboard',
        hint: 'L',
        icon: Trophy,
        run: () => {
          onClose?.()
          navigate('/leaderboard')
        },
      },
      {
        id: 'nav-profile',
        group: 'Navigate',
        label: 'Open Profile',
        hint: 'P',
        icon: User,
        run: () => {
          onClose?.()
          navigate('/profile')
        },
      },
      {
        id: 'nav-settings',
        group: 'Navigate',
        label: 'Open Settings & Appearance',
        hint: 'S',
        icon: Settings,
        run: () => {
          onClose?.()
          navigate('/settings')
        },
      },
      ...rooms.map((r) => ({
        id: `room-${r.id}`,
        group: 'Recent rooms',
        label: r.title || `Room ${r.id}`,
        hint: r.id,
        icon: Radio,
        run: () => {
          onClose?.()
          navigate(`/party/${r.id}`)
        },
      })),
    ]

    if (!q.trim()) return list
    const s = q.toLowerCase()
    return list.filter(
      (i) =>
        i.label.toLowerCase().includes(s) ||
        (i.hint && i.hint.toLowerCase().includes(s)) ||
        i.group.toLowerCase().includes(s)
    )
  }, [q, rooms, mode, navigate, onClose, onCreateRoom, onJoinByCode, toggleTheme])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') {
        onClose?.()
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setIdx((i) => Math.min(items.length - 1, i + 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setIdx((i) => Math.max(0, i - 1))
      } else if (e.key === 'Enter' && items[idx]) {
        e.preventDefault()
        items[idx].run()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, items, idx, onClose])

  if (!open) return null

  const groups = Array.from(new Set(items.map((i) => i.group)))

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[13vh] px-4"
      onClick={onClose}
    >
      <div className="fixed inset-0 bg-black/70 backdrop-blur-md" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg rounded-2xl bg-panel border border-line-strong shadow-2xl overflow-hidden animate-[pop-in_0.16s_ease-out]"
      >
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-line">
          <Search className="w-4 h-4 text-muted shrink-0" />
          <input
            type="text"
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setIdx(0)
            }}
            placeholder="Jump to a room, send a file, or run an action…"
            className="w-full bg-transparent text-sm text-ink placeholder:text-muted focus:outline-none"
            autoFocus
          />
          <kbd className="text-[10px] font-mono text-muted px-1.5 py-0.5 rounded bg-panel-2 border border-line">
            ESC
          </kbd>
        </div>

        <div className="max-h-[360px] overflow-y-auto p-2">
          {items.length === 0 && (
            <div className="py-10 text-center text-sm text-muted">
              Nothing matches "{q}".
            </div>
          )}
          {groups.map((g) => (
            <div key={g} className="mb-2 last:mb-0">
              <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted">
                {g}
              </div>
              {items
                .filter((i) => i.group === g)
                .map((it) => {
                  const flatIndex = items.indexOf(it)
                  const active = flatIndex === idx
                  const Icon = it.icon
                  return (
                    <button
                      key={it.id}
                      type="button"
                      onMouseEnter={() => setIdx(flatIndex)}
                      onClick={it.run}
                      className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-xl text-left text-sm transition-colors ${
                        active ? 'bg-accent-soft text-ink' : 'text-ink-soft hover:bg-panel-2'
                      }`}
                    >
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center border ${
                          active
                            ? 'bg-accent text-accent-ink border-accent'
                            : 'bg-panel-2 border-line text-muted'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <span className="flex-1 truncate">{it.label}</span>
                      {it.hint && (
                        <span className="text-[11px] font-mono text-muted">{it.hint}</span>
                      )}
                      <ArrowRight
                        className={`w-3.5 h-3.5 transition-opacity ${
                          active ? 'opacity-100 text-accent' : 'opacity-0'
                        }`}
                      />
                    </button>
                  )
                })}
            </div>
          ))}
        </div>

        <div className="px-4 py-2.5 border-t border-line bg-panel-2/60 flex items-center justify-between text-[11px] text-muted">
          <div className="flex items-center gap-3">
            <span>↑↓ to move</span>
            <span>↵ to select</span>
          </div>
          <span className="font-mono">Beacon · Command</span>
        </div>
      </div>
    </div>
  )
}
export default CommandPalette
