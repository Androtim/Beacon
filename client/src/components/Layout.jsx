import { useTheme } from '../context/ThemeContext'
import { useAuth } from '../context/AuthContext'
import { Sun, Moon, Gem, Settings, LogOut, Tv, FolderOpen, MessageSquare } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'

// The three "spaces". Each is its own world — you never see file/DM chrome
// while watching, and vice versa.
const SPACES = [
  { to: '/', label: 'Watch', icon: Tv, match: (p) => p === '/' || p.startsWith('/party') },
  { to: '/files', label: 'Files', icon: FolderOpen, match: (p) => p.startsWith('/files') },
  { to: '/messages', label: 'Messages', icon: MessageSquare, match: (p) => p.startsWith('/messages') },
]

function BeaconMark({ size = 'md' }) {
  const dim = size === 'sm' ? 'w-8 h-8' : 'w-9 h-9'
  return (
    <div className={`${dim} beacon-mark rounded-xl grid place-items-center animate-beacon shrink-0`}>
      <Gem size={size === 'sm' ? 15 : 17} className="text-white/95" />
    </div>
  )
}

export default function Layout({ children }) {
  const { mode, toggleTheme } = useTheme()
  const { user, logout } = useAuth()
  const location = useLocation()
  const path = location.pathname

  const isAuthPage = path === '/login' || path === '/signup'

  if (isAuthPage) {
    return (
      <div className="relative min-h-screen overflow-hidden flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
        <div className="orb w-[460px] h-[460px] top-[-160px] left-[-110px]" style={{ background: 'rgb(var(--accent-2) / 0.5)' }} />
        <div className="orb w-[460px] h-[460px] bottom-[-160px] right-[-110px]" style={{ background: 'rgb(var(--accent) / 0.45)' }} />
        <div className="absolute top-6 right-6 z-50">
          <button onClick={toggleTheme} className="btn btn-ghost h-11 w-11 !px-0" aria-label="Toggle theme">
            {mode === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
        <div className="relative z-10 w-full flex justify-center p-4">{children}</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="orb w-[360px] h-[360px] top-[-120px] left-[120px]" style={{ background: 'rgb(var(--accent-2) / 0.4)' }} />
      <div className="orb w-[320px] h-[320px] bottom-[40px] right-[-40px]" style={{ background: 'rgb(var(--accent) / 0.35)' }} />

      <div className="relative z-10 flex min-h-screen">
        {/* Lighthouse rail (desktop) */}
        <aside className="hidden md:flex w-60 shrink-0 flex-col gap-2 p-4 border-r" style={{ borderColor: 'var(--border)' }}>
          <Link to="/" className="flex items-center gap-3 px-2 py-3 mb-2">
            <BeaconMark />
            <span className="text-lg font-extrabold tracking-tight" style={{ color: 'var(--text-primary)' }}>
              Beacon<span className="text-gradient">.</span>
            </span>
          </Link>

          <nav className="flex flex-col gap-1">
            {SPACES.map(({ to, label, icon: Icon, match }) => (
              <Link key={to} to={to} className={`nav-item ${match(path) ? 'active' : ''}`}>
                <Icon size={18} /> {label}
              </Link>
            ))}
          </nav>

          <div className="mt-auto flex flex-col gap-1 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
            {user && (
              <Link to="/settings" className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors hover:bg-[rgb(var(--accent-2)/0.1)]">
                <div className="w-8 h-8 rounded-full grid place-items-center text-xs font-bold shrink-0"
                     style={{ background: 'rgb(var(--accent) / 0.2)', color: 'rgb(var(--accent))' }}>
                  {(user.username ?? '?').slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold truncate" style={{ color: 'var(--text-primary)' }}>{user.username}</div>
                  <div className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>{user.isGuest ? 'Guest' : 'Account'}</div>
                </div>
              </Link>
            )}
            <div className="flex items-center gap-1 px-1">
              <Link to="/settings" className="nav-item flex-1 justify-center !px-0"><Settings size={17} /></Link>
              <button onClick={toggleTheme} className="nav-item flex-1 justify-center !px-0" aria-label="Toggle theme">
                {mode === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
              </button>
              {user && (
                <button onClick={logout} className="nav-item flex-1 justify-center !px-0 hover:!bg-rose-500/10 hover:!text-rose-400" aria-label="Sign out">
                  <LogOut size={17} />
                </button>
              )}
            </div>
          </div>
        </aside>

        {/* Mobile top bar */}
        <header className="md:hidden fixed top-0 inset-x-0 z-40 h-14 px-4 flex items-center justify-between backdrop-blur-xl border-b"
                style={{ background: 'var(--glass-bg)', borderColor: 'var(--border)' }}>
          <Link to="/" className="flex items-center gap-2.5">
            <BeaconMark size="sm" />
            <span className="font-extrabold tracking-tight" style={{ color: 'var(--text-primary)' }}>Beacon<span className="text-gradient">.</span></span>
          </Link>
          <div className="flex items-center gap-1">
            <button onClick={toggleTheme} className="btn btn-ghost h-10 w-10 !px-0" aria-label="Toggle theme">
              {mode === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <Link to="/settings" className="btn btn-ghost h-10 w-10 !px-0"><Settings size={17} /></Link>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 w-full relative pt-14 pb-20 md:pt-0 md:pb-0">{children}</main>

        {/* Mobile bottom tabs */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 h-16 grid grid-cols-3 backdrop-blur-xl border-t"
             style={{ background: 'var(--glass-bg)', borderColor: 'var(--border)' }}>
          {SPACES.map(({ to, label, icon: Icon, match }) => (
            <Link key={to} to={to} className="flex flex-col items-center justify-center gap-1 transition-colors"
                  style={{ color: match(path) ? 'rgb(var(--accent))' : 'var(--text-secondary)' }}>
              <Icon size={20} />
              <span className="text-[10px] font-bold">{label}</span>
            </Link>
          ))}
        </nav>
      </div>
    </div>
  )
}
