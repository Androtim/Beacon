import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { LogIn, Eye, EyeOff, Zap, Shield, ArrowRight } from 'lucide-react'
import { motion } from 'framer-motion'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
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
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center px-4 selection:bg-violet-500/30">
      {/* Background Decor */}
      <div className="orb w-[600px] h-[600px] bg-violet-600/20 top-[-200px] left-[-200px]" />
      <div className="orb w-[500px] h-[500px] bg-cyan-500/10 bottom-[-100px] right-[-100px]" />
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full glass-card p-10 relative z-10"
      >
        <div className="text-center mb-10">
          <motion.div 
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="mx-auto h-16 w-16 bg-gradient-to-br from-violet-500 to-cyan-400 rounded-2xl flex items-center justify-center shadow-xl shadow-violet-500/20 mb-6"
          >
            <Zap className="h-8 w-8 text-white" fill="currentColor" />
          </motion.div>
          <h2 className="text-3xl font-bold tracking-tight text-white mb-2">
            Protocol <span className="text-gradient">Access</span>
          </h2>
          <p className="text-slate-400 text-sm font-medium">
            Synchronize your credentials to continue.
          </p>
        </div>

        <form className="space-y-6" onSubmit={handleSubmit}>
          {error && (
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm font-mono"
            >
              {error}
            </motion.div>
          )}

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">
                Operator Email
              </label>
              <input
                type="email"
                required
                className="glass-input"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">
                Access Key
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  className="glass-input pr-12"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-500 hover:text-white transition-colors"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full glass-button group"
          >
            {loading ? (
               <Loader className="h-5 w-5 animate-spin" />
            ) : (
               <>
                 <span>INITIALIZE SESSION</span>
                 <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
               </>
            )}
          </button>

          <div className="text-center pt-4">
            <p className="text-slate-500 text-sm">
              New operative?{' '}
              <Link to="/signup" className="text-violet-400 hover:text-violet-300 font-bold transition-colors">
                Register Protocol
              </Link>
            </p>
          </div>
        </form>

        <div className="mt-10 pt-6 border-t border-white/5 flex items-center justify-center gap-2 text-[10px] text-slate-600 font-bold tracking-widest uppercase">
           <Shield className="h-3 w-3" />
           <span>End-to-End Encrypted Access</span>
        </div>
      </motion.div>
    </div>
  )
}

function Loader(props) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 2v4" />
      <path d="m16.2 7.8 2.9-2.9" />
      <path d="M18 12h4" />
      <path d="m16.2 16.2 2.9 2.9" />
      <path d="M12 18v4" />
      <path d="m4.9 19.1 2.9-2.9" />
      <path d="M2 12h4" />
      <path d="m4.9 4.9 2.9 2.9" />
    </svg>
  )
}
