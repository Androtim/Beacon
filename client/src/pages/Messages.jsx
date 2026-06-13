import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../hooks/useSocket'
import { Send, Search, User, ArrowLeft, MessageSquare, ShieldAlert, Paperclip, Download, FileIcon, Check, Tv } from 'lucide-react'
import axios from 'axios'
import { getOrCreateKeyPair, encryptMessage, decryptMessage, isEnvelope } from '../lib/dmCrypto'
import { useDmFiles } from '../hooks/useDmFiles'
import { formatFileSize as formatSize } from '../context/TransfersContext'

export default function Messages() {
  const { user, isGuest } = useAuth()
  const socket = useSocket()
  const { transfers, sendFile, acceptFile, declineFile, hydrate } = useDmFiles({ socket, me: user })
  const attachRef = useRef(null)
  const navigate = useNavigate()
  const [partyInvites, setPartyInvites] = useState([]) // {from, fromUsername, roomId}

  // Watch-party invites arriving in a DM.
  useEffect(() => {
    if (!socket) return
    const onInvite = ({ from, fromUsername, roomId }) =>
      setPartyInvites((p) => [...p.filter((x) => x.roomId !== roomId), { from, fromUsername, roomId }])
    socket.on('dm-party-invite', onInvite)
    return () => socket.off('dm-party-invite', onInvite)
  }, [socket])

  const startPartyWith = (peer) => {
    const roomId = Math.random().toString(36).substring(2, 8).toUpperCase()
    socket.emit('dm-party-invite', { to: peer.id, roomId })
    navigate(`/party/${roomId}`)
  }
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
      // Split history into plain text bubbles vs. the typed cards (party
      // invites / file offers), so the cards persist across reloads and offline
      // gaps the same way text does.
      const texts = []
      const invites = []
      const offers = []
      for (const m of res.data.messages) {
        if (m.kind === 'party-invite' && m.meta?.roomId) {
          invites.push({ from: m.from.id, fromUsername: m.from.username, roomId: m.meta.roomId })
        } else if (m.kind === 'file-offer' && m.meta?.transferId) {
          const mine = m.from.id === user.id
          offers.push({
            id: m.meta.transferId,
            peerId: mine ? m.to.id : m.from.id,
            peerUsername: mine ? m.to.username : m.from.username,
            direction: mine ? 'out' : 'in',
            fileInfo: m.meta.fileInfo,
            status: mine ? 'sent' : 'offered',
            percent: mine ? 100 : 0,
          })
        } else {
          texts.push({ ...m, message: await decryptFor(otherKey, m.message) })
        }
      }
      setMessages(texts)
      if (offers.length) hydrate(offers)
      if (invites.length) setPartyInvites((p) => {
        const have = new Set(p.map((x) => x.roomId))
        const add = invites.filter((x) => !have.has(x.roomId))
        return add.length ? [...p, ...add] : p
      })
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

  // Conversation list = real conversations + anyone who's sent us a file but
  // isn't in our message history yet (so an incoming file is reachable).
  const mergedConvos = [...conversations]
  const addPeer = (id, username, label) => {
    if (id && username && !mergedConvos.some((c) => c.user.id === id)) {
      mergedConvos.push({ user: { id, username }, lastMessage: { message: label, timestamp: Date.now() }, unreadCount: 0 })
    }
  }
  for (const t of transfers) addPeer(t.peerId, t.peerUsername, 'Sent a file')
  for (const inv of partyInvites) addPeer(inv.from, inv.fromUsername, 'Invited you to watch')

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
          ) : mergedConvos.length > 0 ? (
            mergedConvos.map(conv => (
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
              {/* File transfers in this conversation */}
              {transfers.filter((t) => t.peerId === selectedUser.id).map((t) => {
                const isMe = t.direction === 'out'
                return (
                  <div key={t.id} className={`flex flex-col max-w-[80%] ${isMe ? 'self-end items-end' : 'self-start items-start'}`} data-testid="dm-file">
                    <div className="px-3.5 py-3 w-64" style={{ background: 'var(--surface-raised)', color: 'var(--text-primary)', borderRadius: 'var(--radius)' }}>
                      <div className="flex items-center gap-2.5">
                        <FileIcon size={18} style={{ color: 'rgb(var(--accent))' }} className="shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold truncate">{t.fileInfo.name}</p>
                          <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>{formatSize(t.fileInfo.size)}</p>
                        </div>
                      </div>
                      {(t.status === 'sending' || t.status === 'downloading') && (
                        <div className="mt-2.5">
                          <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'rgb(0 0 0 / 0.2)' }}>
                            <div className="h-full" style={{ width: `${t.percent}%`, background: 'rgb(var(--accent))' }} />
                          </div>
                          <p className="text-[10px] mt-1" style={{ color: 'var(--text-secondary)' }}>
                            {t.percent}% · {isMe ? 'sending — keep this open' : 'downloading'}
                          </p>
                        </div>
                      )}
                      {t.status === 'offered' && t.direction === 'in' && (
                        <div className="flex gap-2 mt-2.5">
                          <button onClick={() => acceptFile(t.id)} className="btn btn-primary flex-1 h-8 text-[11px]" data-testid="dm-file-accept"><Download size={13} /> Download</button>
                          <button onClick={() => declineFile(t.id)} className="btn btn-secondary h-8 px-3 text-[11px]">Decline</button>
                        </div>
                      )}
                      {t.status === 'offered' && t.direction === 'out' && (
                        <p className="text-[10px] mt-2" style={{ color: 'var(--text-secondary)' }}>Waiting for them to accept…</p>
                      )}
                      {(t.status === 'saved' || t.status === 'sent') && (
                        <p className="text-[10px] mt-2 flex items-center gap-1" style={{ color: 'rgb(16 185 129)' }} data-testid="dm-file-done"><Check size={12} /> {t.status === 'saved' ? 'Saved' : 'Sent'}</p>
                      )}
                      {t.status === 'declined' && <p className="text-[10px] mt-2 text-rose-400">Declined</p>}
                    </div>
                  </div>
                )
              })}
              {/* Watch-party invites in this conversation */}
              {partyInvites.filter((inv) => inv.from === selectedUser.id).map((inv) => (
                <div key={inv.roomId} className="self-start max-w-[80%]" data-testid="dm-party-invite">
                  <div className="px-4 py-3.5 w-64" style={{ background: 'var(--surface-raised)', color: 'var(--text-primary)', borderRadius: 'var(--radius)' }}>
                    <div className="flex items-center gap-2.5 mb-2.5">
                      <div className="w-9 h-9 rounded-xl grid place-items-center" style={{ background: 'rgb(var(--accent) / 0.15)', color: 'rgb(var(--accent))' }}><Tv size={16} /></div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold">{inv.fromUsername} started a watch party</p>
                        <p className="text-[10px] font-mono" style={{ color: 'var(--text-secondary)' }}>Room {inv.roomId}</p>
                      </div>
                    </div>
                    <button onClick={() => navigate(`/party/${inv.roomId}`)} className="btn btn-primary w-full h-9 text-[11px]" data-testid="dm-party-join">Join</button>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </main>

            <form onSubmit={sendMessage} className="p-4 border-t flex gap-2 items-center" style={{ borderColor: 'var(--border)' }}>
              <input ref={attachRef} type="file" className="hidden" data-testid="dm-attach-input"
                onChange={(e) => { const f = e.target.files[0]; if (f) sendFile(selectedUser.id, f); e.target.value = null }} />
              <button type="button" onClick={() => attachRef.current?.click()} className="btn btn-secondary w-11 h-11 !p-0 shrink-0" title="Send a file" data-testid="dm-attach"><Paperclip size={16} /></button>
              <button type="button" onClick={() => startPartyWith(selectedUser)} className="btn btn-secondary w-11 h-11 !p-0 shrink-0" title="Start a watch party" data-testid="dm-start-party"><Tv size={16} /></button>
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
