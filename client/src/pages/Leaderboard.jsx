import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import { formatWatchTime } from '../lib/badges'
import { ArrowLeft, MessageSquare, Tv, Clock, Trophy, User } from 'lucide-react'

function Board({ title, icon: Icon, entries, format }) {
  return (
    <div className="glass-card p-5">
      <h2 className="text-xs font-bold uppercase tracking-wider mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
        <Icon size={14} style={{ color: 'rgb(var(--accent))' }} /> {title}
      </h2>
      {entries.length === 0 ? (
        <p className="text-[11px] py-4 text-center" style={{ color: 'var(--text-secondary)' }}>No activity yet.</p>
      ) : (
        <div className="space-y-1.5" data-testid="board">
          {entries.map((e, i) => (
            <Link key={e.id} to={`/u/${e.id}`} className="flex items-center gap-3 p-2 rounded-lg transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40">
              <span className="w-5 text-center text-[11px] font-bold font-mono" style={{ color: i < 3 ? 'rgb(var(--accent))' : 'var(--text-secondary)' }}>{i + 1}</span>
              <div className="w-7 h-7 rounded-lg grid place-items-center shrink-0" style={{ background: 'rgb(var(--accent) / 0.15)', color: 'rgb(var(--accent))' }}><User size={14} /></div>
              <span className="text-xs font-bold flex-1 truncate" style={{ color: 'var(--text-primary)' }}>{e.username}</span>
              <span className="text-[11px] font-mono" style={{ color: 'var(--text-secondary)' }}>{format ? format(e.value) : e.value}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Leaderboard() {
  const [data, setData] = useState(null)

  useEffect(() => {
    axios.get('/api/leaderboard').then((res) => setData(res.data)).catch(() => setData({ messages: [], parties: [], watchTime: [] }))
  }, [])

  return (
    <div className="max-w-[1100px] mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/" className="nav-item !px-2 !py-2"><ArrowLeft size={16} /></Link>
        <h1 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <Trophy size={16} style={{ color: 'rgb(var(--accent))' }} /> Leaderboard
        </h1>
      </div>
      {!data ? (
        <p className="text-xs text-center py-12" style={{ color: 'var(--text-secondary)' }}>Loading…</p>
      ) : (
        <div className="grid md:grid-cols-3 gap-5">
          <Board title="Most talkative" icon={MessageSquare} entries={data.messages} />
          <Board title="Top hosts" icon={Tv} entries={data.parties} />
          <Board title="Most watched" icon={Clock} entries={data.watchTime} format={formatWatchTime} />
        </div>
      )}
    </div>
  )
}
