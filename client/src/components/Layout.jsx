import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation } from 'react-router-dom'
import {
  ArrowUpDown,
  Compass,
  FolderUp,
  Home,
  KeyRound,
  LogIn,
  LogOut,
  MessageSquare,
  PanelLeft,
  PanelLeftClose,
  Plus,
  Radio,
  Settings as SettingsIcon,
  ShieldCheck,
  Trophy,
  X,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useSocketContext } from '../context/SocketContext'
import { useTransfers } from '../context/TransfersContext'
import { useRecentRooms, prettySourceName } from '../hooks/useRecentRooms'
import Launcher from './Launcher'
import { BeaconMark, Wordmark } from './Logo'
import { Avatar, LiveDot } from './ui'
import Topbar from './Topbar'
import CommandPalette from './CommandPalette'
import CreateRoomModal from './CreateRoomModal'
import JoinRoomModal from './JoinRoomModal'

const COLLAPSE_KEY = 'beacon:rail-collapsed'

const SPACES = [
  { to: '/', label: 'Home', icon: Home, match: (p) => p === '/' },
  { to: '/rooms', label: 'Rooms', icon: Compass, match: (p) => p.startsWith('/rooms') },
  { to: '/files', label: 'Files', icon: FolderUp, match: (p) => p.startsWith('/files') },
  { to: '/messages', label: 'Messages', icon: MessageSquare, match: (p) => p.startsWith('/messages') },
  { to: '/leaderboard', label: 'Leaderboard', icon: Trophy, match: (p) => p.startsWith('/leaderboard') },
]

