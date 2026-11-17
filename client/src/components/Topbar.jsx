import React, { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Bell, Menu, Moon, Radio, Search, Sun } from 'lucide-react'
import { Avatar, LiveDot, ProgressBar } from './ui'
import { useAuth } from '../context/AuthContext'
import { useSocketContext } from '../context/SocketContext'
import { useTheme } from '../context/ThemeContext'
import { useTransfers } from '../context/TransfersContext'
import { useRecentRooms } from '../hooks/useRecentRooms'

function getPageTitle(pathname) {
  if (pathname === '/') return 'Tonight'
  if (pathname.startsWith('/rooms')) return 'Watch Rooms'
  if (pathname.startsWith('/party/')) {
    const code = pathname.split('/party/')[1]?.slice(0, 6)
    return code ? `Room · ${code}` : 'Watch Room'
  }
  if (pathname.startsWith('/files')) return 'Files, Direct'
  if (pathname.startsWith('/messages')) return 'Quiet Signals'
  if (pathname.startsWith('/leaderboard')) return 'Leaderboard'
  if (pathname.startsWith('/profile') || pathname.startsWith('/u/')) return 'Profile'
  if (pathname.startsWith('/settings')) return 'Settings'
  return 'Beacon'
}

export function Topbar({ onOpenPalette, onOpenMobileNav }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { connected } = useSocketContext()
  const { mode, toggleTheme } = useTheme()
  const transfers = useTransfers()
  const { rooms } = useRecentRooms()
  const [showActivity, setShowActivity] = useState(false)

  const pageTitle = getPageTitle(pathname)
  const activityCount = (transfers?.active ? 1 : 0) + Math.min(rooms.length, 3)

  return (
    <header className="sticky top-0 z-20 h-[60px] px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-3 border-b border-line bg-app/75 backdrop-blur-xl">
      <div className="flex items-center gap-3 min-w-0">
        {onOpenMobileNav && (
          <button
            type="button"
            onClick={onOpenMobileNav}
            className="md:hidden icon-btn"
            aria-label="Open menu"
          >
            <Menu className="w-4 h-4" />
          </button>
        )}
        <div className="flex items-center gap-2 text-xs text-muted min-w-0">
          <Link to="/" className="hidden sm:inline text-ink-soft hover:text-ink transition-colors">
            Beacon
          </Link>
          <span className="hidden sm:inline text-faint">/</span>
          <span className="text-ink font-medium truncate">{pageTitle}</span>
        </div>
      </div>

      {/* Search / command trigger */}
      <button
        type="button"
        onClick={onOpenPalette}
        className="hidden md:flex items-center gap-3 w-full max-w-md px-3 py-1.5 rounded-xl bg-panel border border-line hover:border-line-strong text-xs text-muted transition-colors"
      >
        <Search className="w-3.5 h-3.5 text-muted" />
        <span className="flex-1 text-left truncate">
          Jump to a room, person, or action…
        </span>
        <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-panel-2 border border-line text-muted">
          ⌘K
        </kbd>
      </button>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onOpenPalette}
          className="md:hidden icon-btn"
          aria-label="Search"
        >
          <Search className="w-4 h-4" />
        </button>

        {/* P2P status pill */}
        <div
          className="hidden sm:inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-panel border border-line text-[11px] text-ink-soft"
          title={connected ? 'Peer-to-peer signaling ready' : 'Reconnecting signaling…'}
        >
          <LiveDot color={connected ? 'mint' : 'amber'} />
          <span>{connected ? 'Direct' : 'Syncing'}</span>
        </div>

        {/* Theme toggle */}
        <button
          type="button"
          onClick={toggleTheme}
          className="icon-btn"
          title={`Switch to ${mode === 'dark' ? 'light' : 'dark'} theme`}
          aria-label="Toggle theme"
        >
          {mode === 'dark' ? (
            <Sun className="w-4 h-4" />
          ) : (
            <Moon className="w-4 h-4" />
          )}
        </button>

        {/* Activity popover */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowActivity((s) => !s)}
            className="icon-btn relative"
            aria-label="Activity"
          >
            <Bell className="w-4 h-4" />
            {activityCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-accent" />
            )}
          </button>

          {showActivity && (
            <>
              <div
                className="fixed inset-0 z-20"
                onClick={() => setShowActivity(false)}
              />
              <div className="absolute right-0 mt-2 w-80 rounded-2xl bg-panel border border-line-strong shadow-2xl p-3 z-30 animate-[pop-in_0.16s_ease-out]">
                <div className="flex items-center justify-between px-1 pb-2 border-b border-line">
                  <span className="text-xs font-medium text-ink">Happening now</span>
                  <span className="text-[11px] text-muted">Live</span>
                </div>
                <div className="divide-y divide-line max-h-72 overflow-y-auto">
                  {transfers?.active && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowActivity(false)
                        navigate('/files')
                      }}
                      className="w-full py-2.5 px-1 text-left hover:bg-panel-2/60 rounded-lg transition-colors"
                    >
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-ink font-medium truncate">
                          {transfers.mode === 'sharing' ? 'Sending' : 'Receiving'} ·{' '}
                          {transfers.shareCode}
                        </span>
                        <span className="text-accent font-mono text-[11px]">
                          {transfers.overallPercent}%
                        </span>
                      </div>
                      <ProgressBar value={transfers.overallPercent} tone="accent" />
                    </button>
                  )}

                  {rooms.slice(0, 3).map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => {
                        setShowActivity(false)
                        navigate(`/party/${r.id}`)
                      }}
                      className="w-full py-2.5 px-1 text-left flex items-center gap-2.5 hover:bg-panel-2/60 rounded-lg transition-colors"
                    >
                      <div className="w-8 h-8 rounded-lg bg-accent-soft border border-accent/25 flex items-center justify-center text-accent shrink-0">
                        <Radio className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium text-ink truncate">
                          {r.title || `Room ${r.id}`}
                        </div>
                        <div className="text-[11px] text-muted truncate">
                          Code · <span className="font-mono">{r.id}</span>
                        </div>
                      </div>
                      <span className="text-[11px] text-accent font-medium">Join</span>
                    </button>
                  ))}

                  {!transfers?.active && rooms.length === 0 && (
                    <div className="py-6 text-center text-xs text-muted">
                      Quiet right now — start a watch room or drop a file.
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        <Link
          to={user?.isGuest ? '/settings' : '/profile'}
          className="pl-1 flex items-center"
          title={user?.username || 'Account'}
        >
          <Avatar name={user?.username || 'Guest'} size="sm" status="online" />
        </Link>
      </div>
    </header>
  )
}
export default Topbar
