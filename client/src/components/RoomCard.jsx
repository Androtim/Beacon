import React from 'react'
import { ArrowUpRight, Film, Lock, Volume2, X } from 'lucide-react'
import { AvatarStack, LiveDot } from './ui'

const GRADIENTS = {
  noir: 'radial-gradient(120% 90% at 15% 15%, rgba(234,182,109,0.32), transparent 55%), radial-gradient(90% 90% at 85% 90%, rgba(124,156,205,0.22), transparent 60%), linear-gradient(160deg, #1b1822 0%, #0e1015 100%)',
  clay: 'radial-gradient(110% 90% at 80% 15%, rgba(226,125,106,0.35), transparent 55%), radial-gradient(100% 90% at 15% 85%, rgba(234,182,109,0.22), transparent 60%), linear-gradient(160deg, #221719 0%, #121015 100%)',
  forest: 'radial-gradient(110% 90% at 20% 20%, rgba(126,192,153,0.30), transparent 55%), radial-gradient(100% 90% at 80% 85%, rgba(234,182,109,0.18), transparent 60%), linear-gradient(160deg, #13201b 0%, #0d1213 100%)',
  ink: 'radial-gradient(110% 90% at 75% 20%, rgba(176,151,224,0.30), transparent 55%), radial-gradient(100% 90% at 20% 85%, rgba(124,156,205,0.22), transparent 60%), linear-gradient(160deg, #181625 0%, #0e1017 100%)',
}

export function RoomCard({ room, onOpen, onRemove, compact = false }) {
  const code = room.code || room.id
  const title = room.title || `Room ${code}`
  const contents = room.contents || 'Watch party'
  const gradientKey = room.gradient || 'noir'
  const progressPct =
    room.durationSec && room.positionSec
      ? Math.min(100, Math.round((room.positionSec / room.durationSec) * 100))
      : 0

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen?.(room)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen?.(room)
        }
      }}
      className="group text-left panel overflow-hidden flex flex-col transition-all duration-300 hover:-translate-y-0.5 hover:border-line-strong focus:outline-none focus:border-accent/60 cursor-pointer relative"
    >
      <div
        className={`relative ${compact ? 'aspect-[16/8.5]' : 'aspect-[16/9]'} w-full overflow-hidden bg-panel-2`}
        style={!room.image ? { background: GRADIENTS[gradientKey] || GRADIENTS.noir } : undefined}
      >
        {room.image && (
          <img
            src={room.image}
            alt={title}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.03] opacity-85"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/20" />
        <div className="absolute inset-0 dot-grid opacity-25 pointer-events-none" />

        {/* Top bar */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            {room.status !== 'idle' ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-black/55 backdrop-blur-md text-white border border-white/10">
                <LiveDot color={room.status === 'paused' ? 'amber' : 'mint'} />
                {room.status === 'paused' ? 'Paused' : 'In sync'}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-black/45 backdrop-blur-md text-white/75 border border-white/10">
                Ready
              </span>
            )}
            {room.voiceActive && (
              <span
                className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] bg-black/55 backdrop-blur-md text-white/85 border border-white/10"
                title="Voice chat active"
              >
                <Volume2 className="w-3 h-3 text-accent" />
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono tracking-wider bg-black/55 backdrop-blur-md text-white/80 border border-white/10">
              <Lock className="w-2.5 h-2.5 text-white/60" />
              {code}
            </span>
            {onRemove && (
              <button
                type="button"
                aria-label={`Remove ${code}`}
                onClick={(e) => {
                  e.stopPropagation()
                  onRemove(code)
                }}
                className="w-6 h-6 rounded-md bg-black/55 hover:bg-black/80 text-white/65 hover:text-white border border-white/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Bottom overlay */}
        <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[11px] text-white/70 mb-0.5">
              <Film className="w-3 h-3 text-accent shrink-0" />
              <span className="truncate">{contents}</span>
            </div>
            <div className="font-serif text-lg sm:text-xl text-white leading-tight truncate">
              {title}
            </div>
          </div>
        </div>

        {progressPct > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-white/15">
            <div className="h-full bg-accent" style={{ width: `${progressPct}%` }} />
          </div>
        )}
      </div>

      <div className="p-3.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          {Array.isArray(room.members) && room.members.length > 0 ? (
            <>
              <AvatarStack people={room.members} size="xs" max={4} />
              <div className="text-xs text-muted truncate">
                {room.members.length === 1
                  ? `${room.members[0].name} is here`
                  : `${room.members[0].name} + ${room.members.length - 1}`}
              </div>
            </>
          ) : (
            <div className="text-xs text-muted truncate">
              {room.isYours ? 'Hosted by you' : 'Recent watch room'}
            </div>
          )}
        </div>

        <span className="inline-flex items-center gap-1 text-xs font-medium text-ink-soft group-hover:text-accent transition-colors shrink-0">
          Step in
          <ArrowUpRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </span>
      </div>
    </div>
  )
}
export default RoomCard
