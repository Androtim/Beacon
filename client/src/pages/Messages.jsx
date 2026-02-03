import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../hooks/useSocket'
import { Send, User, Search, Circle, ArrowLeft, Loader, Video, MessageSquare, Zap, Shield, Plus, ChevronRight, Settings, LogOut } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import axios from 'axios'

export default function Messages() {
  const { user, logout } = useAuth()
  const socket = useSocket()
  const navigate = useNavigate()
  const [searchResults, setSearchResults] = useState([])
  const [selectedUser, setSelectedUser] = useState(null)
  const [messages, setMessages] = useState({})
  const [newMessage, setNewMessage] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [conversations, setConversations] = useState([]) 
  const [loadingConversations, setLoadingConversations] = useState(true)
  const messagesEndRef = useRef(null)
  const searchTimeoutRef = useRef(null)

  const scrollToBottom = () => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }

  useEffect(() => { scrollToBottom() }, [messages, selectedUser])
  
  useEffect(() => {
    const loadConversations = async () => {
      try {
        const res = await axios.get('/api/conversations')
        const convUsers = res.data.conversations.map(c => ({ 
          id: c.user.id || c.user._id,
          username: c.user.username,
          lastMessage: c.lastMessage, 
          unreadCount: c.unreadCount 
        }))
        setConversations(convUsers)
      } catch (e) { console.error(e) } finally { setLoadingConversations(false) }
    }
    if (user?.id) loadConversations()
  }, [user])
  
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    if (!searchQuery.trim()) { setSearchResults([]); setHasSearched(false); return }
    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true)
      try {
        const res = await axios.get(`/api/users/search?query=${searchQuery}`)
        setSearchResults(res.data.users
          .map(u => ({ ...u, id: u.id || u._id }))
          .filter(u => u.id !== user.id)
        )
        setHasSearched(true)
      } catch (e) { setSearchResults([]) } finally { setIsSearching(false) }
    }, 500)
  }, [searchQuery, user.id])

  useEffect(() => {
    if (!socket) return
    socket.on('private-message', ({ from, message, timestamp }) => {
      const fromId = from.id || from._id
      setMessages(prev => ({ ...prev, [fromId]: [...(prev[fromId] || []), { from, message, timestamp, isOwn: false }] }))
      setConversations(prev => {
        if (!prev.find(u => u.id === fromId)) return [...prev, { ...from, id: fromId }]
        return prev
      })
    })
    return () => { socket.off('private-message') }
  }, [socket])

  const sendMessage = (e) => {
    if (e) e.preventDefault()
    if (!newMessage.trim() || !selectedUser) return
    const timestamp = Date.now()
    socket.emit('private-message', { to: selectedUser.id, message: newMessage, timestamp })
    setMessages(prev => ({ ...prev, [selectedUser.id]: [...(prev[selectedUser.id] || []), { from: user, message: newMessage, timestamp, isOwn: true }] }))
    if (!conversations.find(u => u.id === selectedUser.id)) setConversations(prev => [...prev, selectedUser])
    setNewMessage('')
  }

  const startWatchParty = () => {
    const code = `OP-${Math.random().toString(36).substring(2, 6).toUpperCase()}`
    const invite = `📡 OPERATOR INVITE: Establish Sync Coordinates. Link: ${code}`
    socket.emit('private-message', { to: selectedUser.id, message: invite, timestamp: Date.now() })
    setMessages(prev => ({ ...prev, [selectedUser.id]: [...(prev[selectedUser.id] || []), { from: user, message: invite, timestamp: Date.now(), isOwn: true }] }))
    navigate(`/party/${code}`)
  }

  const formatTime = (ts) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="min-h-screen relative overflow-hidden bg-[#0F172A] text-slate-200 selection:bg-violet-500/30">
      <div className="orb w-[500px] h-[500px] bg-violet-600/10 top-[-200px] left-[-100px]" />
      <div className="orb w-[400px] h-[400px] bg-cyan-500/10 bottom-[-100px] right-[-100px]" />

      <div className="max-w-7xl mx-auto h-[100dvh] flex flex-col relative z-10 p-4 sm:p-6 lg:px-8">
        <header className="glass-card px-6 py-4 flex items-center justify-between mb-6 border-white/5 shrink-0">
          <div className="flex items-center gap-6">
            <Link to="/" className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center hover:bg-white/10 border border-white/5 transition-all"><ArrowLeft className="h-5 w-5 text-slate-400" /></Link>
            <div className="h-8 w-px bg-white/10 hidden sm:block" />
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-br from-violet-500 to-cyan-400 rounded-xl flex items-center justify-center shadow-lg shadow-violet-500/20"><MessageSquare className="h-5 w-5 text-white" /></div>
              <h1 className="text-xl font-bold tracking-tighter text-white uppercase">Network Comms</h1>
            </div>
          </div>
        </header>

        <div className="flex-1 flex gap-6 min-h-0 overflow-hidden">
          <aside className={`w-full lg:w-80 shrink-0 flex flex-col gap-6 ${selectedUser ? 'hidden lg:flex' : 'flex'}`}>
            <div className="glass-card flex-1 flex flex-col overflow-hidden border-white/5 shadow-xl">
              <div className="p-4 border-b border-white/5 bg-white/5">
                <div className="relative group">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 group-focus-within:text-violet-400 transition-colors" />
                  <input type="text" placeholder="SCAN OPERATORS..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="glass-input !pl-10 !py-3 text-[10px] font-mono uppercase tracking-widest" />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                {searchQuery ? (
                  <div className="animate-in fade-in slide-in-from-top-1 duration-300">
                    <div className="px-5 py-3 text-[9px] font-bold text-slate-500 uppercase tracking-[0.3em] bg-white/5">Scan Results</div>
                    {searchResults.map(u => ( <UserItem key={u.id} user={u} active={selectedUser?.id === u.id} onClick={() => setSelectedUser(u)} /> ))}
                  </div>
                ) : (
                  <div className="animate-in fade-in duration-500">
                    <div className="px-5 py-3 text-[9px] font-bold text-slate-500 uppercase tracking-[0.3em] bg-white/5">Active Links</div>
                    {loadingConversations ? ( <div className="p-8 text-center"><Loader className="h-6 w-6 text-violet-500 animate-spin mx-auto" /></div>
                    ) : conversations.length > 0 ? ( conversations.map(u => ( <UserItem key={u.id} user={u} active={selectedUser?.id === u.id} onClick={() => setSelectedUser(u)} /> ))
                    ) : ( <div className="p-10 text-center opacity-30"><Shield className="h-10 w-10 mx-auto mb-4" /><p className="text-[10px] font-bold uppercase tracking-widest">No Active Sessions</p></div> )}
                  </div>
                )}
              </div>
            </div>
          </aside>

          <main className={`flex-1 flex flex-col min-w-0 ${selectedUser ? 'flex' : 'hidden lg:flex'}`}>
            {selectedUser ? (
              <div className="glass-card flex-1 flex flex-col overflow-hidden border-white/5 shadow-2xl">
                <div className="px-6 py-4 border-b border-white/5 bg-white/5 flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-4">
                    <button onClick={() => setSelectedUser(null)} className="lg:hidden p-2 hover:bg-white/5 rounded-xl mr-2 border border-white/5"><ArrowLeft size={18} /></button>
                    <div className="relative">
                      <div className="w-11 h-11 bg-gradient-to-br from-violet-500/20 to-cyan-500/20 rounded-xl flex items-center justify-center border border-white/10"><User className="h-5 w-5 text-violet-400" /></div>
                      <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-4 border-[#0F172A] ${selectedUser.isOnline ? 'bg-green-500' : 'bg-slate-600'}`} />
                    </div>
                    <div><p className="font-bold text-white uppercase tracking-tighter text-lg">{selectedUser.username}</p><p className="text-[9px] text-slate-500 font-bold uppercase tracking-[0.2em]">{selectedUser.isOnline ? 'Link Active' : 'Offline'}</p></div>
                  </div>
                  <button onClick={startWatchParty} className="glass-button !py-2.5 !px-5 !from-violet-600 !to-violet-500 text-[10px] tracking-[0.2em] shadow-lg shadow-violet-500/20"><Video size={14} className="mr-2" /> INITIALIZE PARTY</button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-black/20 custom-scrollbar">
                  {messages[selectedUser.id]?.map((msg, i) => (
                    <div key={i} className={`flex ${msg.isOwn ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] group flex flex-col ${msg.isOwn ? 'items-end' : 'items-start'}`}>
                        <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-lg ${msg.isOwn ? 'bg-gradient-to-br from-violet-600 to-violet-500 text-white rounded-tr-none shadow-violet-900/20' : 'bg-white/5 text-slate-200 rounded-tl-none border border-white/5'}`}>
                           <p className="whitespace-pre-wrap">{msg.message}</p>
                        </div>
                        <span className="text-[8px] font-mono text-slate-600 mt-1.5 px-1 opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-widest">{formatTime(msg.timestamp)}</span>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
                <form onSubmit={sendMessage} className="p-5 bg-white/5 border-t border-white/5 flex gap-4">
                  <input type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="ENTER COMMAND..." className="flex-1 glass-input !py-4 !px-6 text-sm font-medium tracking-wide" />
                  <button type="submit" disabled={!newMessage.trim()} className="w-14 h-14 glass-button !from-cyan-500 !to-cyan-400 shadow-cyan-500/20 active:scale-95 transition-transform"><Send size={22} /></button>
                </form>
              </div>
            ) : (
              <div className="glass-card flex-1 flex flex-col items-center justify-center text-center p-12 border-white/5">
                <Zap className="h-12 w-12 text-slate-700 animate-pulse mb-6" />
                <h3 className="text-2xl font-bold text-white uppercase tracking-tight">Operator Directory</h3>
                <p className="text-slate-500 max-w-sm mx-auto text-sm leading-relaxed mt-4">Select a network operator from the directory or scan the network to establish a link.</p>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  )
}

function UserItem({ user, active, onClick }) {
  return (
    <div onClick={onClick} className={`group flex items-center p-5 hover:bg-white/5 cursor-pointer transition-all border-l-2 ${active ? 'bg-white/5 border-violet-500' : 'border-transparent'}`}>
      <div className="relative mr-5">
        <div className={`w-11 h-11 bg-white/5 rounded-xl flex items-center justify-center border transition-all duration-300 ${active ? 'border-violet-500/50 shadow-lg' : 'border-white/5'}`}><User className={`h-5 w-5 ${active ? 'text-violet-400' : 'text-slate-500 group-hover:text-slate-300'}`} /></div>
        <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#0F172A] ${user.isOnline ? 'bg-green-500' : 'bg-slate-600'}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`font-bold truncate text-sm uppercase tracking-tight transition-colors ${active ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'}`}>{user.username}</p>
        <p className="text-[9px] text-slate-600 font-bold uppercase tracking-widest mt-1">{user.isOnline ? 'Online' : 'Offline'}</p>
      </div>
    </div>
  )
}