function renderLayoutContent({
  collapsed,
  setCollapsed,
  path,
  user,
  logout,
  connected,
  rooms,
  removeRoom,
  transfers,
  onOpenCreate,
  onOpenJoin,
  onNavigateDone,
}) {
  return (
    <>
      {/* Brand + collapse toggle */}
      <div
        className={`flex items-center ${
          collapsed ? 'justify-center px-2' : 'justify-between px-4'
        } h-[60px] border-b border-line`}
      >
        <Link
          to="/"
          onClick={onNavigateDone}
          className="flex items-center gap-2.5 min-w-0 group"
          title="Beacon — Home"
        >
          <BeaconMark size={30} />
          {!collapsed && (
            <div className="min-w-0 flex flex-col">
              <Wordmark className="text-lg leading-none" />
              <span className="text-[10px] text-muted tracking-wider uppercase mt-0.5">
                Watch · Share · Talk
              </span>
            </div>
          )}
        </Link>
        {!collapsed && setCollapsed && (
          <button
            onClick={() => setCollapsed(true)}
            className="text-muted hover:text-ink p-1.5 rounded-lg hover:bg-panel-2 transition-colors"
            title="Collapse sidebar"
            aria-label="Collapse sidebar"
            data-testid="rail-collapse"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        )}
      </div>
      {collapsed && setCollapsed && (
        <button
          onClick={() => setCollapsed(false)}
          className="mx-auto mt-2 text-muted hover:text-ink p-1.5 rounded-lg hover:bg-panel-2 transition-colors"
          title="Expand sidebar"
          aria-label="Expand sidebar"
          data-testid="rail-expand"
        >
          <PanelLeft className="w-4 h-4" />
        </button>
      )}

      {/* Launcher on non-home pages (keeps E2E launcher-rail contract) */}
      {path !== '/' && !collapsed && (
        <div className="p-3 border-b border-line">
          <Launcher variant="rail" />
        </div>
      )}

      {/* Quick modal triggers when on Home */}
      {path === '/' && !collapsed && (
        <div className="p-3 space-y-1.5 border-b border-line">
          <button
            type="button"
            onClick={() => {
              onNavigateDone?.()
              onOpenCreate()
            }}
            className="w-full py-2.5 px-3 rounded-xl bg-accent hover:bg-accent-strong text-accent-ink font-semibold text-xs flex items-center justify-between shadow-sm transition-all"
          >
            <span className="inline-flex items-center gap-2">
              <Plus className="w-4 h-4 stroke-[2.25]" />
              Light a watch room
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/15">
              NEW
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              onNavigateDone?.()
              onOpenJoin()
            }}
            className="w-full py-2 px-3 rounded-xl bg-panel-2 hover:bg-panel-3 border border-line text-ink-soft hover:text-ink text-xs font-medium flex items-center justify-between transition-colors"
          >
            <span className="inline-flex items-center gap-2">
              <KeyRound className="w-3.5 h-3.5 text-accent" />
              Join with a code
            </span>
            <span className="font-mono text-[10px] text-muted">6–8 chars</span>
          </button>
        </div>
      )}

      {/* Scrollable middle */}
      <div className="flex-1 overflow-y-auto px-2.5 py-3 space-y-5">
        {/* Spaces */}
        <nav aria-label="Spaces" className="space-y-0.5">
          {!collapsed && <div className="px-2.5 pb-1.5 eyebrow">Spaces</div>}
          {SPACES.map(({ to, label, icon: Icon, match }) => {
            const active = match(path)
            return (
              <Link
                key={to}
                to={to}
                onClick={onNavigateDone}
                title={collapsed ? label : undefined}
                className={`flex items-center gap-3 px-2.5 py-2 rounded-xl text-sm transition-colors ${
                  collapsed ? 'justify-center' : ''
                } ${
                  active
                    ? 'bg-panel-2 text-ink font-medium border border-line-strong'
                    : 'text-ink-soft hover:text-ink hover:bg-panel-2/60 border border-transparent'
                }`}
              >
                <Icon
                  className={`w-4 h-4 flex-shrink-0 ${
                    active ? 'text-accent' : 'text-muted'
                  }`}
                />
                {!collapsed && <span className="truncate flex-1">{label}</span>}
                {!collapsed && active && (
                  <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                )}
              </Link>
            )
          })}
        </nav>

        {/* Open parties */}
        {rooms.length > 0 && (
          <div>
            {!collapsed && (
              <div className="px-2.5 pb-1.5 flex items-center justify-between">
                <span className="eyebrow">Open parties</span>
                <span className="text-[10px] text-muted font-mono">{rooms.length}</span>
              </div>
            )}
            <div className="space-y-0.5">
              {rooms.map((r) => {
                const active = path === `/party/${r.id}`
                const sub = prettySourceName(r.url)
                return (
                  <div key={r.id} className="group flex items-center">
                    <Link
                      to={`/party/${r.id}`}
                      onClick={onNavigateDone}
                      title={collapsed ? `Party ${r.id}${sub ? ` — ${sub}` : ''}` : undefined}
                      className={`flex-1 min-w-0 flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs transition-colors ${
                        collapsed ? 'justify-center' : ''
                      } ${
                        active
                          ? 'bg-accent-soft text-ink font-medium border border-accent/30'
                          : 'text-ink-soft hover:text-ink hover:bg-panel-2/60 border border-transparent'
                      }`}
                    >
                      <Radio
                        className={`w-3.5 h-3.5 flex-shrink-0 ${
                          active ? 'text-accent' : 'text-mint'
                        }`}
                      />
                      {!collapsed && (
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1.5">
                            <div className="font-medium text-ink truncate">
                              {r.title && r.title !== `Room ${r.id}` ? r.title : r.id}
                            </div>
                            <span className="font-mono text-[10px] text-muted shrink-0">
                              {r.id}
                            </span>
                          </div>
                          {sub && <div className="text-[11px] text-muted truncate">{sub}</div>}
                        </div>
                      )}
                    </Link>
                    {!collapsed && (
                      <button
                        onClick={() => removeRoom(r.id)}
                        className="opacity-0 group-hover:opacity-100 text-muted hover:text-ink p-1 mr-1 rounded transition-opacity"
                        title="Forget this room"
                        aria-label={`Remove ${r.id} from open parties`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Active transfers */}
        {transfers?.active && (
          <div>
            {!collapsed && <div className="px-2.5 pb-1.5 eyebrow">Transfers</div>}
            <Link
              to="/files"
              onClick={onNavigateDone}
              data-testid="rail-transfer"
              className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl bg-panel-2 border border-line hover:border-line-strong transition-colors"
              title={`${transfers.mode === 'sharing' ? 'Sending' : 'Receiving'} ${transfers.shareCode} · ${transfers.overallPercent}%`}
            >
              <ArrowUpDown className="w-4 h-4 text-accent flex-shrink-0 animate-pulse" />
              {!collapsed && (
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="truncate font-medium text-ink">
                      {transfers.mode === 'sharing' ? 'Sending' : 'Receiving'} ·{' '}
                      {transfers.overallPercent}%
                    </span>
                    <span className="text-muted font-mono ml-2 text-[10px]">
                      {transfers.shareCode}
                    </span>
                  </div>
                  <div className="w-full h-1 bg-panel rounded-full overflow-hidden mt-1">
                    <div
                      className="h-full bg-accent transition-all duration-200"
                      style={{ width: `${Math.min(100, transfers.overallPercent)}%` }}
                    />
                  </div>
                </div>
              )}
            </Link>
          </div>
        )}
      </div>

      {/* Direct by design badge */}
      {!collapsed && (
        <div className="px-3 pb-2">
          <div className="p-3 rounded-xl bg-panel-2/80 border border-line">
            <div className="flex items-center gap-2 text-xs font-medium text-ink mb-0.5">
              <ShieldCheck className="w-3.5 h-3.5 text-mint shrink-0" />
              Direct by design
            </div>
            <p className="text-[11px] text-muted leading-relaxed">
              Streams & files travel device-to-device via WebRTC.
            </p>
          </div>
        </div>
      )}

      {/* Footer / account */}
      <div className="border-t border-line p-2.5">
        {user?.isGuest ? (
          <div
            className={`flex items-center ${
              collapsed ? 'flex-col gap-2' : 'justify-between gap-2'
            }`}
          >
            {!collapsed && (
              <div className="min-w-0 px-1.5">
                <div className="flex items-center gap-1.5 text-xs text-ink font-medium truncate">
                  <LiveDot color={connected ? 'mint' : 'amber'} />
                  <span className="truncate">{user.username}</span>
                </div>
                <div className="text-[11px] text-muted">Guest session</div>
              </div>
            )}
            <div className="flex items-center gap-1">
              <Link
                to="/settings"
                onClick={onNavigateDone}
                className="p-2 rounded-lg text-muted hover:text-ink hover:bg-panel-2 transition-colors"
                title="Settings"
                aria-label="Settings"
              >
                <SettingsIcon className="w-4 h-4" />
              </Link>
              <Link
                to="/login"
                onClick={onNavigateDone}
                className="btn btn-secondary text-xs py-1.5 px-2.5 flex items-center gap-1.5"
                title="Sign in to keep your handle and message history"
                data-testid="rail-signin"
              >
                <LogIn className="w-3.5 h-3.5" />
                {!collapsed && <span>Sign in</span>}
              </Link>
            </div>
          </div>
        ) : (
          <div
            className={`flex items-center ${
              collapsed ? 'flex-col gap-1' : 'justify-between gap-1'
            }`}
          >
            <Link
              to="/profile"
              onClick={onNavigateDone}
              className="flex items-center gap-2 min-w-0 px-1.5 py-1 rounded-lg hover:bg-panel-2 transition-colors flex-1"
              title="Profile"
            >
              <Avatar
                name={user?.username || 'You'}
                size="xs"
                status={connected ? 'online' : 'offline'}
              />
              {!collapsed && (
                <span className="text-xs font-medium text-ink truncate">
                  {user?.username}
                </span>
              )}
            </Link>
            <div className="flex items-center">
              <Link
                to="/settings"
                onClick={onNavigateDone}
                className="p-1.5 rounded-lg text-muted hover:text-ink hover:bg-panel-2 transition-colors"
                title="Settings"
                aria-label="Settings"
              >
                <SettingsIcon className="w-4 h-4" />
              </Link>
              <button
                onClick={logout}
                className="p-1.5 rounded-lg text-muted hover:text-coral hover:bg-panel-2 transition-colors"
                title="Log out"
                aria-label="Log out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

export default function Layout({ children }) {
  const { user, logout } = useAuth()
  const { connected } = useSocketContext()
  const transfers = useTransfers()
  const { rooms, remove: removeRoom } = useRecentRooms()
  const location = useLocation()

  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === '1'
    } catch {
      return false
    }
  })
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [joinOpen, setJoinOpen] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0')
    } catch {}
  }, [collapsed])

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((s) => !s)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const path = location.pathname

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-app text-ink">
      {/* Desktop Left rail */}
      <aside
        aria-label="Primary"
        className={`hidden md:flex flex-col border-r border-line bg-soft/90 backdrop-blur-xl transition-[width] duration-200 select-none shrink-0 ${
          collapsed ? 'w-16' : 'w-64'
        }`}
      >
        {renderLayoutContent({
          collapsed,
          setCollapsed,
          path,
          user,
          logout,
          connected,
          rooms,
          removeRoom,
          transfers,
          onOpenCreate: () => setCreateOpen(true),
          onOpenJoin: () => setJoinOpen(true),
        })}
      </aside>

      {/* Mobile slide-over drawer */}
      {mobileNavOpen &&
        createPortal(
          <div className="fixed inset-0 z-50 md:hidden flex">
            <div
              className="fixed inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setMobileNavOpen(false)}
            />
            <aside className="relative z-10 w-72 max-w-[84vw] bg-soft border-r border-line flex flex-col h-full">
              {renderLayoutContent({
                collapsed: false,
                setCollapsed: null,
                path,
                user,
                logout,
                connected,
                rooms,
                removeRoom,
                transfers,
                onOpenCreate: () => setCreateOpen(true),
                onOpenJoin: () => setJoinOpen(true),
                onNavigateDone: () => setMobileNavOpen(false),
              })}
            </aside>
          </div>,
          document.body
        )}

      {/* Main content column */}
      <div className="flex-1 min-w-0 flex flex-col min-h-screen pb-16 md:pb-0">
        <Topbar
          onOpenPalette={() => setPaletteOpen(true)}
          onOpenMobileNav={() => setMobileNavOpen(true)}
        />
        <main className="flex-1 min-w-0">{children}</main>
      </div>

      {/* Mobile bottom bar */}
      <nav
        aria-label="Primary mobile"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-panel/95 backdrop-blur-xl border-t border-line flex items-center justify-around py-1.5 px-2"
      >
        {SPACES.slice(0, 2).map(({ to, label, icon: Icon, match }) => {
          const active = match(path)
          return (
            <Link
              key={to}
              to={to}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg text-xs ${
                active ? 'text-accent font-medium' : 'text-muted'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span>{label}</span>
            </Link>
          )
        })}
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="flex flex-col items-center justify-center -mt-3 w-11 h-11 rounded-2xl bg-accent text-accent-ink shadow-lg"
          aria-label="Create room"
        >
          <Plus className="w-5 h-5 stroke-[2.25]" />
        </button>
        {SPACES.slice(2, 4).map(({ to, label, icon: Icon, match }) => {
          const active = match(path)
          return (
            <Link
              key={to}
              to={to}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg text-xs ${
                active ? 'text-accent font-medium' : 'text-muted'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span>{label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Modals */}
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onCreateRoom={() => setCreateOpen(true)}
        onJoinByCode={() => setJoinOpen(true)}
      />
      <CreateRoomModal open={createOpen} onClose={() => setCreateOpen(false)} />
      <JoinRoomModal open={joinOpen} onClose={() => setJoinOpen(false)} />
    </div>
  )
}
