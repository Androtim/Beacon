import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Lock, Mail, ArrowRight } from 'lucide-react'
import { BeaconMark, Wordmark } from '../components/Logo'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const result = await login(email, password)
    if (result.success) navigate('/')
    else setError(result.error)
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 w-full">
      <div className="panel w-full max-w-md p-8">
        <div className="flex flex-col items-center mb-8">
          <div className="mb-3">
            <BeaconMark size={48} />
          </div>
          <Wordmark className="text-2xl mb-1" />
          <h2 className="font-serif text-2xl text-ink tracking-tight">Welcome back</h2>
          <p className="text-xs mt-1 text-muted">Sign in to your Beacon account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="px-4 py-3 rounded-xl text-xs font-semibold bg-coral-soft text-coral border border-coral/30">
              {error}
            </div>
          )}
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" size={16} />
            <input
              type="email"
              required
              className="input-field pl-10 h-11"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" size={16} />
            <input
              type="password"
              required
              className="input-field pl-10 h-11"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary w-full h-11 text-xs"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
            ) : (
              <>
                Sign in <ArrowRight size={14} />
              </>
            )}
          </button>
        </form>

        <p className="text-xs text-center mt-7 pt-6 border-t border-line text-muted">
          New here?{' '}
          <Link to="/signup" className="font-bold text-accent hover:underline">
            Create an account
          </Link>
        </p>
        <p className="text-[11px] text-center mt-3 text-muted">
          …or just{' '}
          <Link to="/" className="font-bold underline text-ink-soft">
            jump in as a guest
          </Link>
        </p>
      </div>
    </div>
  )
}
