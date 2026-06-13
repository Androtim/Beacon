import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Appearance from '../components/Appearance'
import ThemeReset from '../components/ThemeReset'
import { ArrowLeft, User, Palette, LogOut } from 'lucide-react'

export default function Settings() {
  const { user, logout, rename, isGuest } = useAuth()
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [saveStatus, setSaveStatus] = useState(null)

  useEffect(() => { if (user) setName(user.username || '') }, [user])

  const handleSaveProfile = async () => {
    const trimmed = name.trim()
    if (!trimmed || trimmed === user?.username) return
    setSaveStatus('saving')
    const result = await rename(trimmed)
    setSaveStatus(result.success ? 'saved' : result.error)
    if (result.success) setTimeout(() => setSaveStatus(null), 2000)
  }

  const handleSignOut = async () => { await logout(); navigate('/') }

  const sectionTitle = (Icon, label) => (
    <div className="flex items-center gap-3 mb-5">
      <div className="w-9 h-9 rounded-xl grid place-items-center" style={{ background: 'rgb(var(--accent) / 0.14)', color: 'rgb(var(--accent))' }}>
        <Icon size={17} />
      </div>
      <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: 'var(--text-primary)' }}>{label}</h3>
    </div>
  )

  return (
    <div className="max-w-3xl mx-auto px-5 sm:px-8 py-8 lg:py-12 space-y-6">
      <header className="flex items-center gap-3">
        <Link to="/" className="nav-item !px-2.5 !py-2.5"><ArrowLeft size={18} /></Link>
        <h1 className="text-2xl font-black tracking-tight" style={{ color: 'var(--text-primary)' }}>Settings</h1>
      </header>

      {/* Profile */}
      <section className="glass-card p-6">
        {sectionTitle(User, 'Profile')}
        <div className="space-y-4">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-secondary)' }}>Display name</label>
            <input type="text" className="input-field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
          </div>
          <button onClick={handleSaveProfile} className="btn btn-primary w-full h-11 text-xs" disabled={saveStatus === 'saving'}>
            {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? 'Saved ✓' : 'Save name'}
          </button>
          {saveStatus && saveStatus !== 'saving' && saveStatus !== 'saved' && (
            <p className="text-[11px] text-rose-400 text-center">{saveStatus}</p>
          )}
          {isGuest && (
            <p className="text-[11px] text-center leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              You're a guest — your name works everywhere, but DMs and saved history need an account.{' '}
              <Link to="/signup" style={{ color: 'rgb(var(--accent))' }} className="font-bold">Create one</Link>.
            </p>
          )}
        </div>
      </section>

      {/* Appearance / customization */}
      <section className="glass-card p-6">
        {sectionTitle(Palette, 'Appearance')}
        <Appearance />
      </section>

      {/* Shadow-DOM reset escape hatch — only mounted here to avoid clutter elsewhere. */}
      <ThemeReset />

      <button
        onClick={handleSignOut}
        className="w-full flex items-center justify-center gap-2 h-11 rounded-xl font-bold text-xs uppercase tracking-wider text-rose-400 border transition-all active:scale-[0.98]"
        style={{ background: 'rgb(244 63 94 / 0.08)', borderColor: 'rgb(244 63 94 / 0.25)' }}
      >
        <LogOut size={16} /> {isGuest ? 'Reset guest session' : 'Sign out'}
      </button>
    </div>
  )
}
