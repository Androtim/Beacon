import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Gem, Lock, Mail, User, ArrowRight } from 'lucide-react'

export default function Signup() {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { signup } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const result = await signup(username, email, password)
    if (result.success) navigate('/')
    else setError(result.error)
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 w-full">
      <div className="glass-card w-full max-w-md p-8">
        <div className="flex flex-col items-center mb-8">
          <div className="beacon-mark w-14 h-14 rounded-2xl grid place-items-center mb-4 animate-beacon">
            <Gem size={26} className="text-white" />
          </div>
          <h2 className="text-2xl font-black tracking-tight" style={{ color: 'var(--text-primary)' }}>Create your account</h2>
          <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>Keeps your name, DMs, and stats across devices</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="px-4 py-3 rounded-xl text-xs font-semibold" style={{ background: 'rgb(244 63 94 / 0.08)', color: 'rgb(244 63 94)' }}>
              {error}
            </div>
          )}
          <div className="relative">
            <User className="absolute left-3.5 top-1/2 -translate-y-1/2" size={16} style={{ color: 'var(--text-secondary)' }} />
            <input type="text" required className="input-field pl-10 h-11" placeholder="Display name" value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2" size={16} style={{ color: 'var(--text-secondary)' }} />
            <input type="email" required className="input-field pl-10 h-11" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2" size={16} style={{ color: 'var(--text-secondary)' }} />
            <input type="password" required className="input-field pl-10 h-11" placeholder="Password (min 6 characters)" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <button type="submit" disabled={loading} className="btn btn-primary w-full h-11 text-xs">
            {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <>Create account <ArrowRight size={14} /></>}
          </button>
        </form>

        <p className="text-xs text-center mt-7 pt-6 border-t" style={{ color: 'var(--text-secondary)', borderColor: 'var(--border)' }}>
          Already have an account? <Link to="/login" className="font-bold" style={{ color: 'rgb(var(--accent))' }}>Sign in</Link>
        </p>
      </div>
    </div>
  )
}
