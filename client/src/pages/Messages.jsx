import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../hooks/useSocket'
import { Send, Search, User, ArrowLeft, MoreVertical } from 'lucide-react'
import axios from 'axios'

export default function Messages() {
  const { user } = useAuth()
  const socket = useSocket()
  const [conversations, setConversations] = useState([])
  const [selectedUser, setSelectedUser] = useState(null)
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const messagesEndRef = useRef(null)

  useEffect(() => {
    fetchConversations()
  }, [])

  useEffect(() => {
    if (selectedUser) {
      fetchMessages(selectedUser.id)
    }
  }, [selectedUser])

  useEffect(() => {
    if (!socket) return

    socket.on('private-message', ({ from, message, timestamp }) => {
      if (selectedUser && from === selectedUser.id) {
        setMessages(prev => [...prev, { from: { id: from }, message, timestamp }])
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

  return (
    <div className="container" style={{ maxWidth: '1200px', height: '100vh', padding: 0, display: 'flex' }}>
      {/* Sidebar */}
      <div style={{ width: '350px', borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', backgroundColor: 'white' }}>
        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
            <Link to="/" style={{ color: '#64748b' }}><ArrowLeft size={20} /></Link>
            <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Network</h2>
          </div>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: '#94a3b8' }} />
            <input 
              type="text" 
              className="input-field" 
              style={{ paddingLeft: '2.5rem', marginBottom: 0, borderRadius: '24px', backgroundColor: '#f8fafc' }}
              placeholder="Search operatives..."
              value={searchQuery}
              onChange={handleSearch}
            />
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {searchResults.length > 0 ? (
            searchResults.map(u => (
              <div 
                key={u.id} 
                onClick={() => { setSelectedUser(u); setSearchResults([]); setSearchQuery('') }}
                style={{ padding: '1rem 1.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '1rem', borderBottom: '1px solid #f1f5f9' }}
              >
                <div style={{ width: '40px', height: '40px', backgroundColor: '#e2e8f0', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <User size={20} style={{ color: '#64748b' }} />
                </div>
                <div style={{ fontWeight: 'bold' }}>{u.username}</div>
              </div>
            ))
          ) : (
            conversations.map(conv => (
              <div 
                key={conv.user.id} 
                onClick={() => setSelectedUser(conv.user)}
                style={{ 
                  padding: '1rem 1.5rem', 
                  cursor: 'pointer', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '1rem', 
                  backgroundColor: selectedUser?.id === conv.user.id ? '#eff6ff' : 'transparent',
                  borderBottom: '1px solid #f1f5f9'
                }}
              >
                <div style={{ width: '48px', height: '48px', backgroundColor: '#dbeafe', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <User size={24} style={{ color: '#2563eb' }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                    <span style={{ fontWeight: 'bold' }}>{conv.user.username}</span>
                    <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{new Date(conv.lastMessage.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {conv.lastMessage.message}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#f8fafc' }}>
        {selectedUser ? (
          <>
            <header style={{ padding: '1rem 2rem', backgroundColor: 'white', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ width: '40px', height: '40px', backgroundColor: '#dbeafe', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <User size={20} style={{ color: '#2563eb' }} />
                </div>
                <div>
                  <div style={{ fontWeight: 'bold' }}>{selectedUser.username}</div>
                  <div style={{ fontSize: '0.75rem', color: '#22c55e' }}>Secure Channel Active</div>
                </div>
              </div>
              <button style={{ background: 'none', border: 'none', color: '#94a3b8' }}><MoreVertical size={20} /></button>
            </header>

            <main style={{ flex: 1, overflowY: 'auto', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {messages.map((msg, i) => {
                const isMe = msg.from.id === user.id
                return (
                  <div key={i} style={{ alignSelf: isMe ? 'flex-end' : 'flex-start', maxWidth: '70%' }}>
                    <div style={{ 
                      padding: '0.75rem 1.25rem', 
                      borderRadius: '20px', 
                      backgroundColor: isMe ? '#2563eb' : 'white',
                      color: isMe ? 'white' : '#1e293b',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                      fontSize: '0.9375rem'
                    }}>
                      {msg.message}
                    </div>
                    <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: '0.25rem', textAlign: isMe ? 'right' : 'left' }}>
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                )
              })}
              <div ref={messagesEndRef} />
            </main>

            <form onSubmit={sendMessage} style={{ padding: '1.5rem 2rem', backgroundColor: 'white', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '1rem' }}>
              <input 
                type="text" 
                className="input-field" 
                style={{ marginBottom: 0, borderRadius: '24px', backgroundColor: '#f1f5f9' }}
                placeholder="Message operative..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
              />
              <button type="submit" className="btn btn-primary" style={{ borderRadius: '50%', width: '45px', height: '45px', padding: 0 }}>
                <Send size={20} />
              </button>
            </form>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
            <MessageSquare size={64} style={{ marginBottom: '1.5rem', opacity: 0.2 }} />
            <p>Select a contact to begin secure transmission</p>
          </div>
        )}
      </div>
    </div>
  )
}
