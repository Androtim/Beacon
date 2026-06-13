import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Tv, ArrowRight, Sparkles } from 'lucide-react'

export default function Home() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [partyCode, setPartyCode] = useState('')

  const createParty = () => {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase()
    navigate(`/party/${code}`)
  }

  const joinParty = (e) => {
    e.preventDefault()
    const code = partyCode.trim().toUpperCase()
    if (code) navigate(`/party/${code}`)
  }

  return (
    <div className="max-w-[1100px] mx-auto px-5 sm:px-8 py-10 sm:py-16">
      {/* Welcome */}
      <header className="mb-10 sm:mb-14">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-5 text-[11px] font-bold"
             style={{ background: 'rgb(var(--accent) / 0.12)', color: 'rgb(var(--accent))' }}>
          <Sparkles size={13} /> Welcome back, {user?.username}
        </div>
        <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-[1.05]" style={{ color: 'var(--text-primary)' }}>
          Watch something<br /><span className="text-gradient">together</span>, anywhere.
        </h1>
        <p className="mt-4 max-w-md text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          Start a room, share the link, and everyone watches in perfect sync — with live chat and voice. No downloads, no accounts needed.
        </p>
      </header>

      <div className="grid md:grid-cols-2 gap-5">
        {/* Host */}
        <div className="glass-card p-7 flex flex-col justify-between relative overflow-hidden group">
          <div className="orb w-48 h-48 -top-16 -right-16" style={{ background: 'rgb(var(--accent) / 0.5)', position: 'absolute' }} />
          <div className="relative">
            <div className="beacon-mark w-12 h-12 rounded-2xl grid place-items-center mb-5">
              <Tv size={22} className="text-white" />
            </div>
            <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Start a watch party</h2>
            <p className="text-xs leading-relaxed mb-7" style={{ color: 'var(--text-secondary)' }}>
              Spin up a private room instantly. You're the host — pick the video (a link, YouTube, or a file from your device) and control playback for everyone.
            </p>
          </div>
          <button onClick={createParty} className="btn btn-primary w-full h-12 relative" data-testid="create-party">
            Start watching <ArrowRight size={16} />
          </button>
        </div>

        {/* Join */}
        <div className="glass-card p-7 flex flex-col justify-between">
          <div>
            <div className="w-12 h-12 rounded-2xl grid place-items-center mb-5"
                 style={{ background: 'rgb(var(--accent-2) / 0.18)', color: 'rgb(var(--accent-2))' }}>
              <ArrowRight size={22} />
            </div>
            <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Join a party</h2>
            <p className="text-xs leading-relaxed mb-7" style={{ color: 'var(--text-secondary)' }}>
              Got a room code from a friend? Drop it in and you'll jump straight into sync — even if the movie's already playing.
            </p>
          </div>
          <form onSubmit={joinParty} className="flex gap-2.5">
            <input
              type="text"
              value={partyCode}
              onChange={(e) => setPartyCode(e.target.value.toUpperCase())}
              placeholder="ROOM CODE"
              maxLength={8}
              className="input-field h-12 text-center font-mono tracking-[0.3em] flex-1"
              data-testid="join-code"
            />
            <button type="submit" disabled={!partyCode.trim()} className="btn btn-secondary h-12 px-6" data-testid="join-party">
              Join
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
