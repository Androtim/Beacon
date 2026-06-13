import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'
import { earnedBadges, formatWatchTime } from '../lib/badges'
import { User, ArrowLeft, MessageSquare, Tv, Clock, Sparkles, Trophy } from 'lucide-react'

export default function Profile() {
  const { id } = useParams()
  const { user } = useAuth()
  const [profile, setProfile] = useState(null)
  const [error, setError] = useState(false)

  const targetId = id || user?.id

  useEffect(() => {
    if (!targetId) return
    setProfile(null); setError(false)
    axios.get(`/api/users/${targetId}/profile`)
      .then((res) => setProfile(res.data))
      .catch(() => setError(true))
  }, [targetId])

  if (error) {
    return (
      <div className="max-w-[600px] mx-auto px-4 py-24 text-center">
        <div className="glass-card p-10">
          <User size={36} className="mx-auto mb-4 opacity-30" />
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>That profile couldn't be found.</p>
          <Link to="/" className="btn btn-secondary px-6 h-10 text-xs inline-flex items-center mt-6">Back home</Link>
        </div>
      </div>
    )
  }

  if (!profile) {
    return <div className="max-w-[600px] mx-auto px-4 py-24 text-center text-xs" style={{ color: 'var(--text-secondary)' }}>Loading…</div>
  }

  const { user: u, stats } = profile
  const badges = earnedBadges(stats)
  const isMe = u.id === user?.id
  const stat = [
    { icon: MessageSquare, label: 'Messages', value: stats.messagesSent },
    { icon: Tv, label: 'Parties started', value: stats.partiesStarted },
    { icon: Clock, label: 'Watch time', value: formatWatchTime(stats.watchSeconds) },
  ]

  return (
    <div className="max-w-[720px] mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/" className="nav-item !px-2 !py-2"><ArrowLeft size={16} /></Link>
        <Link to="/leaderboard" className="btn btn-secondary !px-3 h-9 text-[11px] inline-flex items-center gap-1.5 ml-auto"><Trophy size={14} /> Leaderboard</Link>
      </div>

      {/* Identity */}
      <div className="glass-card p-8 flex items-center gap-5">
        <div className="w-16 h-16 rounded-2xl grid place-items-center" style={{ background: 'rgb(var(--accent) / 0.15)', color: 'rgb(var(--accent))' }}>
          <User size={32} />
        </div>
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }} data-testid="profile-username">{u.username}{isMe && <span className="text-[10px] font-bold uppercase tracking-wider ml-2" style={{ color: 'rgb(var(--accent))' }}>You</span>}</h1>
          {u.createdAt && (
            <p className="text-[11px] mt-1" style={{ color: 'var(--text-secondary)' }}>
              Joined {new Date(u.createdAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
            </p>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {stat.map((s) => (
          <div key={s.label} className="glass-card p-5 text-center">
            <s.icon size={18} className="mx-auto mb-2" style={{ color: 'rgb(var(--accent))' }} />
            <div className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }} data-testid="profile-stat">{s.value}</div>
            <div className="text-[10px] uppercase tracking-wider mt-1" style={{ color: 'var(--text-secondary)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Constellation badges */}
      <div className="glass-card p-6">
        <h2 className="text-xs font-bold uppercase tracking-wider mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <Sparkles size={14} style={{ color: 'rgb(var(--accent))' }} /> Constellation
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {badges.map((b) => (
            <div key={b.id} className="rounded-xl p-3.5 transition-opacity" data-testid="profile-badge"
              style={b.earned
                ? { background: 'rgb(var(--accent) / 0.12)', border: '1px solid rgb(var(--accent) / 0.4)' }
                : { background: 'var(--surface-raised)', opacity: 0.4 }}>
              <div className="text-xs font-bold" style={{ color: b.earned ? 'rgb(var(--accent))' : 'var(--text-secondary)' }}>{b.label}</div>
              <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>{b.hint}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
