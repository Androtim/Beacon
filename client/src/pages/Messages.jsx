import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../hooks/useSocket'
import { Send, Search, User, ArrowLeft, MoreVertical, MessageSquare, ShieldAlert } from 'lucide-react'
import axios from 'axios'

export default function Messages() {
  const { user, isGuest } = useAuth()
  const socket = useSocket()
  const [conversations, setConversations] = useState([])
  const [selectedUser, setSelectedUser] = useState(null)
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const messagesEndRef = useRef(null)

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

    socket.on('private-message', ({ from, message, timestamp }) => {
      if (selectedUser && from.id === selectedUser.id) {
        setMessages(prev => [...prev, { from: { id: from.id }, message, timestamp }])
      }
      fetchConversations()
    })

    return () => socket.off('private-message')
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
      setMessages(res.data.messages)
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

  const sendMessage = (e) => {
    e.preventDefault()
    if (!newMessage.trim() || !selectedUser || !socket) return

    const timestamp = Date.now()
    socket.emit('private-message', { to: selectedUser.id, message: newMessage, timestamp })
    setMessages(prev => [...prev, { from: { id: user.id }, message: newMessage, timestamp }])
    setNewMessage('')
    fetchConversations()
  }

  if (isGuest) {
    return (
      <div className="max-w-[600px] mx-auto px-4 py-24 text-center">
        <div className="glass-card p-10 border border-slate-200/50 dark:border-slate-800">
          <ShieldAlert size={36} className="mx-auto mb-4 text-blue-500" />
          <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-2 uppercase tracking-wide">Direct messages need an account</h2>
          <p className="text-xs text-slate-400 dark:text-slate-500 mb-8 leading-relaxed">
            You're browsing as <span className="font-mono text-slate-600 dark:text-slate-300">{user?.username}</span>.
            Watch parties and file sharing work without an account, but private messages need a persistent identity
            so friends can find you and your history survives.
          </p>
          <Link to="/signup" className="btn btn-primary px-8 h-11 text-xs uppercase tracking-wider inline-flex items-center">
            Create an account
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-[1200px] mx-auto px-4 py-8 h-[calc(100vh-4rem)] flex gap-6">

      {/* Contact Sidebar */}
      <div className="w-80 glass-card flex flex-col overflow-hidden border border-slate-200/50 dark:border-slate-800">
        
        {/* Search header */}
        <div className="p-4 border-b border-slate-200/50 dark:border-slate-800 space-y-4">
          <div className="flex items-center gap-3">
            <Link to="/" className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-550 dark:text-slate-400 rounded-lg transition-colors">
              <ArrowLeft size={16} />
            </Link>
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white">DMs Terminal</h2>
          </div>
          
          <div className="relative">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              className="input-field pl-9 pr-4 h-10" 
              placeholder="Search contacts..."
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
                <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold">
                  <User size={18} />
                </div>
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200">{u.username}</div>
              </div>
            ))
          ) : conversations.length > 0 ? (
            conversations.map(conv => (
              <div 
                key={conv.user.id} 
                onClick={() => setSelectedUser(conv.user)}
                className={`p-4 cursor-pointer flex items-center gap-3 transition-colors ${
                  selectedUser?.id === conv.user.id 
                    ? 'bg-blue-500/5 dark:bg-indigo-500/5 border-l-2 border-blue-500 dark:border-indigo-500' 
                    : 'hover:bg-slate-50/50 dark:hover:bg-slate-800/20'
                }`}
              >
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-indigo-400 flex items-center justify-center flex-shrink-0">
                  <User size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline mb-0.5">
                    <span className="text-xs font-bold text-slate-900 dark:text-white truncate">{conv.user.username}</span>
                    <span className="text-[9px] text-slate-400 shrink-0 font-mono">
                      {new Date(conv.lastMessage.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-450 truncate">
                    {conv.lastMessage.message}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="p-8 text-center text-slate-400 dark:text-slate-500 mt-10">
              <MessageSquare className="mx-auto mb-3 opacity-20" size={24} />
              <p className="text-[10px] font-bold uppercase tracking-wider">No active channels</p>
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 glass-card flex flex-col overflow-hidden bg-slate-50/20 dark:bg-slate-900/10 border border-slate-200/50 dark:border-slate-800 shadow-xl">
        {selectedUser ? (
          <>
            {/* Header */}
            <header className="p-4 bg-white/50 dark:bg-slate-900/60 border-b border-slate-200/50 dark:border-slate-850 flex justify-between items-center backdrop-blur-md">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-indigo-400 flex items-center justify-center">
                  <User size={18} />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">{selectedUser.username}</div>
                  <div className="text-[9px] font-black text-emerald-500 flex items-center gap-1 uppercase tracking-wider">
                    <span className="inline-block w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                    Tunnel Secure
                  </div>
                </div>
              </div>
              <button className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg">
                <MoreVertical size={16} />
              </button>
            </header>

            {/* Message Feed */}
            <main className="flex-1 overflow-y-auto p-6 flex flex-col gap-4 bg-slate-100/10">
              {messages.map((msg, i) => {
                const isMe = msg.from.id === user.id
                return (
                  <div 
                    key={i} 
                    className={`flex flex-col max-w-[75%] ${
                      isMe ? 'self-end items-end' : 'self-start items-start'
                    }`}
                  >
                    <div className={`px-4 py-2.5 rounded-2xl text-xs shadow-sm ${
                      isMe 
                        ? 'bg-blue-600 text-white rounded-tr-none' 
                        : 'bg-white dark:bg-slate-850 text-slate-850 dark:text-slate-150 rounded-tl-none border border-slate-200/40 dark:border-slate-800'
                    }`}>
                      {msg.message}
                    </div>
                    <span className="text-[9px] text-slate-400 font-mono mt-1 px-1">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                )
              })}
              <div ref={messagesEndRef} />
            </main>

            {/* Input form */}
            <form onSubmit={sendMessage} className="p-4 bg-white/50 dark:bg-slate-900/60 border-t border-slate-200/50 dark:border-slate-850 flex gap-3 items-center">
              <input 
                type="text" 
                className="input-field flex-1 h-11" 
                placeholder="Send secure transmission..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
              />
              <button type="submit" className="btn btn-primary w-11 h-11 rounded-xl !p-0 shrink-0">
                <Send size={16} />
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 p-8">
            <MessageSquare size={48} className="mb-4 opacity-15" />
            <p className="text-xs font-bold uppercase tracking-wider">Select operative to begin communication</p>
          </div>
        )}
      </div>
    </div>
  )
}
