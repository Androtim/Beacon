import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../hooks/useSocket'
import { Send, User, Search, Circle, ArrowLeft, Loader } from 'lucide-react'
import { Link } from 'react-router-dom'
import axios from 'axios'

export default function Messages() {
  const { user } = useAuth()
  const socket = useSocket()
  const [searchResults, setSearchResults] = useState([])
  const [selectedUser, setSelectedUser] = useState(null)
  const [messages, setMessages] = useState({})
  const [newMessage, setNewMessage] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [conversations, setConversations] = useState([]) // Users we have conversations with
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [loadingConversations, setLoadingConversations] = useState(true)
  const messagesEndRef = useRef(null)
  const searchTimeoutRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, selectedUser])
  
  // Load conversations on mount
  useEffect(() => {
    const loadConversations = async () => {
      try {
        const token = localStorage.getItem('token')
        const response = await axios.get(`${axios.defaults.baseURL}/api/conversations`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        
        // Convert conversations to user format for display
        const convUsers = response.data.conversations.map(conv => ({
          ...conv.user,
          lastMessage: conv.lastMessage,
          unreadCount: conv.unreadCount
        }))
        
        setConversations(convUsers)
        
        // Also load messages for each conversation to populate the messages state
        const messagePromises = convUsers.map(async (convUser) => {
          // Skip if user ID is undefined
          if (!convUser.id || convUser.id === 'undefined') {
            console.warn('Skipping user with undefined ID:', convUser)
            return { userId: convUser.id, messages: [] }
          }
          
          try {
            const msgResponse = await axios.get(`${axios.defaults.baseURL}/api/messages/${convUser.id}`, {
              headers: { Authorization: `Bearer ${token}` }
            })
            
            const formattedMessages = msgResponse.data.messages.map(msg => ({
              from: msg.from,
              to: msg.to,
              message: msg.message,
              timestamp: msg.timestamp,
              isOwn: msg.from.id === user.id
            }))
            
            return { userId: convUser.id, messages: formattedMessages }
          } catch (error) {
            console.error(`Error loading messages for user ${convUser.id}:`, error)
            return { userId: convUser.id, messages: [] }
          }
        })
        
        const messagesData = await Promise.all(messagePromises)
        const messagesMap = {}
        messagesData.forEach(({ userId, messages }) => {
          messagesMap[userId] = messages
        })
        
        setMessages(messagesMap)
      } catch (error) {
        console.error('Error loading conversations:', error)
      } finally {
        setLoadingConversations(false)
      }
    }
    
    if (user?.id) {
      loadConversations()
    }
  }, [user])
  
  // Load message history when selecting a user
  useEffect(() => {
    if (!selectedUser) return
    
    const loadMessageHistory = async () => {
      setLoadingMessages(true)
      try {
        const token = localStorage.getItem('token')
        const response = await axios.get(`${axios.defaults.baseURL}/api/messages/${selectedUser.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        
        // Convert messages to the expected format
        const formattedMessages = response.data.messages.map(msg => ({
          from: msg.from,
          to: msg.to,
          message: msg.message,
          timestamp: msg.timestamp,
          isOwn: msg.from.id === user.id
        }))
        
        setMessages(prev => ({
          ...prev,
          [selectedUser.id]: formattedMessages
        }))
      } catch (error) {
        console.error('Error loading message history:', error)
      } finally {
        setLoadingMessages(false)
      }
    }
    
    loadMessageHistory()
  }, [selectedUser, user.id])

  // Search for users when query changes
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    if (!searchQuery.trim()) {
      setSearchResults([])
      setHasSearched(false)
      return
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true)
      try {
        const token = localStorage.getItem('token')
        console.log('🔍 Searching for users with query:', searchQuery)
        if (!token) {
          console.error('❌ No token found in localStorage')
          return
        }
        const response = await axios.get(`/api/users/search?query=${searchQuery}`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        })
        console.log('✅ Search results:', response.data)
        setSearchResults(response.data.users.filter(u => u.id !== user.id))
        setHasSearched(true)
      } catch (error) {
        console.error('Error searching users:', error)
        setSearchResults([])
      } finally {
        setIsSearching(false)
      }
    }, 500) // Debounce search

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [searchQuery, user.id])

  useEffect(() => {
    if (!socket) return

    // Listen for new messages
    socket.on('private-message', ({ from, message, timestamp }) => {
      setMessages(prev => ({
        ...prev,
        [from.id]: [
          ...(prev[from.id] || []),
          {
            from: from,
            message,
            timestamp,
            isOwn: false
          }
        ]
      }))

      // Add sender to conversations if not already there
      setConversations(prev => {
        const exists = prev.find(u => u.id === from.id)
        if (!exists) {
          return [...prev, from]
        }
        return prev
      })
    })

    // Listen for user status changes
    socket.on('user-online', (onlineUser) => {
      if (onlineUser.id !== user.id) {
        // Update search results if they contain this user
        setSearchResults(prev => 
          prev.map(u => u.id === onlineUser.id ? { ...u, isOnline: true } : u)
        )
        // Update conversations if they contain this user
        setConversations(prev => 
          prev.map(u => u.id === onlineUser.id ? { ...u, isOnline: true } : u)
        )
      }
    })

    socket.on('user-offline', (userId) => {
      // Update search results if they contain this user
      setSearchResults(prev => 
        prev.map(u => u.id === userId ? { ...u, isOnline: false } : u)
      )
      // Update conversations if they contain this user
      setConversations(prev => 
        prev.map(u => u.id === userId ? { ...u, isOnline: false } : u)
      )
    })

    return () => {
      socket.off('private-message')
      socket.off('user-online')
      socket.off('user-offline')
    }
  }, [socket, user, conversations])

  const sendMessage = (e) => {
    e.preventDefault()
    if (!newMessage.trim() || !selectedUser) return

    const messageData = {
      to: selectedUser.id,
      message: newMessage,
      timestamp: Date.now()
    }

    // Send message via socket
    socket.emit('private-message', messageData)

    // Add to local messages
    setMessages(prev => ({
      ...prev,
      [selectedUser.id]: [
        ...(prev[selectedUser.id] || []),
        {
          from: user,
          message: newMessage,
          timestamp: messageData.timestamp,
          isOwn: true
        }
      ]
    }))

    // Add user to conversations if not already there
    if (!conversations.find(u => u.id === selectedUser.id)) {
      setConversations(prev => [...prev, selectedUser])
    }

    setNewMessage('')
  }

  const formatTime = (timestamp) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white">
      <div className="container mx-auto h-screen flex flex-col">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-4">
            <Link to="/" className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
              <ArrowLeft size={20} />
            </Link>
            <h1 className="text-2xl font-bold">Messages</h1>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar - User List */}
          <div className="w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
            {/* Search */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500 dark:text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by username..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white pl-10 pr-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {isSearching && (
                  <Loader className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500 dark:text-gray-400 animate-spin" />
                )}
              </div>
            </div>

            {/* Search Results */}
            {searchQuery && (
              <div className="border-b border-gray-200 dark:border-gray-700">
                <div className="p-2 text-sm font-medium text-gray-600 dark:text-gray-400">Search Results</div>
                <div className="max-h-64 overflow-y-auto">
                  {isSearching ? (
                    <div className="text-center text-gray-500 dark:text-gray-400 p-4">
                      <Loader className="h-5 w-5 animate-spin mx-auto" />
                    </div>
                  ) : searchResults.length === 0 && hasSearched ? (
                    <div className="text-center text-gray-500 dark:text-gray-400 p-4">
                      <p>No users found</p>
                    </div>
                  ) : (
                    searchResults.map((u) => (
                      <div
                        key={u.id}
                        onClick={() => setSelectedUser(u)}
                        className={`flex items-center p-4 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors ${
                          selectedUser?.id === u.id ? 'bg-gray-100 dark:bg-gray-700' : ''
                        }`}
                      >
                        <div className="relative mr-3">
                          <div className="w-10 h-10 bg-gray-200 dark:bg-gray-600 rounded-full flex items-center justify-center">
                            <User className="h-5 w-5 text-gray-600 dark:text-gray-300" />
                          </div>
                          <Circle
                            className={`absolute bottom-0 right-0 h-3 w-3 ${
                              u.isOnline ? 'text-green-500 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'
                            } fill-current`}
                          />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-gray-900 dark:text-white">{u.username}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {u.isOnline ? 'Online' : 'Offline'}
                          </p>
                        </div>
                        {messages[u.id]?.filter(m => !m.isOwn).length > 0 && (
                          <div className="bg-blue-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                            {messages[u.id].filter(m => !m.isOwn).length}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Conversations */}
            <div className="flex-1 overflow-y-auto">
              {loadingConversations ? (
                <div className="text-center text-gray-500 dark:text-gray-400 p-4">
                  <Loader className="h-5 w-5 animate-spin mx-auto mb-2" />
                  <p>Loading conversations...</p>
                </div>
              ) : conversations.length > 0 ? (
                <>
                  <div className="p-2 text-sm font-medium text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">Conversations</div>
                  {conversations.map((u) => (
                    <div
                      key={u.id}
                      onClick={() => setSelectedUser(u)}
                      className={`flex items-center p-4 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors ${
                        selectedUser?.id === u.id ? 'bg-gray-100 dark:bg-gray-700' : ''
                      }`}
                    >
                      <div className="relative mr-3">
                        <div className="w-10 h-10 bg-gray-200 dark:bg-gray-600 rounded-full flex items-center justify-center">
                          <User className="h-5 w-5 text-gray-600 dark:text-gray-300" />
                        </div>
                        <Circle
                          className={`absolute bottom-0 right-0 h-3 w-3 ${
                            u.isOnline ? 'text-green-500 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'
                          } fill-current`}
                        />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 dark:text-white">{u.username}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {u.isOnline ? 'Online' : 'Offline'}
                        </p>
                      </div>
                      {messages[u.id]?.filter(m => !m.isOwn).length > 0 && (
                        <div className="bg-blue-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                          {messages[u.id].filter(m => !m.isOwn).length}
                        </div>
                      )}
                    </div>
                  ))}
                </>
              ) : (
                <div className="text-center text-gray-500 dark:text-gray-400 p-4">
                  <p>No conversations yet</p>
                  <p className="text-sm mt-2">Search for users to start chatting</p>
                </div>
              )}
            </div>
          </div>

          {/* Chat Area */}
          <div className="flex-1 flex flex-col bg-gray-50 dark:bg-gray-900">
            {selectedUser ? (
              <>
                {/* Chat Header */}
                <div className="bg-white dark:bg-gray-800 p-4 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center">
                    <div className="relative mr-3">
                      <div className="w-10 h-10 bg-gray-200 dark:bg-gray-600 rounded-full flex items-center justify-center">
                        <User className="h-5 w-5 text-gray-600 dark:text-gray-300" />
                      </div>
                      <Circle
                        className={`absolute bottom-0 right-0 h-3 w-3 ${
                          selectedUser.isOnline ? 'text-green-500 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'
                        } fill-current`}
                      />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{selectedUser.username}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {selectedUser.isOnline ? 'Online' : 'Offline'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {messages[selectedUser.id]?.map((msg, index) => (
                    <div
                      key={`${msg.timestamp}-${msg.from.id || index}`}
                      className={`flex ${msg.isOwn ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-xs md:max-w-md px-4 py-2 rounded-lg ${
                          msg.isOwn
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
                        }`}
                      >
                        <p className="break-words">{msg.message}</p>
                        <p className="text-xs opacity-70 mt-1">
                          {formatTime(msg.timestamp)}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>

                {/* Message Input */}
                <form onSubmit={sendMessage} className="p-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Type a message..."
                      className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="submit"
                      disabled={!newMessage.trim()}
                      className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed text-white p-2 rounded-lg transition-colors"
                    >
                      <Send className="h-5 w-5" />
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center text-gray-500 dark:text-gray-400">
                  <User className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p className="text-xl">Search for a user to start messaging</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}