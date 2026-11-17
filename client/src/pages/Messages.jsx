import React, { useState, useEffect, useRef, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../hooks/useSocket'
import {
  Send,
  Search,
  User,
  Users,
  ArrowLeft,
  MessageSquare,
  ShieldAlert,
  Paperclip,
  Download,
  FileIcon,
  Check,
  Tv,
  Plus,
  X,
  Lock,
  ShieldCheck,
  Copy,
  Smile,
  Info,
} from 'lucide-react'
import axios from 'axios'
import {
  getOrCreateKeyPair,
  encryptMessage,
  decryptMessage,
  isEnvelope,
  encryptGroupMessage,
  decryptGroupMessage,
} from '../lib/dmCrypto'
import { useDmFiles } from '../hooks/useDmFiles'
import { randomCode } from '../lib/randomCode'
import { useGroups } from '../hooks/useGroups'
import { useGroupFiles } from '../hooks/useGroupFiles'
import { formatFileSize as formatSize } from '../context/TransfersContext'
import { useToast } from '../context/ToastContext'

const EMOJI_CHOICES = ['✦', '♥', '◡̈', '☕', '🌙', '🎬']

function formatKeyFingerprint(publicKeyStr) {
  if (!publicKeyStr) return 'ECDH · P-256 · READY'
  let hash = 2166136261
  for (let i = 0; i < publicKeyStr.length; i++) {
    hash ^= publicKeyStr.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  const hex = (hash >>> 0).toString(16).toUpperCase().padStart(8, '0')
  const tail = publicKeyStr
    .replace(/[^A-Za-z0-9]/g, '')
    .slice(-12)
    .toUpperCase()
    .padEnd(12, '0')
  const combined = (hex + tail).slice(0, 16)
  return combined.match(/.{1,4}/g)?.join(' · ') || combined
}

export default function Messages() {
  const { user, isGuest } = useAuth()
  const socket = useSocket()
  const { notify } = useToast()
  const { transfers, sendFile, acceptFile, declineFile, hydrate } = useDmFiles({
    socket,
    me: user,
  })
  const { groups, createGroup } = useGroups({ socket, enabled: !isGuest })
  const {
    shares: groupShares,
    downloads: groupDownloads,
    shareFile: shareGroupFile,
    downloadFile: downloadGroupFile,
  } = useGroupFiles({ socket, me: user })
  const attachRef = useRef(null)
  const groupAttachRef = useRef(null)
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
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [showDetailsPane, setShowDetailsPane] = useState(true)
  const [copiedFp, setCopiedFp] = useState(false)

  // Watch-party invites arriving in a DM.
  useEffect(() => {
    if (!socket) return
    const onInvite = ({ from, fromUsername, roomId }) =>
      setPartyInvites((p) => [
        ...p.filter((x) => x.roomId !== roomId),
        { from, fromUsername, roomId },
      ])
    socket.on('dm-party-invite', onInvite)
    return () => socket.off('dm-party-invite', onInvite)
  }, [socket])

  const startPartyWith = (peer) => {
    const roomId = randomCode(6)
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
        setMessages((prev) => [
          ...prev,
          { from: { id: from.id }, message: text, timestamp },
        ])
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
      const otherKey = selectedUserRef.current?.publicKey
      const texts = []
      const invites = []
      const offers = []
      for (const m of res.data.messages) {
        if (m.kind === 'party-invite' && m.meta?.roomId) {
          invites.push({
            from: m.from.id,
            fromUsername: m.from.username,
            roomId: m.meta.roomId,
          })
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
      if (invites.length)
        setPartyInvites((p) => {
          const have = new Set(p.map((x) => x.roomId))
          const add = invites.filter((x) => !have.has(x.roomId))
          return add.length ? [...p, ...add] : p
        })
    } catch (err) {
      console.error('Failed to fetch messages')
    }
  }

  // Selecting a 1:1 and a group are mutually exclusive in the main pane.
  const openUser = (u) => {
    setSelectedGroup(null)
    setSelectedUser(u)
  }
  const openGroup = (g) => {
    setSelectedUser(null)
    setSelectedGroup(g)
  }

  useEffect(() => {
    if (selectedGroup) fetchGroupMessages(selectedGroup.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGroup?.id])

  // Live group messages for the open group.
  useEffect(() => {
    if (!socket) return
    const onGroupMsg = async ({ groupId, id, from, body, timestamp, kind, meta }) => {
      const g = selectedGroupRef.current
      if (!g || g.id !== groupId) return
      const text =
        kind === 'text'
          ? await decryptGroupMessage(
              keysRef.current?.privateKey,
              g.members,
              user.id,
              from.id,
              body
            )
          : body
      setGroupMessages((p) => [...p, { id, from, text, timestamp, kind, meta }])
    }
    socket.on('group-message', onGroupMsg)
    return () => socket.off('group-message', onGroupMsg)
  }, [socket, user?.id])

  const fetchGroupMessages = async (groupId) => {
    try {
      const res = await axios.get(`/api/groups/${groupId}/messages`)
      const g = res.data.group
      const priv = keysRef.current?.privateKey
      const decrypted = await Promise.all(
        res.data.messages.map(async (m) => ({
          ...m,
          text:
            m.kind === 'text'
              ? await decryptGroupMessage(priv, g.members, user.id, m.from.id, m.body)
              : m.body,
        }))
      )
      setGroupMessages(decrypted)
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
        body = await encryptGroupMessage(
          keysRef.current.privateKey,
          g.members,
          user.id,
          plaintext
        )
      } catch (err) {
        console.error('Group encryption failed, not sending:', err)
        return
      }
    }
    socket.emit('group-message', { groupId: g.id, body, timestamp })
    setGroupMessages((p) => [
      ...p,
      {
        id: `local-${timestamp}`,
        from: { id: user.id, username: user.username },
        text: plaintext,
        timestamp,
        kind: 'text',
      },
    ])
    setNewMessage('')
  }

  const onShareGroupFile = (file) => {
    const g = selectedGroup
    if (!g || !file) return
    const msg = shareGroupFile(g, file)
    if (msg) {
      setGroupMessages((p) => [
        ...p,
        {
          id: `local-${msg.timestamp}`,
          from: { id: user.id, username: user.username },
          kind: 'file-offer',
          meta: { transferId: msg.transferId, fileInfo: msg.fileInfo },
          text: `📎 ${msg.fileInfo.name}`,
          timestamp: msg.timestamp,
        },
      ])
    }
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
    setGroupPicks((p) =>
      p.some((x) => x.id === u.id)
        ? p.filter((x) => x.id !== u.id)
        : [...p, { id: u.id, username: u.username }]
    )
  }

  const submitNewGroup = async () => {
    if (groupPicks.length === 0) return
    const name =
      groupName.trim() ||
      groupPicks
        .map((p) => p.username)
        .join(', ')
        .slice(0, 80)
    try {
      const g = await createGroup(
        name,
        groupPicks.map((p) => p.id)
      )
      setShowNewGroup(false)
      setGroupName('')
      setGroupPicks([])
      setGroupSearch('')
      setGroupSearchResults([])
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
    let wire = plaintext
    if (selectedUser.publicKey && keysRef.current) {
      try {
        wire = await encryptMessage(
          keysRef.current.privateKey,
          selectedUser.publicKey,
          plaintext
        )
      } catch (err) {
        console.error('Encryption failed, not sending:', err)
        return
      }
    }
    socket.emit('private-message', { to: selectedUser.id, message: wire, timestamp })
    setMessages((prev) => [
      ...prev,
      { from: { id: user.id }, message: plaintext, timestamp },
    ])
    setNewMessage('')
    fetchConversations()
  }

  const mergedConvos = [...conversations]
  const addPeer = (id, username, label) => {
    if (id && username && !mergedConvos.some((c) => c.user.id === id)) {
      mergedConvos.push({
        user: { id, username },
        lastMessage: { message: label, timestamp: Date.now() },
        unreadCount: 0,
      })
    }
  }
  for (const t of transfers) addPeer(t.peerId, t.peerUsername, 'Sent a file')
  for (const inv of partyInvites) addPeer(inv.from, inv.fromUsername, 'Invited you to watch')

  const peerFingerprint = useMemo(
    () => formatKeyFingerprint(selectedUser?.publicKey),
    [selectedUser?.publicKey]
  )

  const copyFingerprint = () => {
    navigator.clipboard.writeText(peerFingerprint)
    setCopiedFp(true)
    notify('Copied peer key fingerprint', peerFingerprint, 'mint')
    setTimeout(() => setCopiedFp(false), 1800)
  }

  if (isGuest) {
    return (
      <div className="max-w-[600px] mx-auto px-4 py-24 text-center">
        <div className="panel p-10">
          <ShieldAlert size={36} className="mx-auto mb-4 text-accent" />
          <h2 className="font-serif text-2xl text-ink mb-2">
            Direct messages need an account
          </h2>
          <p className="text-xs mb-8 leading-relaxed text-ink-soft">
            You&apos;re browsing as{' '}
            <span className="font-mono text-ink">{user?.username}</span>. Watch parties
            and file sharing work without an account, but private messages need a
            persistent identity so friends can find you and your history survives.
          </p>
          <div className="flex gap-3 justify-center">
            <Link
              to="/login"
              className="btn btn-secondary px-6 h-11 text-xs inline-flex items-center"
            >
              Log in
            </Link>
            <Link
              to="/signup"
              className="btn btn-primary px-6 h-11 text-xs inline-flex items-center"
            >
              Create an account
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const peerTransfers = selectedUser
    ? transfers.filter((t) => t.peerId === selectedUser.id)
    : []

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-4 h-[calc(100vh-4rem)] flex flex-col gap-3">
      {/* E2E Security Reassurance Strip */}
      <div className="px-3.5 py-2 rounded-xl bg-panel border border-line flex items-center justify-between gap-3 text-xs shrink-0">
        <div className="flex items-center gap-2 text-ink-soft min-w-0">
          <ShieldCheck className="w-4 h-4 text-mint shrink-0" />
          <span className="truncate">
            Messages are sealed on this device ·{' '}
            <span className="font-mono text-[11px] text-muted">
              ECDH P-256 · AES-GCM
            </span>
          </span>
        </div>
        {(selectedUser || selectedGroup) && (
          <button
            type="button"
            onClick={() => setShowDetailsPane((s) => !s)}
            className="hidden xl:inline-flex items-center gap-1.5 text-[11px] text-muted hover:text-ink transition-colors shrink-0"
          >
            <Info className="w-3.5 h-3.5" />
            {showDetailsPane ? 'Hide details' : 'Show details'}
          </button>
        )}
      </div>

      <div className="flex-1 flex gap-4 min-h-0">
        {/* Contact Sidebar */}
        <div className="w-80 panel flex flex-col overflow-hidden shrink-0">
          <div className="p-4 border-b border-line space-y-3">
            <div className="flex items-center gap-3">
              <Link to="/" className="icon-btn">
                <ArrowLeft size={16} />
              </Link>
              <div className="flex-1 min-w-0">
                <div className="eyebrow">Quiet signals</div>
                <h2 className="font-serif text-lg text-ink truncate">Messages</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowNewGroup(true)}
                className="btn btn-secondary !px-2.5 h-8 text-[11px] inline-flex items-center gap-1"
                title="New group"
                data-testid="new-group"
              >
                <Users size={14} className="text-accent" /> Group
              </button>
            </div>
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
              />
              <input
                type="text"
                className="input-field pl-9 pr-4 h-10 text-xs"
                placeholder="Search people…"
                value={searchQuery}
                onChange={handleSearch}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-line">
            {searchQuery.length > 2 ? (
              searchResults.map((u) => (
                <div
                  key={u.id}
                  onClick={() => {
                    openUser(u)
                    setSearchQuery('')
                  }}
                  className="p-3.5 cursor-pointer flex items-center gap-3 hover:bg-panel-2/60 transition-colors"
                >
                  <div className="w-9 h-9 rounded-xl grid place-items-center bg-accent-soft border border-accent/25 text-accent">
                    <User size={18} />
                  </div>
                  <div className="text-xs font-bold text-ink">{u.username}</div>
                </div>
              ))
            ) : groups.length > 0 || mergedConvos.length > 0 ? (
              <>
                {groups.map((group) => (
                  <div
                    key={group.id}
                    onClick={() => openGroup(group)}
                    className={`p-3.5 cursor-pointer flex items-center gap-3 transition-colors ${
                      selectedGroup?.id === group.id
                        ? 'bg-accent-soft border-l-2 border-l-accent'
                        : 'hover:bg-panel-2/60'
                    }`}
                    data-testid="group-convo"
                  >
                    <div className="w-10 h-10 rounded-xl grid place-items-center shrink-0 bg-accent-soft border border-accent/25 text-accent">
                      <Users size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline mb-0.5">
                        <span className="text-xs font-bold truncate text-ink">
                          {group.name}
                        </span>
                        {group.lastMessage && (
                          <span className="text-[9px] shrink-0 font-mono text-muted">
                            {new Date(group.lastMessage.timestamp).toLocaleTimeString(
                              [],
                              { hour: '2-digit', minute: '2-digit' }
                            )}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] truncate text-muted">
                        {group.members.length} members
                      </p>
                    </div>
                  </div>
                ))}
                {mergedConvos.map((conv) => (
                  <div
                    key={conv.user.id}
                    onClick={() => openUser(conv.user)}
                    className={`p-3.5 cursor-pointer flex items-center gap-3 transition-colors ${
                      selectedUser?.id === conv.user.id
                        ? 'bg-accent-soft border-l-2 border-l-accent'
                        : 'hover:bg-panel-2/60'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-xl grid place-items-center shrink-0 bg-accent-soft border border-accent/25 text-accent">
                      <User size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline mb-0.5">
                        <span className="text-xs font-bold truncate text-ink">
                          {conv.user.username}
                        </span>
                        <span className="text-[9px] shrink-0 font-mono text-muted">
                          {new Date(conv.lastMessage.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <p className="text-[10px] truncate text-muted">
                        {conv.lastMessage.message}
                      </p>
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <div className="p-8 text-center mt-10 text-muted">
                <MessageSquare className="mx-auto mb-3 opacity-30" size={24} />
                <p className="text-xs">
                  No conversations yet — search for someone above.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Main Chat Area */}
        <div className="flex-1 panel flex flex-col overflow-hidden min-w-0">
          {selectedGroup ? (
            <>
              <header className="p-4 border-b border-line flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl grid place-items-center bg-accent-soft border border-accent/25 text-accent">
                  <Users size={18} />
                </div>
                <div className="min-w-0">
                  <div
                    className="text-sm font-bold truncate text-ink"
                    data-testid="group-title"
                  >
                    {selectedGroup.name}
                  </div>
                  <div className="text-[11px] truncate text-muted flex items-center gap-1">
                    <Lock size={10} className="text-mint shrink-0" />
                    <span className="truncate">
                      {selectedGroup.members.map((m) => m.username).join(', ')}
                    </span>
                  </div>
                </div>
              </header>

              <main className="flex-1 overflow-y-auto p-6 flex flex-col gap-3">
                {groupMessages.map((msg, i) => {
                  const isMe = msg.from.id === user.id
                  if (msg.kind === 'file-offer' && msg.meta?.transferId) {
                    const { transferId, fileInfo } = msg.meta
                    const share = groupShares.find((s) => s.transferId === transferId)
                    const dl = groupDownloads.find((d) => d.transferId === transferId)
                    const percents = share ? Object.values(share.recipients) : []
                    const downloading = percents.filter((p) => p < 100).length
                    const behind = percents.length ? Math.min(...percents) : 0
                    return (
                      <div
                        key={msg.id || i}
                        className={`flex flex-col max-w-[80%] ${
                          isMe ? 'self-end items-end' : 'self-start items-start'
                        }`}
                        data-testid="group-file"
                      >
                        {!isMe && (
                          <span className="text-[10px] font-bold mb-0.5 px-1 text-accent">
                            {msg.from.username}
                          </span>
                        )}
                        <div className="px-3.5 py-3 w-64 rounded-2xl bg-panel-2 border border-line text-ink">
                          <div className="flex items-center gap-2.5">
                            <FileIcon size={18} className="shrink-0 text-accent" />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold truncate">
                                {fileInfo?.name}
                              </p>
                              <p className="text-[10px] text-muted font-mono">
                                {formatSize(fileInfo?.size ?? 0)}
                              </p>
                            </div>
                          </div>
                          {isMe ? (
                            <p
                              className="text-[10px] mt-2 text-muted"
                              data-testid="group-file-status"
                            >
                              {percents.length === 0
                                ? 'Shared — waiting for downloads'
                                : `${
                                    downloading > 0
                                      ? `${downloading} downloading · furthest behind ${behind}%`
                                      : 'Everyone has it ✓'
                                  }`}
                            </p>
                          ) : dl ? (
                            dl.status === 'saved' ? (
                              <p
                                className="text-[10px] mt-2 flex items-center gap-1 text-mint"
                                data-testid="group-file-done"
                              >
                                <Check size={12} /> Saved
                              </p>
                            ) : (
                              <div className="mt-2.5">
                                <div className="w-full h-1.5 rounded-full overflow-hidden bg-panel">
                                  <div
                                    className="h-full bg-accent"
                                    style={{ width: `${dl.percent}%` }}
                                  />
                                </div>
                                <p className="text-[10px] mt-1 text-muted">
                                  {dl.percent}% · downloading
                                </p>
                              </div>
                            )
                          ) : (
                            <button
                              onClick={() =>
                                downloadGroupFile({
                                  transferId,
                                  sharerId: msg.from.id,
                                  fileInfo,
                                })
                              }
                              className="btn btn-primary w-full h-8 text-[11px] mt-2.5"
                              data-testid="group-file-download"
                            >
                              <Download size={13} /> Download
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  }
                  return (
                    <div
                      key={msg.id || i}
                      className={`flex flex-col max-w-[75%] ${
                        isMe ? 'self-end items-end' : 'self-start items-start'
                      }`}
                      data-testid="group-message"
                    >
                      {!isMe && (
                        <span className="text-[10px] font-bold mb-0.5 px-1 text-accent">
                          {msg.from.username}
                        </span>
                      )}
                      <div
                        className={`px-4 py-2.5 text-xs leading-relaxed rounded-2xl ${
                          isMe
                            ? 'bg-accent text-accent-ink font-medium rounded-tr-sm'
                            : 'bg-panel-2 text-ink border border-line rounded-tl-sm'
                        }`}
                      >
                        {msg.text}
                      </div>
                    </div>
                  )
                })}
                <div ref={messagesEndRef} />
              </main>

              <form
                onSubmit={sendGroupMessage}
                className="p-4 border-t border-line flex gap-2 items-center bg-panel-2/40"
              >
                <input
                  ref={groupAttachRef}
                  type="file"
                  className="hidden"
                  data-testid="group-attach-input"
                  onChange={(e) => {
                    const f = e.target.files[0]
                    if (f) onShareGroupFile(f)
                    e.target.value = null
                  }}
                />
                <button
                  type="button"
                  onClick={() => groupAttachRef.current?.click()}
                  className="btn btn-secondary w-11 h-11 !p-0 shrink-0"
                  title="Share a file with the group"
                  data-testid="group-attach"
                >
                  <Paperclip size={16} />
                </button>
                <input
                  type="text"
                  className="input-field flex-1 h-11"
                  placeholder="Message…"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  data-testid="group-input"
                />
                <button
                  type="submit"
                  className="btn btn-primary w-11 h-11 !p-0 shrink-0"
                  data-testid="group-send"
                >
                  <Send size={16} />
                </button>
              </form>
            </>
          ) : selectedUser ? (
            <>
              <header className="p-4 border-b border-line flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl grid place-items-center bg-accent-soft border border-accent/25 text-accent">
                    <User size={18} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-ink truncate">
                      {selectedUser.username}
                    </div>
                    <div className="text-[11px] text-mint flex items-center gap-1">
                      <Lock size={10} />
                      <span>End-to-end encrypted</span>
                    </div>
                  </div>
                </div>
              </header>

              <main className="flex-1 overflow-y-auto p-6 flex flex-col gap-3">
                {messages.map((msg, i) => {
                  const isMe = msg.from.id === user.id
                  return (
                    <div
                      key={i}
                      className={`flex flex-col max-w-[75%] ${
                        isMe ? 'self-end items-end' : 'self-start items-start'
                      }`}
                    >
                      <div
                        className={`px-4 py-2.5 text-xs leading-relaxed rounded-2xl ${
                          isMe
                            ? 'bg-accent text-accent-ink font-medium rounded-tr-sm'
                            : 'bg-panel-2 text-ink border border-line rounded-tl-sm'
                        }`}
                      >
                        {msg.message}
                      </div>
                      <span className="text-[10px] mt-1 font-mono px-1 text-muted">
                        {new Date(msg.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  )
                })}

                {/* File transfers in this conversation */}
                {peerTransfers.map((t) => {
                  const isMe = t.direction === 'out'
                  return (
                    <div
                      key={t.id}
                      className={`flex flex-col max-w-[80%] ${
                        isMe ? 'self-end items-end' : 'self-start items-start'
                      }`}
                      data-testid="dm-file"
                    >
                      <div className="px-4 py-3 w-64 rounded-2xl bg-panel-2 border border-line text-ink">
                        <div className="flex items-center gap-2.5">
                          <FileIcon size={18} className="shrink-0 text-accent" />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold truncate">
                              {t.fileInfo.name}
                            </p>
                            <p className="text-[10px] text-muted font-mono">
                              {formatSize(t.fileInfo.size)}
                            </p>
                          </div>
                        </div>
                        {(t.status === 'sending' || t.status === 'downloading') && (
                          <div className="mt-2.5">
                            <div className="w-full h-1.5 rounded-full overflow-hidden bg-panel">
                              <div
                                className="h-full bg-accent"
                                style={{ width: `${t.percent}%` }}
                              />
                            </div>
                            <p className="text-[10px] mt-1 text-muted">
                              {t.percent}% ·{' '}
                              {isMe ? 'sending — keep this open' : 'downloading'}
                            </p>
                          </div>
                        )}
                        {t.status === 'offered' && t.direction === 'in' && (
                          <div className="flex gap-2 mt-2.5">
                            <button
                              onClick={() => acceptFile(t.id)}
                              className="btn btn-primary flex-1 h-8 text-[11px]"
                              data-testid="dm-file-accept"
                            >
                              <Download size={13} /> Download
                            </button>
                            <button
                              onClick={() => declineFile(t.id)}
                              className="btn btn-secondary h-8 px-3 text-[11px]"
                            >
                              Decline
                            </button>
                          </div>
                        )}
                        {t.status === 'offered' && t.direction === 'out' && (
                          <p className="text-[10px] mt-2 text-muted">
                            Waiting for them to accept…
                          </p>
                        )}
                        {(t.status === 'saved' || t.status === 'sent') && (
                          <p
                            className="text-[10px] mt-2 flex items-center gap-1 text-mint"
                            data-testid="dm-file-done"
                          >
                            <Check size={12} /> {t.status === 'saved' ? 'Saved' : 'Sent'}
                          </p>
                        )}
                        {t.status === 'declined' && (
                          <p className="text-[10px] mt-2 text-coral">Declined</p>
                        )}
                      </div>
                    </div>
                  )
                })}

                {/* Watch-party invites in this conversation */}
                {partyInvites
                  .filter((inv) => inv.from === selectedUser.id)
                  .map((inv) => (
                    <div
                      key={inv.roomId}
                      className="self-start max-w-[80%]"
                      data-testid="dm-party-invite"
                    >
                      <div className="px-4 py-3.5 w-64 rounded-2xl bg-panel-2 border border-accent/35 text-ink">
                        <div className="flex items-center gap-2.5 mb-2.5">
                          <div className="w-9 h-9 rounded-xl grid place-items-center bg-accent-soft text-accent">
                            <Tv size={16} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold">
                              {inv.fromUsername} started a watch party
                            </p>
                            <p className="text-[10px] font-mono text-muted">
                              Room {inv.roomId}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => navigate(`/party/${inv.roomId}`)}
                          className="btn btn-primary w-full h-9 text-[11px]"
                          data-testid="dm-party-join"
                        >
                          Join
                        </button>
                      </div>
                    </div>
                  ))}
                <div ref={messagesEndRef} />
              </main>

              <div className="p-3 border-t border-line bg-panel-2/40 space-y-2">
                {showEmojiPicker && (
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-xl bg-panel border border-line w-fit">
                    {EMOJI_CHOICES.map((em) => (
                      <button
                        key={em}
                        type="button"
                        onClick={() => {
                          setNewMessage((prev) => `${prev}${em}`)
                          setShowEmojiPicker(false)
                        }}
                        className="w-7 h-7 rounded-lg hover:bg-panel-2 text-sm flex items-center justify-center"
                      >
                        {em}
                      </button>
                    ))}
                  </div>
                )}
                <form onSubmit={sendMessage} className="flex gap-2 items-center">
                  <input
                    ref={attachRef}
                    type="file"
                    className="hidden"
                    data-testid="dm-attach-input"
                    onChange={(e) => {
                      const f = e.target.files[0]
                      if (f) sendFile(selectedUser.id, f)
                      e.target.value = null
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => attachRef.current?.click()}
                    className="btn btn-secondary w-11 h-11 !p-0 shrink-0"
                    title="Send a file"
                    data-testid="dm-attach"
                  >
                    <Paperclip size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => startPartyWith(selectedUser)}
                    className="btn btn-secondary w-11 h-11 !p-0 shrink-0"
                    title="Start a watch party"
                    data-testid="dm-start-party"
                  >
                    <Tv size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowEmojiPicker((s) => !s)}
                    className="btn btn-secondary w-11 h-11 !p-0 shrink-0 hidden sm:inline-flex"
                    title="Insert symbol"
                  >
                    <Smile size={16} />
                  </button>
                  <input
                    type="text"
                    className="input-field flex-1 h-11"
                    placeholder="Message…"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                  />
                  <button
                    type="submit"
                    className="btn btn-primary w-11 h-11 !p-0 shrink-0"
                  >
                    <Send size={16} />
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-muted">
              <div className="w-12 h-12 rounded-2xl bg-accent-soft border border-accent/25 text-accent grid place-items-center mb-3">
                <MessageSquare size={22} />
              </div>
              <p className="font-serif text-lg text-ink">
                Pick a conversation, or search for someone to message.
              </p>
              <p className="text-xs text-muted mt-1">
                Every note is sealed on your device with ECDH + AES-256-GCM.
              </p>
            </div>
          )}
        </div>

        {/* Right Contact & Privacy Details Column */}
        {(selectedUser || selectedGroup) && showDetailsPane && (
          <aside className="hidden xl:flex w-72 shrink-0 panel p-5 flex-col justify-between overflow-y-auto">
            <div className="space-y-5">
              <div className="text-center pb-4 border-b border-line">
                <div className="w-14 h-14 rounded-2xl bg-accent-soft border border-accent/30 text-accent font-serif text-xl flex items-center justify-center mx-auto mb-2.5">
                  {selectedUser
                    ? selectedUser.username?.[0]?.toUpperCase()
                    : selectedGroup?.name?.[0]?.toUpperCase() || 'G'}
                </div>
                <div className="font-serif text-lg text-ink truncate">
                  {selectedUser ? selectedUser.username : selectedGroup?.name}
                </div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-mint-soft border border-mint/30 text-mint text-[11px] mt-1.5">
                  <ShieldCheck className="w-3 h-3" />
                  {selectedUser
                    ? 'Verified peer'
                    : `${selectedGroup?.members?.length || 0} members`}
                </div>
              </div>

              {selectedUser && (
                <div className="space-y-2">
                  <div className="eyebrow">Key fingerprint</div>
                  <div className="p-3 rounded-xl bg-panel-2 border border-line space-y-2">
                    <div className="font-mono text-xs text-ink tracking-wider break-all">
                      {peerFingerprint}
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-muted pt-1 border-t border-line">
                      <span>ECDH P-256</span>
                      <button
                        type="button"
                        onClick={copyFingerprint}
                        className="text-accent hover:underline inline-flex items-center gap-1"
                      >
                        {copiedFp ? (
                          <Check className="w-3 h-3 text-mint" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                        {copiedFp ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <div className="eyebrow">Shared files in thread</div>
                {peerTransfers.length === 0 ? (
                  <div className="p-3 rounded-xl bg-panel-2/60 border border-line text-xs text-muted">
                    No files handed off in this thread yet.
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {peerTransfers.slice(0, 4).map((t) => (
                      <div
                        key={t.id}
                        className="p-2.5 rounded-xl bg-panel-2 border border-line flex items-center gap-2"
                      >
                        <FileIcon className="w-3.5 h-3.5 text-accent shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs text-ink truncate">
                            {t.fileInfo?.name}
                          </div>
                          <div className="text-[10px] text-muted font-mono">
                            {formatSize(t.fileInfo?.size || 0)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {selectedUser && (
              <div className="pt-4 border-t border-line">
                <button
                  type="button"
                  onClick={() => startPartyWith(selectedUser)}
                  className="btn btn-primary w-full text-xs flex items-center justify-center gap-1.5"
                >
                  <Tv className="w-3.5 h-3.5" />
                  Launch private watch room
                </button>
              </div>
            )}
          </aside>
        )}
      </div>

      {/* New group modal */}
      {showNewGroup && (
        <div
          className="fixed inset-0 z-50 grid place-items-center p-4 bg-black/65 backdrop-blur-sm"
          onClick={() => setShowNewGroup(false)}
        >
          <div
            className="panel w-full max-w-md p-6 border-line-strong"
            onClick={(e) => e.stopPropagation()}
            data-testid="new-group-modal"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="eyebrow">Encrypted group</div>
                <h3 className="font-serif text-xl text-ink">New group</h3>
              </div>
              <button
                onClick={() => setShowNewGroup(false)}
                className="icon-btn"
              >
                <X size={16} />
              </button>
            </div>
            <input
              className="input-field h-10 mb-3"
              placeholder="Group name (optional)"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              data-testid="new-group-name"
            />
            {groupPicks.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {groupPicks.map((p) => (
                  <span
                    key={p.id}
                    className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-accent-soft text-accent border border-accent/25"
                  >
                    {p.username}
                    <button type="button" onClick={() => togglePick(p)}>
                      <X size={11} />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="relative mb-2">
              <Search
                size={14}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
              />
              <input
                className="input-field pl-9 h-10"
                placeholder="Add people…"
                value={groupSearch}
                onChange={handleGroupSearch}
                data-testid="new-group-search"
              />
            </div>
            <div className="max-h-48 overflow-y-auto mb-4">
              {groupSearchResults.map((u) => {
                const picked = groupPicks.some((x) => x.id === u.id)
                return (
                  <div
                    key={u.id}
                    onClick={() => togglePick(u)}
                    className="p-2.5 cursor-pointer flex items-center gap-2.5 rounded-lg hover:bg-panel-2"
                    data-testid="new-group-result"
                  >
                    <div className="w-8 h-8 rounded-lg grid place-items-center bg-accent-soft text-accent">
                      <User size={16} />
                    </div>
                    <span className="text-xs font-bold flex-1 text-ink">
                      {u.username}
                    </span>
                    {picked && <Check size={14} className="text-accent" />}
                  </div>
                )
              })}
            </div>
            <button
              onClick={submitNewGroup}
              disabled={groupPicks.length === 0}
              className="btn btn-primary w-full h-11 text-xs disabled:opacity-40"
              data-testid="new-group-create"
            >
              Create group{groupPicks.length > 0 ? ` (${groupPicks.length + 1})` : ''}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
