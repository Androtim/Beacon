import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation } from 'react-router-dom'
import {
  ArrowUpDown,
  Compass,
  FolderUp,
  Home,
  LogIn,
  LogOut,
  MessageSquare,
  PanelLeft,
  PanelLeftClose,
  Plus,
  Radio,
  Settings as SettingsIcon,
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

function renderSidebarContent({
  collapsed,
  setCollapsed,
  path,
  user,
  logout,
  connected,
  rooms,
  removeRoom,
  transfers,
  onNavigateDone,
}) {
  return (
    <>
      {/* Brand header */}
      <div
        className={`flex items-center ${
          collapsed ? 'justify-center px-2' : 'justify-between px-3.5'
        } h-12 border-b border-line shrink-0`}
      >
        <Link
          to="/"
          onClick={onNavigateDone}
          className="flex items-center gap-2.5 min-w-0"
          title="Beacon — Home"
        >
          <BeaconMark size={26} />
          {!collapsed && <Wordmark />}
        </Link>
        {!collapsed && setCollapsed && (
          <button
            onClick={() => setCollapsed(true)}
            className="icon-btn w-7 h-7"
            title="Collapse sidebar"
            aria-label="Collapse sidebar"
            data-testid="rail-collapse"
          >
            <PanelLeftClose className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {collapsed && setCollapsed && (
        <button
          onClick={() => setCollapsed(false)}
          className="mx-auto mt-2 icon-btn w-8 h-8"
          title="Expand sidebar"
          aria-label="Expand sidebar"
          data-testid="rail-expand"
        >
          <PanelLeft className="w-3.5 h-3.5" />
        </button>
      )}

      {/* Compact launcher on non-home pages */}
      {path !== '/' && !collapsed && (
        <div className="px-2.5 pt-2.5 pb-2 border-b border-line">
          <Launcher variant="rail" />
        </div>
      )}

      {/* Main navigation */}
      <div className="flex-1 overflow-y-auto px-2 py-2.5 space-y-5">
        <nav aria-label="Spaces" className="space-y-0.5">
          {SPACES.map(({ to, label, icon: Icon, match }) => {
            const active = match(path)
            return (
              <Link
                key={to}
                to={to}
                onClick={onNavigateDone}
                title={collapsed ? label : undefined}
                className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[13px] transition-colors ${
                  collapsed ? 'justify-center' : ''
                } ${
                  active
                    ? 'bg-panel-2 text-ink font-medium'
                    : 'text-muted hover:text-ink hover:bg-panel-2/50'
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    active ? 'text-accent' : 'text-muted'
                  }`}
                />
                {!collapsed && <span className="truncate">{label}</span>}
              </Link>
            )
          })}
        </nav>

        {/* Active / recent parties */}
        {rooms.length > 0 && (
          <div>
            {!collapsed && (
              <div className="px-2.5 pb-1.5 flex items-center justify-between">
                <span className="text-[11px] font-medium text-faint">Open rooms</span>
                <span className="text-[10px] text-faint font-mono">{rooms.length}</span>
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
                      title={collapsed ? `Room ${r.id}${sub ? ` — ${sub}` : ''}` : undefined}
                      className={`flex-1 min-w-0 flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                        collapsed ? 'justify-center' : ''
                      } ${
                        active
                          ? 'bg-accent-soft text-ink font-medium'
                          : 'text-ink-soft hover:text-ink hover:bg-panel-2/50'
                      }`}
                    >
                      <Radio
                        className={`w-3.5 h-3.5 shrink-0 ${
                          active ? 'text-accent' : 'text-mint'
                        }`}
                      />
                      {!collapsed && (
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1.5">
                            <span className="truncate">
                              {r.title && r.title !== `Room ${r.id}` ? r.title : r.id}
                            </span>
                            <span className="font-mono text-[10px] text-faint shrink-0">
                              {r.id}
                            </span>
                          </div>
                          {sub && (
                            <div className="text-[11px] text-faint truncate">{sub}</div>
                          )}
                        </div>
                      )}
                    </Link>
                    {!collapsed && (
                      <button
                        onClick={() => removeRoom(r.id)}
                        className="opacity-0 group-hover:opacity-100 text-faint hover:text-ink p-1 mr-0.5 rounded transition-opacity"
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

        {/* Active P2P transfer */}
        {transfers?.active && (
          <div>
            {!collapsed && (
              <div className="px-2.5 pb-1.5 text-[11px] font-medium text-faint">
                Transfer
              </div>
            )}
            <Link
              to="/files"
              onClick={onNavigateDone}
              data-testid="rail-transfer"
              className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-panel-2 border border-line hover:border-line-strong transition-colors"
              title={`${transfers.mode === 'sharing' ? 'Sending' : 'Receiving'} ${transfers.shareCode} · ${transfers.overallPercent}%`}
            >
              <ArrowUpDown className="w-3.5 h-3.5 text-accent shrink-0" />
              {!collapsed && (
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="truncate font-medium text-ink">
                      {transfers.mode === 'sharing' ? 'Sending' : 'Receiving'} ·{' '}
                      {transfers.overallPercent}%
                    </span>
                    <span className="text-faint font-mono ml-1.5 text-[10px]">
                      {transfers.shareCode}
                    </span>
                  </div>
                  <div className="w-full h-1 bg-panel rounded-full overflow-hidden mt-1.5">
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

      {/* Account footer */}
      <div className="border-t border-line p-2 shrink-0">
        {user?.isGuest ? (
          <div
            className={`flex items-center ${
              collapsed ? 'flex-col gap-1.5' : 'justify-between gap-1.5'
            }`}
          >
            {!collapsed && (
              <div className="min-w-0 px-1.5">
                <div className="flex items-center gap-1.5 text-xs text-ink font-medium truncate">
                  <LiveDot color={connected ? 'mint' : 'amber'} />
                  <span className="truncate">{user.username}</span>
                </div>
                <div className="text-[11px] text-faint">Guest</div>
              </div>
            )}
            <div className="flex items-center gap-0.5">
              <Link
                to="/settings"
                onClick={onNavigateDone}
                className="icon-btn w-7 h-7"
                title="Settings"
                aria-label="Settings"
              >
                <SettingsIcon className="w-3.5 h-3.5" />
              </Link>
              <Link
                to="/login"
                onClick={onNavigateDone}
                className="btn btn-secondary h-7 px-2.5 text-[11px]"
                title="Sign in"
                data-testid="rail-signin"
              >
                <LogIn className="w-3 h-3" />
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
            <div className="flex items-center gap-0.5">
              <Link
                to="/settings"
                onClick={onNavigateDone}
                className="icon-btn w-7 h-7"
                title="Settings"
                aria-label="Settings"
              >
                <SettingsIcon className="w-3.5 h-3.5" />
              </Link>
              <button
                onClick={logout}
                className="icon-btn w-7 h-7 hover:text-coral"
                title="Log out"
                aria-label="Log out"
              >
                <LogOut className="w-3.5 h-3.5" />
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
      {/* Desktop sidebar */}
      <aside
        aria-label="Primary"
        className={`hidden md:flex flex-col border-r border-line bg-soft transition-[width] duration-150 select-none shrink-0 sticky top-0 h-screen ${
          collapsed ? 'w-[60px]' : 'w-[224px]'
        }`}
      >
        {renderSidebarContent({
          collapsed,
          setCollapsed,
          path,
          user,
          logout,
          connected,
          rooms,
          removeRoom,
          transfers,
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
            <aside className="relative z-10 w-64 max-w-[82vw] bg-soft border-r border-line flex flex-col h-full">
              {renderSidebarContent({
                collapsed: false,
                setCollapsed: null,
                path,
                user,
                logout,
                connected,
                rooms,
                removeRoom,
                transfers,
                onNavigateDone: () => setMobileNavOpen(false),
              })}
            </aside>
          </div>,
          document.body
        )}

      {/* Main workspace */}
      <div className="flex-1 min-w-0 flex flex-col min-h-screen pb-14 md:pb-0">
        <Topbar
          onOpenPalette={() => setPaletteOpen(true)}
          onOpenMobileNav={() => setMobileNavOpen(true)}
        />
        <main className="flex-1 min-w-0">{children}</main>
      </div>

      {/* Mobile bottom bar */}
      <nav
        aria-label="Primary mobile"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 h-14 bg-soft/95 backdrop-blur-md border-t border-line flex items-center justify-around px-2"
      >
        {SPACES.slice(0, 2).map(({ to, label, icon: Icon, match }) => {
          const active = match(path)
          return (
            <Link
              key={to}
              to={to}
              className={`flex flex-col items-center gap-0.5 px-3 py-1 text-[11px] ${
                active ? 'text-accent font-medium' : 'text-muted'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{label}</span>
            </Link>
          )
        })}
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="flex items-center justify-center w-9 h-9 rounded-xl bg-accent text-accent-ink"
          aria-label="Create room"
        >
          <Plus className="w-4 h-4 stroke-[2.25]" />
        </button>
        {SPACES.slice(2, 4).map(({ to, label, icon: Icon, match }) => {
          const active = match(path)
          return (
            <Link
              key={to}
              to={to}
              className={`flex flex-col items-center gap-0.5 px-3 py-1 text-[11px] ${
                active ? 'text-accent font-medium' : 'text-muted'
              }`}
            >
              <Icon className="w-4 h-4" />
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
