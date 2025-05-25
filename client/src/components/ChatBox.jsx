import { useState, useRef, useEffect } from 'react'
import { Send } from 'lucide-react'

export default function ChatBox({ messages, onSendMessage }) {
  const [inputMessage, setInputMessage] = useState('')
  const messagesEndRef = useRef()

  // Auto scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (inputMessage.trim() && onSendMessage) {
      onSendMessage(inputMessage.trim())
      setInputMessage('')
    }
  }

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    })
  }

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 h-96 flex flex-col">
      <h3 className="font-semibold mb-3">Chat</h3>
      
      {/* Messages container */}
      <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded p-3 mb-3 overflow-y-auto space-y-2">
        {messages.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-sm text-center">
            No messages yet. Start the conversation!
          </p>
        ) : (
          messages.map((msg, index) => (
            <div key={index} className="text-sm">
              {msg.type === 'system' ? (
                <div className="text-gray-500 dark:text-gray-400 italic text-center">
                  {msg.message}
                </div>
              ) : (
                <div>
                  <span className="text-blue-600 dark:text-blue-400 font-medium">
                    {msg.username}
                  </span>
                  <span className="text-gray-500 dark:text-gray-500 text-xs ml-2">
                    {formatTime(msg.timestamp)}
                  </span>
                  <div className="text-gray-700 dark:text-gray-200 mt-1">
                    {msg.message}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
      
      {/* Message input */}
      <form onSubmit={handleSubmit} className="flex space-x-2">
        <input
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 bg-white dark:bg-gray-600 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-500 px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          maxLength={500}
        />
        <button
          type="submit"
          disabled={!inputMessage.trim()}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed px-3 py-2 rounded transition-colors"
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  )
}