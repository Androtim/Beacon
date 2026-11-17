import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Sparkles } from 'lucide-react'
import { Modal } from './ui'
import { useTransfers } from '../context/TransfersContext'

export function JoinRoomModal({ open, onClose }) {
  const navigate = useNavigate()
  const { joinShare } = useTransfers()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')

  const clean = code.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)

  const handleSubmit = (e) => {
    e.preventDefault()
    if (clean.length < 6) {
      setError('Codes are 6 characters for rooms or 8 characters for files.')
      return
    }
    onClose?.()
    setCode('')
    setError('')
    if (clean.length === 8) {
      joinShare(clean)
      navigate('/files')
    } else {
      navigate(`/party/${clean.slice(0, 6)}`)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow="Have a code?"
      title="Step into a room."
      subtitle="Enter the 6-character room code (or 8-character file transfer code) a friend shared with you."
      size="sm"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <div className="relative">
            <div className={`grid ${clean.length > 6 ? 'grid-cols-8' : 'grid-cols-6'} gap-2`}>
              {Array.from({ length: clean.length > 6 ? 8 : 6 }).map((_, i) => {
                const ch = clean[i] || ''
                const isActive = i === clean.length
                return (
                  <div
                    key={i}
                    className={`aspect-square rounded-xl border flex items-center justify-center font-mono text-lg sm:text-xl font-medium transition-all ${
                      ch
                        ? 'bg-accent-soft border-accent/50 text-ink'
                        : isActive
                        ? 'bg-panel-2 border-line-strong text-ink'
                        : 'bg-panel-2 border-line text-muted'
                    }`}
                  >
                    {ch || <span className="text-faint text-sm">·</span>}
                  </div>
                )
              })}
            </div>
            <input
              type="text"
              value={clean}
              onChange={(e) => {
                setCode(e.target.value)
                setError('')
              }}
              className="absolute inset-0 opacity-0 cursor-text"
              autoFocus
              maxLength={8}
              aria-label="Room or file code"
            />
          </div>
          {error && <div className="text-xs text-coral mt-2">{error}</div>}
        </div>

        <button
          type="button"
          onClick={() => {
            onClose?.()
            setCode('')
            navigate('/party/WAVE82')
          }}
          className="w-full p-2.5 rounded-xl bg-panel-2 hover:bg-panel-3 border border-line text-left flex items-center justify-between gap-2 transition-colors"
        >
          <span className="inline-flex items-center gap-2 text-xs text-ink-soft">
            <Sparkles className="w-3.5 h-3.5 text-accent" />
            Just looking? Peek inside a sample room
          </span>
          <span className="font-mono text-[11px] text-accent">WAVE82 →</span>
        </button>

        <div className="flex items-center justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="btn btn-ghost text-xs">
            Cancel
          </button>
          <button type="submit" className="btn btn-primary text-xs inline-flex items-center gap-1.5">
            Step inside
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </form>
    </Modal>
  )
}
export default JoinRoomModal
