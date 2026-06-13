import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../hooks/useSocket'
import { Send, Search, User, ArrowLeft, MoreVertical, MessageSquare, ShieldAlert } from 'lucide-react'
import axios from 'axios'
import { getOrCreateKeyPair, encryptMessage, decryptMessage, isEnvelope } from '../lib/dmCrypto'

export default function Messages() {
  const { user, isGuest } = useAuth()
  const socket = useSocket()
  const [conversations, setConversations] = useState([])
  const [selectedUser, setSelectedUser] = useState(null)
  const selectedUserRef = useRef(null)
  selectedUserRef.current = selectedUser
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const messagesEndRef = useRef(null)

  // E2E: ensure this device has a keypair and the public half is published.
  const keysRef = useRef(null)
  useEffect(() => {
    if (isGuest || !user?.id) return
    getOrCreateKeyPair(user.id).then(async (keys) => {
      keysRef.current = keys
      const published = user.publicKey
      const mine = JSON.stringify(keys.publicJwk)
      if (published !== mine) {
        await axios.post('/api/auth/public-key', { publicKey: mine }).catch(() => {})
      }
    })
  }, [isGuest, user?.id])

  const decryptFor = async (otherPublicKey, text) => {
    if (!isEnvelope(text)) return text // legacy plaintext
    if (!keysRef.current || !otherPublicKey) return '🔒 (encrypted)'
    const plain = await decryptMessage(keysRef.current.privateKey, otherPublicKey, text)
    return plain ?? '🔒 (sent to another device)'
  }

  useEffect(() => {
    if (!isGuest) fetchConversations()
  }, [isGuest])

  useEffect(() => {
    if (selectedUser) {
      fetchMessages(selectedUser.id)
    }
  }, [selectedUser])

  useEffect(() => {
    if (!socket) return

    const onPrivateMessage = async ({ from, message, timestamp }) => {
      if (selectedUser && from.id === selectedUser.id) {
        const text = await decryptFor(selectedUser.publicKey, message)
        setMessages(prev => [...prev, { from: { id: from.id }, message: text, timestamp }])
      }
      fetchConversations()
    }
    socket.on('private-message', onPrivateMessage)
    return () => socket.off('private-message', onPrivateMessage)
  }, [socket, selectedUser])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const fetchConversations = async () => {
    try {
      const res = await axios.get('/api/conversations')
      setConversations(res.data.conversations)
    } catch (err) {
      console.error('Failed to fetch conversations')
    }
  }

  const fetchMessages = async (userId) => {
    try {
      const res = await axios.get(`/api/messages/${userId}`)
      // The other party's public key decrypts in both directions (ECDH is
      // symmetric between the two of us).
      const otherKey = selectedUserRef.current?.publicKey
      const decrypted = await Promise.all(res.data.messages.map(async (m) => ({
        ...m,
        message: await decryptFor(otherKey, m.message),
      })))
      setMessages(decrypted)
    } catch (err) {
      console.error('Failed to fetch messages')
    }
  }

  const handleSearch = async (e) => {
    const q = e.target.value
    setSearchQuery(q)
    if (q.length > 2) {
      try {
        const res = await axios.get(`/api/users/search?query=${q}`)
        setSearchResults(res.data.users)
      } catch (err) {}
    } else {
      setSearchResults([])
    }
  }

  const sendMessage = async (e) => {
    e.preventDefault()
    if (!newMessage.trim() || !selectedUser || !socket) return

    const timestamp = Date.now()
    const plaintext = newMessage
    // Encrypt whenever the recipient has published a key; the server only
    // ever sees the envelope. (Plaintext fallback for accounts that have
    // never opened Messages and so never published one.)
    let wire = plaintext
    if (selectedUser.publicKey && keysRef.current) {
      try {
        wire = await encryptMessage(keysRef.current.privateKey, selectedUser.publicKey, plaintext)
      } catch (err) {
        console.error('Encryption failed, not sending:', err)
        return
      }
    }
    socket.emit('private-message', { to: selectedUser.id, message: wire, timestamp })
    setMessages(prev => [...prev, { from: { id: user.id }, message: plaintext, timestamp }])
    setNewMessage('')
    fetchConversations()
  }

  if (isGuest) {
    return (
      <div className="max-w-[600px] mx-auto px-4 py-24 text-center">
        <div className="glass-card p-10">
          <ShieldAlert size={36} className="mx-auto mb-4" style={{ color: 'rgb(var(--accent))' }} />
          <h2 className="text-lg font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Direct messages need an account</h2>
          <p className="text-xs mb-8 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            You're browsing as <span className="font-mono" style={{ color: 'var(--text-primary)' }}>{user?.username}</span>.
            Watch parties and file sharing work without an account, but private messages need a persistent identity
            so friends can find you and your history survives.
          </p>
          <div className="flex gap-3 justify-center">
            <Link to="/login" className="btn btn-secondary px-6 h-11 text-xs inline-flex items-center">Log in</Link>
            <Link to="/signup" className="btn btn-primary px-6 h-11 text-xs inline-flex items-center">Create an account</Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-[1200px] mx-auto px-4 py-6 lg:py-8 h-[calc(100vh-5rem)] flex gap-5">

      {/* Contact Sidebar */}
      <div className="w-80 glass-card flex flex-col overflow-hidden">
        <div className="p-4 border-b space-y-4" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-3">
            <Link to="/" className="nav-item !px-2 !py-2"><ArrowLeft size={16} /></Link>
            <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color: 'var(--text-primary)' }}>Messages</h2>
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-secondary)' }} />
            <input
              type="text"
              className="input-field pl-9 pr-4 h-10"
              placeholder="Search people…"
              value={searchQuery}
              onChange={handleSearch}
            />
          </div>
        </div>

        {/* Contact Lists */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-850">
          {searchResults.length > 0 ? (
            searchResults.map(u => (
              <div 
                key={u.id} 
                onClick={() => { setSelectedUser(u); setSearchResults([]); setSearchQuery('') }}
                className="p-3.5 cursor-pointer flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
              >
                <div className="w-9 h-9 rounded-xl grid place-items-center font-bold" style={{ background: 'rgb(var(--accent) / 0.15)', color: 'rgb(var(--accent))' }}>
                  <User size={18} />
                </div>
                <div className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{u.username}</div>
              </div>
            ))
          ) : conversations.length > 0 ? (
            conversations.map(conv => (
              <div 
                key={conv.user.id} 
                onClick={() => setSelectedUser(conv.user)}
                className="p-4 cursor-pointer flex items-center gap-3 transition-colors"
                style={selectedUser?.id === conv.user.id
                  ? { background: 'rgb(var(--accent) / 0.1)', borderLeft: '2px solid rgb(var(--accent))' }
                  : undefined}
              >
                <div className="w-10 h-10 rounded-xl grid place-items-center shrink-0" style={{ background: 'rgb(var(--accent) / 0.15)', color: 'rgb(var(--accent))' }}>
                  <User size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline mb-0.5">
                    <span className="text-xs font-bold truncate" style={{ color: 'var(--text-primary)' }}>{conv.user.username}</span>
                    <span className="text-[9px] shrink-0 font-mono" style={{ color: 'var(--text-secondary)' }}>
                      {new Date(conv.lastMessage.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-[10px] truncate" style={{ color: 'var(--text-secondary)' }}>
                    {conv.lastMessage.message}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="p-8 text-center mt-10" style={{ color: 'var(--text-secondary)' }}>
              <MessageSquare className="mx-auto mb-3 opacity-20" size={24} />
              <p className="text-[11px]">No conversations yet — search for someone above.</p>
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 glass-card flex flex-col overflow-hidden">
        {selectedUser ? (
          <>
            <header className="p-4 border-b flex justify-between items-center" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl grid place-items-center" style={{ background: 'rgb(var(--accent) / 0.15)', color: 'rgb(var(--accent))' }}>
                  <User size={18} />
                </div>
                <div>
                  <div className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{selectedUser.username}</div>
                  <div className="text-[9px] font-bold flex items-center gap-1 uppercase tracking-wider" style={{ color: 'rgb(16 185 129)' }}>
                    <span className="inline-block w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'rgb(16 185 129)' }} />
                    End-to-end encrypted
                  </div>
                </div>
              </div>
            </header>

            <main className="flex-1 overflow-y-auto p-6 flex flex-col gap-3">
              {messages.map((msg, i) => {
                const isMe = msg.from.id === user.id
                return (
                  <div key={i} className={`flex flex-col max-w-[75%] ${isMe ? 'self-end items-end' : 'self-start items-start'}`}>
                    <div className="px-4 py-2.5 text-xs"
                      style={isMe
                        ? { background: 'rgb(var(--accent))', color: '#1a0f0d', borderRadius: 'var(--radius)', borderTopRightRadius: 4 }
                        : { background: 'var(--surface-raised)', color: 'var(--text-primary)', borderRadius: 'var(--radius)', borderTopLeftRadius: 4 }}>
                      {msg.message}
                    </div>
                    <span className="text-[9px] font-mono mt-1 px-1" style={{ color: 'var(--text-secondary)' }}>
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                )
              })}
              <div ref={messagesEndRef} />
            </main>

            <form onSubmit={sendMessage} className="p-4 border-t flex gap-3 items-center" style={{ borderColor: 'var(--border)' }}>
              <input
                type="text"
                className="input-field flex-1 h-11"
                placeholder="Message…"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
              />
              <button type="submit" className="btn btn-primary w-11 h-11 !p-0 shrink-0"><Send size={16} /></button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8" style={{ color: 'var(--text-secondary)' }}>
            <MessageSquare size={48} className="mb-4 opacity-15" />
            <p className="text-xs">Pick a conversation, or search for someone to message.</p>
          </div>
        )}
      </div>
    </div>
  )
}
