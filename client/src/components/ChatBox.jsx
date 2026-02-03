import { useState, useRef, useEffect } from 'react'
import { Send, Zap } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export default function ChatBox({ messages, onSendMessage }) {
  const [inputMessage, setInputMessage] = useState('')
  const messagesEndRef = useRef()

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
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="flex flex-col h-full bg-transparent">
      {/* Messages container */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 scrollbar-hide">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center opacity-30 px-6">
             <Zap className="h-10 w-10 mb-2" />
             <p className="text-xs font-bold uppercase tracking-widest">Awaiting Comms</p>
          </div>
        ) : (
          messages.map((msg, index) => (
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              key={index} 
              className="text-sm"
            >
              {msg.type === 'system' ? (
                <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest text-center py-2 border-y border-white/5 my-2">
                  {msg.message}
                </div>
              ) : (
                <div className="group">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-violet-400 font-bold tracking-tight">
                      {msg.username}
                    </span>
                    <span className="text-[10px] text-slate-600 font-mono">
                      {formatTime(msg.timestamp)}
                    </span>
                  </div>
                  <div className="text-slate-300 leading-relaxed bg-white/5 rounded-2xl rounded-tl-none px-4 py-2 border border-white/5 inline-block max-w-[90%]">
                    {msg.message}
                  </div>
                </div>
              )}
            </motion.div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
      
      {/* Message input */}
      <form onSubmit={handleSubmit} className="p-4 bg-white/5 border-t border-white/5 flex gap-2">
        <input
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          placeholder="SEND COMMAND..."
          className="flex-1 bg-white/[0.03] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-violet-500/50 transition-all font-medium"
          maxLength={500}
        />
        <button
          type="submit"
          disabled={!inputMessage.trim()}
          className="w-10 h-10 bg-violet-500 rounded-xl flex items-center justify-center text-white disabled:opacity-20 disabled:grayscale transition-all hover:scale-105 active:scale-95 shadow-lg shadow-violet-500/20"
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  )
}
