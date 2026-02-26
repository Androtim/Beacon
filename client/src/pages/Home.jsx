import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../hooks/useSocket'
import FileShare from '../components/FileShare'
import { Video, Share2, Settings, MessageSquare, LogOut, Radio, ChevronRight, LayoutGrid } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'

export default function Home() {
  const { user, logout } = useAuth()
  const socket = useSocket()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('watch')
  const [partyCode, setPartyCode] = useState('')

  const createParty = () => {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase()
    navigate(`/party/${code}`)
  }

  const joinParty = (e) => {
    if (e) e.preventDefault()
    if (partyCode.trim()) {
      navigate(`/party/${partyCode.trim()}`)
    }
  }

  return (
    <div className="container" style={{ maxWidth: '1024px' }}>
      {/* Navbar */}
      <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem 0', borderBottom: '1px solid var(--border-color)', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#2563eb', fontWeight: 'bold', fontSize: '1.25rem' }}>
            <div style={{ padding: '0.4rem', backgroundColor: '#2563eb', color: 'white', borderRadius: '8px' }}>
              <Radio size={20} />
            </div>
            <span>Beacon</span>
          </div>
          
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button 
              onClick={() => setActiveTab('watch')}
              className={`btn ${activeTab === 'watch' ? 'btn-primary' : ''}`}
              style={{ backgroundColor: activeTab === 'watch' ? '' : 'transparent', color: activeTab === 'watch' ? '' : '#6b7280' }}
            >
              Watch Party
            </button>
            <button 
              onClick={() => setActiveTab('files')}
              className={`btn ${activeTab === 'files' ? 'btn-primary' : ''}`}
              style={{ backgroundColor: activeTab === 'files' ? '' : 'transparent', color: activeTab === 'files' ? '' : '#6b7280' }}
            >
              File Share
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ textAlign: 'right', paddingRight: '1rem', borderRight: '1px solid var(--border-color)', display: 'none', sm: 'block' }}>
            <div style={{ fontSize: '0.65rem', color: '#9ca3af', textTransform: 'uppercase', fontWeight: 'bold' }}>Active User</div>
            <div style={{ fontSize: '0.875rem', fontWeight: 'bold' }}>{user?.username}</div>
          </div>
          <Link to="/settings" style={{ color: '#6b7280' }}><Settings size={20} /></Link>
          <button onClick={logout} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}><LogOut size={20} /></button>
        </div>
      </nav>

      <main>
        <AnimatePresence mode="wait">
          {activeTab === 'watch' && (
            <motion.div
              key="watch"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <div style={{ marginBottom: '3rem' }}>
                <h2 style={{ fontSize: '2.5rem', fontWeight: '800', marginBottom: '0.5rem' }}>Establish Connection</h2>
                <p style={{ fontSize: '1.125rem', color: '#6b7280' }}>Sync video streams and share content with anyone, instantly.</p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
                <div className="card">
                  <div style={{ width: '2.5rem', height: '2.5rem', backgroundColor: '#eff6ff', color: '#2563eb', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyCenter: 'center', marginBottom: '1.5rem', padding: '0.5rem' }}>
                    <Video size={24} />
                  </div>
                  <h3>Host Party</h3>
                  <p>Create a private space and invite your friends using a secure link.</p>
                  <button onClick={createParty} className="btn btn-primary" style={{ width: '100%', padding: '1rem', fontSize: '1rem' }}>
                    Start New Session
                  </button>
                </div>

                <div className="card">
                  <div style={{ width: '2.5rem', height: '2.5rem', backgroundColor: '#f3f4f6', color: '#4b5563', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyCenter: 'center', marginBottom: '1.5rem', padding: '0.5rem' }}>
                    <LayoutGrid size={24} />
                  </div>
                  <h3>Join Stream</h3>
                  <p>Enter coordinates to connect to an active point-to-point stream.</p>
                  <form onSubmit={joinParty} style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                      type="text"
                      placeholder="ENTER CODE"
                      className="input-field"
                      style={{ marginBottom: 0 }}
                      value={partyCode}
                      onChange={(e) => setPartyCode(e.target.value.toUpperCase())}
                    />
                    <button type="submit" disabled={!partyCode.trim()} className="btn" style={{ backgroundColor: '#1f2937', color: 'white' }}>
                      Join
                    </button>
                  </form>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'files' && (
            <motion.div key="files" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
               <FileShare socket={socket} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  )
}
