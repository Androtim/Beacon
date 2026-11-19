import React, { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Bell, Menu, Moon, Radio, Search, Sun } from 'lucide-react'
import { LiveDot, ProgressBar } from './ui'
import { useSocketContext } from '../context/SocketContext'
import { useTheme } from '../context/ThemeContext'
import { useTransfers } from '../context/TransfersContext'
import { useRecentRooms } from '../hooks/useRecentRooms'

function getPageTitle(pathname) {
  if (pathname === '/') return 'Home'
  if (pathname.startsWith('/rooms')) return 'Rooms'
  if (pathname.startsWith('/party/')) {
    const code = pathname.split('/party/')[1]?.slice(0, 6)
    return code ? `Room ${code}` : 'Watch Party'
  }
  if (pathname.startsWith('/files')) return 'File Transfer'
  if (pathname.startsWith('/messages')) return 'Messages'
  if (pathname.startsWith('/leaderboard')) return 'Leaderboard'
  if (pathname.startsWith('/profile') || pathname.startsWith('/u/')) return 'Profile'
  if (pathname.startsWith('/settings')) return 'Settings'
  return 'Beacon'
}

export function Topbar({ onOpenPalette, onOpenMobileNav }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { connected } = useSocketContext()
  const { mode, toggleTheme } = useTheme()
  const transfers = useTransfers()
  const { rooms } = useRecentRooms()
  const [showActivity, setShowActivity] = useState(false)

  const pageTitle = getPageTitle(pathname)
  const activityCount = (transfers?.active ? 1 : 0) + Math.min(rooms.length, 3)

  return (
    <header className="sticky top-0 z-20 h-12 px-4 sm:px-6 flex items-center justify-between gap-3 border-b border-line bg-app/85 backdrop-blur-md">
      <div className="flex items-center gap-2.5 min-w-0">
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
        <span className="text-[13px] font-medium text-ink truncate">
          {pageTitle}
        </span>
      </div>

      {/* Compact command palette trigger */}
      <button
        type="button"
        onClick={onOpenPalette}
        className="hidden md:flex items-center gap-2.5 w-full max-w-xs h-8 px-2.5 rounded-lg bg-panel border border-line hover:border-line-strong text-xs text-muted transition-colors"
      >
        <Search className="w-3.5 h-3.5 text-faint" />
        <span className="flex-1 text-left truncate">Search or jump…</span>
        <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-panel-2 border border-line text-faint">
          ⌘K
        </kbd>
      </button>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onOpenPalette}
          className="md:hidden icon-btn"
          aria-label="Search"
        >
          <Search className="w-4 h-4" />
        </button>

        {/* Minimal connection status */}
        <div
          className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] text-muted"
          title={connected ? 'Peer-to-peer signaling ready' : 'Reconnecting…'}
        >
          <LiveDot color={connected ? 'mint' : 'amber'} />
          <span>{connected ? 'Live' : 'Syncing'}</span>
        </div>

        {/* Theme toggle */}
        <button
          type="button"
          onClick={toggleTheme}
          className="icon-btn"
          title={`Switch to ${mode === 'dark' ? 'light' : 'dark'} theme`}
          aria-label="Toggle theme"
        >
          {mode === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
        </button>

        {/* Activity popover */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowActivity((s) => !s)}
            className="icon-btn relative"
            aria-label="Activity"
          >
            <Bell className="w-3.5 h-3.5" />
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
              <div className="absolute right-0 mt-1.5 w-72 rounded-xl bg-panel border border-line-strong shadow-2xl p-2.5 z-30">
                <div className="flex items-center justify-between px-1.5 pb-2 border-b border-line">
                  <span className="text-xs font-medium text-ink">Active</span>
                  <span className="text-[11px] text-faint">
                    {activityCount > 0 ? `${activityCount}` : 'Idle'}
                  </span>
                </div>
                <div className="divide-y divide-line max-h-64 overflow-y-auto">
                  {transfers?.active && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowActivity(false)
                        navigate('/files')
                      }}
                      className="w-full py-2 px-1.5 text-left hover:bg-panel-2 rounded-lg transition-colors"
                    >
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-ink font-medium truncate">
                          {transfers.mode === 'sharing' ? 'Sending' : 'Receiving'} ·{' '}
                          <span className="font-mono">{transfers.shareCode}</span>
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
                      className="w-full py-2 px-1.5 text-left flex items-center gap-2.5 hover:bg-panel-2 rounded-lg transition-colors"
                    >
                      <Radio className="w-3.5 h-3.5 text-accent shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium text-ink truncate">
                          {r.title || `Room ${r.id}`}
                        </div>
                        <div className="text-[11px] text-faint font-mono">{r.id}</div>
                      </div>
                    </button>
                  ))}

                  {!transfers?.active && rooms.length === 0 && (
                    <div className="py-6 text-center text-xs text-muted">
                      No active rooms or transfers.
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

export default Topbar
