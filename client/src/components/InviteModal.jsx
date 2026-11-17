import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { Check, Copy, Link2, Send, Sparkles } from 'lucide-react'
import { Avatar, Modal } from './ui'
import { useAuth } from '../context/AuthContext'
import { useSocketContext } from '../context/SocketContext'
import { useToast } from '../context/ToastContext'

export function InviteModal({ open, roomId, roomTitle, onClose }) {
  const { user, isGuest } = useAuth()
  const { socket } = useSocketContext()
  const { notify } = useToast()
  const [copiedLink, setCopiedLink] = useState(false)
  const [copiedCode, setCopiedCode] = useState(false)
  const [friends, setFriends] = useState([])
  const [sentIds, setSentIds] = useState([])

  useEffect(() => {
    if (!open || !user || isGuest) return
    let cancelled = false
    axios
      .get('/api/conversations')
      .then((res) => {
        if (!cancelled) {
          const users = (res.data.conversations || [])
            .map((c) => c.user)
            .filter(Boolean)
          setFriends(users)
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [open, user, isGuest])

  if (!roomId) return null
  const shareUrl = `${window.location.origin}/party/${roomId}`

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
    } catch {}
    setCopiedLink(true)
    notify('Room link copied', shareUrl, 'mint')
    setTimeout(() => setCopiedLink(false), 1800)
  }

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(roomId)
    } catch {}
    setCopiedCode(true)
    notify(`Copied room code · ${roomId}`, 'Paste it anywhere', 'mint')
    setTimeout(() => setCopiedCode(false), 1800)
  }

  const sendInviteToFriend = (person) => {
    if (!socket) return
    socket.emit('dm-party-invite', { to: person.id, roomId })
    setSentIds((prev) => (prev.includes(person.id) ? prev : [...prev, person.id]))
    notify(`Invited ${person.username}`, `Sent a direct card for ${roomId}`, 'accent')
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow="Invite to room"
      title={`Bring friends into "${roomTitle || `Room ${roomId}`}"`}
      subtitle="Anyone with this link or code lands in your exact frame. Nothing is listed publicly."
    >
      <div className="space-y-5">
        {/* Share link */}
        <div>
          <div className="text-xs font-medium text-ink-soft mb-1.5">Shareable link</div>
          <div className="flex items-center gap-2 p-1.5 pl-3 rounded-xl bg-panel-2 border border-line">
            <Link2 className="w-4 h-4 text-muted shrink-0" />
            <span className="font-mono text-xs text-ink truncate flex-1">{shareUrl}</span>
            <button
              type="button"
              onClick={copyLink}
              className="btn btn-primary text-xs py-2 px-3 inline-flex items-center gap-1.5"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedLink ? 'Copied' : 'Copy link'}
            </button>
          </div>
        </div>

        {/* Room code */}
        <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-panel-2 border border-line">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted">
              Or read out the code
            </div>
            <div className="text-xs text-ink-soft mt-0.5">
              They can enter it on the Beacon home screen
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              {roomId.split('').map((ch, idx) => (
                <span
                  key={idx}
                  className="w-7 h-8 rounded-lg bg-panel border border-line-strong font-mono text-sm font-medium text-accent flex items-center justify-center"
                >
                  {ch}
                </span>
              ))}
            </div>
            <button
              type="button"
              onClick={copyCode}
              className="icon-btn"
              title="Copy code"
            >
              {copiedCode ? (
                <Check className="w-4 h-4 text-mint" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Direct DM invite */}
        {friends.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-ink-soft">Tap a friend to nudge</span>
              <span className="text-[11px] text-muted">Sends an in-app party card</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-44 overflow-y-auto pr-1">
              {friends.map((p) => {
                const sent = sentIds.includes(p.id)
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => sendInviteToFriend(p)}
                    disabled={sent}
                    className={`p-2 rounded-xl border text-left flex items-center gap-2.5 transition-all ${
                      sent
                        ? 'bg-mint-soft border-mint/40'
                        : 'bg-panel-2 border-line hover:border-line-strong'
                    }`}
                  >
                    <Avatar name={p.username} size="sm" status="online" />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium text-ink truncate">{p.username}</div>
                      <div className="text-[11px] text-muted truncate">
                        {sent ? 'Invite sent' : 'Direct message'}
                      </div>
                    </div>
                    <div
                      className={`w-6 h-6 rounded-full border flex items-center justify-center ${
                        sent
                          ? 'bg-mint border-mint text-black'
                          : 'border-line-strong text-muted'
                      }`}
                    >
                      {sent ? <Check className="w-3.5 h-3.5" /> : <Send className="w-3 h-3" />}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-line">
          <div className="inline-flex items-center gap-1.5 text-[11px] text-muted">
            <Sparkles className="w-3.5 h-3.5 text-accent" />
            Late joiners automatically snap to your timestamp
          </div>
          <button type="button" onClick={onClose} className="btn btn-ghost text-xs">
            Done
          </button>
        </div>
      </div>
    </Modal>
  )
}
export default InviteModal
