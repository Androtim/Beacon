import { useAuth } from '../context/AuthContext'
import Launcher from '../components/Launcher'
import { Sparkles, Tv, FolderUp, MessageSquare } from 'lucide-react'

export default function Home() {
  const { user } = useAuth()

  return (
    <div className="max-w-[920px] mx-auto px-5 sm:px-8 py-12 sm:py-20">
      <header className="mb-8 sm:mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-5 text-[11px] font-bold"
          style={{ background: 'rgb(var(--accent) / 0.12)', color: 'rgb(var(--accent))' }}>
          <Sparkles size={13} /> Welcome back, {user?.username}
        </div>
        <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-[1.05]" style={{ color: 'var(--text-primary)' }}>
          Watch, share, and<br /><span className="text-gradient">hang out</span> — together.
        </h1>
        <p className="mt-4 max-w-md text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          Start something new, or paste a code a friend sent you. No downloads, no account needed.
        </p>
      </header>

      <Launcher variant="hero" />

      {/* What "New" can do */}
      <div className="grid sm:grid-cols-3 gap-3 mt-10">
        {[
          { icon: Tv, title: 'Watch party', body: 'Sync a video with friends — link, YouTube, or a file from your device.' },
          { icon: FolderUp, title: 'Send files', body: 'Stream files straight to someone, browser to browser. Nothing stored.' },
          { icon: MessageSquare, title: 'Messages', body: 'End-to-end encrypted DMs (needs a free account).' },
        ].map(({ icon: Icon, title, body }) => (
          <div key={title} className="glass-card p-5">
            <div className="w-10 h-10 rounded-xl grid place-items-center mb-3" style={{ background: 'rgb(var(--accent) / 0.12)', color: 'rgb(var(--accent))' }}>
              <Icon size={18} />
            </div>
            <h3 className="text-sm font-bold mb-1" style={{ color: 'var(--text-primary)' }}>{title}</h3>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{body}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
