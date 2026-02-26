import { useState, useRef, useEffect } from 'react'
import { Send, Zap } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export default function ChatBox({ messages, onSendMessage }) {
  const [inputMessage, setInputMessage] = useState('')
  const messagesEndRef = useRef()

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' })
  }, [messages])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (inputMessage.trim() && onSendMessage) {
      onSendMessage(inputMessage.trim())
      setInputMessage('')
    }
  }

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
  }

  return (
    <div className="flex flex-col h-full bg-transparent font-mono">
      {/* Messages container */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2 scrollbar-hide">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center opacity-20 px-6">
             <Zap className="h-8 w-8 mb-2" />
             <p className="text-[10px] font-bold uppercase tracking-[0.3em]">Awaiting_Comms</p>
          </div>
        ) : (
          messages.map((msg, index) => (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              key={index} 
              className="text-xs"
            >
              {msg.type === 'system' ? (
                <div className="text-[9px] text-orange-500/50 font-bold uppercase tracking-[0.2em] py-1 border-y border-white/[0.03] my-2">
                  [SYSTEM] {msg.message}
                </div>
              ) : (
                <div className="flex items-start gap-3 group py-1 border-b border-transparent hover:border-white/[0.02]">
                  <span className="text-[9px] text-slate-700 shrink-0 mt-0.5">
                    {formatTime(msg.timestamp)}
                  </span>
                  <div className="flex-1">
                    <span className="text-orange-500 font-bold tracking-tighter mr-2 uppercase">
                      {msg.username}:
                    </span>
                    <span className="text-slate-400 leading-relaxed break-words">
                      {msg.message}
                    </span>
                  </div>
                </div>
              )}
            </motion.div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
      
      {/* Message input */}
      <form onSubmit={handleSubmit} className="p-3 bg-[#1A1A1A] border-t border-white/5 flex gap-2">
        <input
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          placeholder="SEND_COMMAND..."
          className="flex-1 bg-transparent border border-white/10 rounded-none px-4 py-2 text-[10px] text-white placeholder:text-slate-700 focus:outline-none focus:border-orange-500/50 transition-all font-bold uppercase"
          maxLength={500}
        />
        <button
          type="submit"
          disabled={!inputMessage.trim()}
          className="px-4 bg-orange-500 rounded-none flex items-center justify-center text-black disabled:opacity-10 transition-all hover:bg-orange-400 active:translate-y-0.5"
        >
          <Send size={14} />
        </button>
      </form>
    </div>
  )
}
