import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Film, Link2, Sparkles, Upload } from 'lucide-react'
import { Modal, Toggle } from './ui'
import { recordRoom } from '../hooks/useRecentRooms'
import { useToast } from '../context/ToastContext'

function randomRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let out = ''
  const bytes = new Uint8Array(6)
  crypto.getRandomValues(bytes)
  for (let i = 0; i < 6; i++) out += chars[bytes[i] % chars.length]
  return out
}

export function CreateRoomModal({ open, onClose }) {
  const navigate = useNavigate()
  const { notify } = useToast()
  const [title, setTitle] = useState('')
  const [source, setSource] = useState('link') // 'link' | 'file' | 'empty'
  const [url, setUrl] = useState('')
  const [voice, setVoice] = useState(true)

  const handleSubmit = (e) => {
    e.preventDefault()
    const code = randomRoomCode()
    const cleanTitle = title.trim() || 'Untitled Room'
    const cleanUrl = source === 'link' ? url.trim() : ''

    recordRoom(code, {
      title: cleanTitle,
      url: cleanUrl,
      contents: cleanTitle,
      isYours: true,
      voiceActive: voice,
    })

    notify(`Lit "${cleanTitle}"`, `Invite code · ${code}`, 'accent')
    onClose?.()
    setTitle('')
    setUrl('')
    navigate(`/party/${code}`, {
      state: {
        initialUrl: cleanUrl || undefined,
        initialSourceMode: source === 'file' ? 'file' : 'url',
        roomTitle: cleanTitle,
      },
    })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow="New watch room"
      title="Light a room for your people."
      subtitle="Everyone inside sees the same frame at the same moment. Voice and chat are built in, and rooms are invite-only by default."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-ink-soft mb-1.5">
            Give the room a name
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Friday Film Club, Rough cuts, Sunday matinée…"
            className="field"
            autoFocus
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-ink-soft mb-1.5">
            What are you bringing?
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'link', label: 'A link', sub: 'YouTube, Vimeo, MP4', icon: Link2 },
              { id: 'file', label: 'A file', sub: 'Streams from your device', icon: Upload },
              { id: 'empty', label: 'Decide inside', sub: 'Pick together', icon: Sparkles },
            ].map((opt) => {
              const Icon = opt.icon
              const active = source === opt.id
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSource(opt.id)}
                  className={`text-left p-3 rounded-xl border transition-all ${
                    active
                      ? 'bg-accent-soft border-accent/40 text-ink'
                      : 'bg-panel-2 border-line text-ink-soft hover:border-line-strong'
                  }`}
                >
                  <Icon className={`w-4 h-4 mb-2 ${active ? 'text-accent' : 'text-muted'}`} />
                  <div className="text-xs font-medium text-ink">{opt.label}</div>
                  <div className="text-[11px] text-muted leading-snug mt-0.5">{opt.sub}</div>
                </button>
              )
            })}
          </div>
        </div>

        {source === 'link' && (
          <div>
            <label className="block text-xs font-medium text-ink-soft mb-1.5">
              Paste a video URL <span className="text-muted">(optional — can add later)</span>
            </label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://youtube.com/watch?v=… or direct .mp4"
              className="field"
            />
          </div>
        )}

        {source === 'file' && (
          <div className="p-3.5 rounded-xl border border-dashed border-line-strong bg-panel-2 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-accent-soft border border-accent/25 flex items-center justify-center text-accent shrink-0">
              <Film className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium text-ink">
                Drop a file once you step inside
              </div>
              <div className="text-[11px] text-muted">
                Streams directly from your computer — nothing uploads to a server.
              </div>
            </div>
          </div>
        )}

        <div className="pt-1 border-t border-line flex items-center justify-between py-2">
          <div>
            <div className="text-xs font-medium text-ink">Start with voice on</div>
            <div className="text-[11px] text-muted">
              Anyone can mute or leave voice at any time
            </div>
          </div>
          <Toggle checked={voice} onChange={setVoice} />
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn btn-ghost text-xs">
            Cancel
          </button>
          <button type="submit" className="btn btn-primary text-xs">
            Open the room
          </button>
        </div>
      </form>
    </Modal>
  )
}
export default CreateRoomModal
