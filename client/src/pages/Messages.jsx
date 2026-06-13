import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../hooks/useSocket'
import { Send, Search, User, Users, ArrowLeft, MessageSquare, ShieldAlert, Paperclip, Download, FileIcon, Check, Tv, Plus, X } from 'lucide-react'
import axios from 'axios'
import { getOrCreateKeyPair, encryptMessage, decryptMessage, isEnvelope, encryptGroupMessage, decryptGroupMessage } from '../lib/dmCrypto'
import { useDmFiles } from '../hooks/useDmFiles'
import { useGroups } from '../hooks/useGroups'
import { formatFileSize as formatSize } from '../context/TransfersContext'

export default function Messages() {
  const { user, isGuest } = useAuth()
  const socket = useSocket()
  const { transfers, sendFile, acceptFile, declineFile, hydrate } = useDmFiles({ socket, me: user })
  const { groups, createGroup } = useGroups({ socket, enabled: !isGuest })
  const attachRef = useRef(null)
  const navigate = useNavigate()
  const [partyInvites, setPartyInvites] = useState([]) // {from, fromUsername, roomId}

  // Group DM state. selectedGroup takes over the main pane when set.
  const [selectedGroup, setSelectedGroup] = useState(null)
  const selectedGroupRef = useRef(null)
  selectedGroupRef.current = selectedGroup
  const [groupMessages, setGroupMessages] = useState([])
  const [showNewGroup, setShowNewGroup] = useState(false)
  const [groupName, setGroupName] = useState('')
  const [groupPicks, setGroupPicks] = useState([]) // [{id, username}]
  const [groupSearch, setGroupSearch] = useState('')
  const [groupSearchResults, setGroupSearchResults] = useState([])

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

  // Selecting a 1:1 and a group are mutually exclusive in the main pane.
  const openUser = (u) => { setSelectedGroup(null); setSelectedUser(u) }
  const openGroup = (g) => { setSelectedUser(null); setSelectedGroup(g) }

  useEffect(() => {
    if (selectedGroup) fetchGroupMessages(selectedGroup.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGroup?.id])

  // Live group messages for the open group.
  useEffect(() => {
    if (!socket) return
    const onGroupMsg = async ({ groupId, id, from, body, timestamp, kind }) => {
      const g = selectedGroupRef.current
      if (!g || g.id !== groupId) return
      const text = kind === 'text'
        ? await decryptGroupMessage(keysRef.current?.privateKey, g.members, user.id, from.id, body)
        : body
      setGroupMessages((p) => [...p, { id, from, text, timestamp, kind }])
    }
    socket.on('group-message', onGroupMsg)
    return () => socket.off('group-message', onGroupMsg)
  }, [socket, user?.id])

  const fetchGroupMessages = async (groupId) => {
    try {
      const res = await axios.get(`/api/groups/${groupId}/messages`)
      const g = res.data.group // fresh roster + public keys
      const priv = keysRef.current?.privateKey
      const decrypted = await Promise.all(res.data.messages.map(async (m) => ({
        ...m,
        text: m.kind === 'text'
          ? await decryptGroupMessage(priv, g.members, user.id, m.from.id, m.body)
          : m.body,
      })))
      setGroupMessages(decrypted)
      // Keep members/keys current without retriggering the fetch effect (keyed on id).
      setSelectedGroup((cur) => (cur && cur.id === g.id ? g : cur))
    } catch (err) {
      console.error('Failed to load group')
    }
  }

  const sendGroupMessage = async (e) => {
    e.preventDefault()
    const g = selectedGroup
    if (!newMessage.trim() || !g || !socket) return
    const timestamp = Date.now()
    const plaintext = newMessage
    let body = plaintext
    if (keysRef.current) {
      try {
        body = await encryptGroupMessage(keysRef.current.privateKey, g.members, user.id, plaintext)
      } catch (err) {
        console.error('Group encryption failed, not sending:', err)
        return
      }
    }
    socket.emit('group-message', { groupId: g.id, body, timestamp })
    setGroupMessages((p) => [...p, { id: `local-${timestamp}`, from: { id: user.id, username: user.username }, text: plaintext, timestamp, kind: 'text' }])
    setNewMessage('')
  }

  const handleGroupSearch = async (e) => {
    const q = e.target.value
    setGroupSearch(q)
    if (q.length > 2) {
      try {
        const res = await axios.get(`/api/users/search?query=${q}`)
        setGroupSearchResults(res.data.users.filter((u) => u.id !== user.id))
      } catch {}
    } else {
      setGroupSearchResults([])
    }
  }

  const togglePick = (u) => {
    setGroupPicks((p) => (p.some((x) => x.id === u.id) ? p.filter((x) => x.id !== u.id) : [...p, { id: u.id, username: u.username }]))
  }

  const submitNewGroup = async () => {
    if (groupPicks.length === 0) return
    const name = groupName.trim() || groupPicks.map((p) => p.username).join(', ').slice(0, 80)
    try {
      const g = await createGroup(name, groupPicks.map((p) => p.id))
      setShowNewGroup(false)
      setGroupName(''); setGroupPicks([]); setGroupSearch(''); setGroupSearchResults([])
      openGroup(g)
    } catch (err) {
      console.error('Failed to create group')
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
            <h2 className="text-sm font-bold uppercase tracking-wider flex-1" style={{ color: 'var(--text-primary)' }}>Messages</h2>
            <button
              type="button"
              onClick={() => setShowNewGroup(true)}
              className="btn btn-secondary !px-2.5 h-8 text-[11px] inline-flex items-center gap-1"
              title="New group"
              data-testid="new-group"
            >
              <Users size={14} /> Group
            </button>
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
                onClick={() => { openUser(u); setSearchResults([]); setSearchQuery('') }}
                className="p-3.5 cursor-pointer flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
              >
                <div className="w-9 h-9 rounded-xl grid place-items-center font-bold" style={{ background: 'rgb(var(--accent) / 0.15)', color: 'rgb(var(--accent))' }}>
                  <User size={18} />
                </div>
                <div className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{u.username}</div>
              </div>
            ))
          ) : (groups.length > 0 || mergedConvos.length > 0) ? (
            <>
            {groups.map(group => (
              <div
                key={group.id}
                onClick={() => openGroup(group)}
                className="p-4 cursor-pointer flex items-center gap-3 transition-colors"
                data-testid="group-convo"
                style={selectedGroup?.id === group.id
                  ? { background: 'rgb(var(--accent) / 0.1)', borderLeft: '2px solid rgb(var(--accent))' }
                  : undefined}
              >
                <div className="w-10 h-10 rounded-xl grid place-items-center shrink-0" style={{ background: 'rgb(var(--accent) / 0.15)', color: 'rgb(var(--accent))' }}>
                  <Users size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline mb-0.5">
                    <span className="text-xs font-bold truncate" style={{ color: 'var(--text-primary)' }}>{group.name}</span>
                    {group.lastMessage && (
                      <span className="text-[9px] shrink-0 font-mono" style={{ color: 'var(--text-secondary)' }}>
                        {new Date(group.lastMessage.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] truncate" style={{ color: 'var(--text-secondary)' }}>
                    {group.members.length} members
                  </p>
                </div>
              </div>
            ))}
            {mergedConvos.map(conv => (
              <div
                key={conv.user.id}
                onClick={() => openUser(conv.user)}
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
            ))}
            </>
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
        {selectedGroup ? (
          <>
            <header className="p-4 border-b flex items-center gap-3" style={{ borderColor: 'var(--border)' }}>
              <div className="w-9 h-9 rounded-xl grid place-items-center" style={{ background: 'rgb(var(--accent) / 0.15)', color: 'rgb(var(--accent))' }}>
                <Users size={18} />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold truncate" style={{ color: 'var(--text-primary)' }} data-testid="group-title">{selectedGroup.name}</div>
                <div className="text-[10px] truncate" style={{ color: 'var(--text-secondary)' }}>
                  {selectedGroup.members.map((m) => m.username).join(', ')}
                </div>
              </div>
            </header>

            <main className="flex-1 overflow-y-auto p-6 flex flex-col gap-3">
              {groupMessages.map((msg, i) => {
                const isMe = msg.from.id === user.id
                return (
                  <div key={msg.id || i} className={`flex flex-col max-w-[75%] ${isMe ? 'self-end items-end' : 'self-start items-start'}`} data-testid="group-message">
                    {!isMe && <span className="text-[9px] font-bold mb-0.5 px-1" style={{ color: 'rgb(var(--accent))' }}>{msg.from.username}</span>}
                    <div className="px-4 py-2.5 text-xs"
                      style={isMe
                        ? { background: 'rgb(var(--accent))', color: '#1a0f0d', borderRadius: 'var(--radius)', borderTopRightRadius: 4 }
                        : { background: 'var(--surface-raised)', color: 'var(--text-primary)', borderRadius: 'var(--radius)', borderTopLeftRadius: 4 }}>
                      {msg.text}
                    </div>
                    <span className="text-[9px] font-mono mt-1 px-1" style={{ color: 'var(--text-secondary)' }}>
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                )
              })}
              <div ref={messagesEndRef} />
            </main>

            <form onSubmit={sendGroupMessage} className="p-4 border-t flex gap-2 items-center" style={{ borderColor: 'var(--border)' }}>
              <input
                type="text"
                className="input-field flex-1 h-11"
                placeholder="Message the group…"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                data-testid="group-input"
              />
              <button type="submit" className="btn btn-primary w-11 h-11 !p-0 shrink-0" data-testid="group-send"><Send size={16} /></button>
            </form>
          </>
        ) : selectedUser ? (
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

      {/* New group modal */}
      {showNewGroup && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4" style={{ background: 'rgb(0 0 0 / 0.5)' }} onClick={() => setShowNewGroup(false)}>
          <div className="glass-card w-full max-w-md p-6" onClick={(e) => e.stopPropagation()} data-testid="new-group-modal">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>New group</h3>
              <button onClick={() => setShowNewGroup(false)} className="nav-item !px-2 !py-2"><X size={16} /></button>
            </div>
            <input className="input-field h-10 mb-3" placeholder="Group name (optional)" value={groupName} onChange={(e) => setGroupName(e.target.value)} data-testid="new-group-name" />
            {groupPicks.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {groupPicks.map((p) => (
                  <span key={p.id} className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-lg" style={{ background: 'rgb(var(--accent) / 0.15)', color: 'rgb(var(--accent))' }}>
                    {p.username}
                    <button type="button" onClick={() => togglePick(p)}><X size={11} /></button>
                  </span>
                ))}
              </div>
            )}
            <div className="relative mb-2">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-secondary)' }} />
              <input className="input-field pl-9 h-10" placeholder="Add people…" value={groupSearch} onChange={handleGroupSearch} data-testid="new-group-search" />
            </div>
            <div className="max-h-48 overflow-y-auto mb-4">
              {groupSearchResults.map((u) => {
                const picked = groupPicks.some((x) => x.id === u.id)
                return (
                  <div key={u.id} onClick={() => togglePick(u)} className="p-2.5 cursor-pointer flex items-center gap-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/40" data-testid="new-group-result">
                    <div className="w-8 h-8 rounded-lg grid place-items-center" style={{ background: 'rgb(var(--accent) / 0.15)', color: 'rgb(var(--accent))' }}><User size={16} /></div>
                    <span className="text-xs font-bold flex-1" style={{ color: 'var(--text-primary)' }}>{u.username}</span>
                    {picked && <Check size={14} style={{ color: 'rgb(var(--accent))' }} />}
                  </div>
                )
              })}
            </div>
            <button onClick={submitNewGroup} disabled={groupPicks.length === 0} className="btn btn-primary w-full h-11 text-xs disabled:opacity-40" data-testid="new-group-create">
              Create group{groupPicks.length > 0 ? ` (${groupPicks.length + 1})` : ''}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
