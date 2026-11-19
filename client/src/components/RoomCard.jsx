import React from 'react'
import { ArrowUpRight, Film, Radio, X } from 'lucide-react'
import { prettySourceName } from '../hooks/useRecentRooms'

export function RoomCard({ room, onOpen, onRemove }) {
  const sourceLabel = prettySourceName(room.url) || room.contents || 'Ready for media'
  const title = room.title && room.title !== `Room ${room.id}` ? room.title : `Room ${room.id}`

  return (
    <div
      onClick={() => onOpen?.(room)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onOpen?.(room)}
      className="panel p-4 hover:border-line-strong hover:bg-panel-2/40 transition-colors cursor-pointer group flex flex-col justify-between gap-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-panel-2 border border-line flex items-center justify-center text-accent shrink-0">
            <Radio className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <div className="text-[13px] font-medium text-ink truncate">{title}</div>
            <div className="text-[11px] text-muted flex items-center gap-1.5 mt-0.5 truncate">
              <Film className="w-3 h-3 text-faint shrink-0" />
              <span className="truncate">{sourceLabel}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {onRemove && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onRemove(room.id)
              }}
              className="opacity-0 group-hover:opacity-100 icon-btn w-6 h-6"
              title="Remove from recent"
              aria-label={`Remove ${room.id}`}
            >
              <X className="w-3 h-3" />
            </button>
          )}
          <ArrowUpRight className="w-3.5 h-3.5 text-faint group-hover:text-ink transition-colors" />
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-line">
        <span className="font-mono text-[11px] text-muted tracking-wider">{room.id}</span>
        <span className="text-[11px] text-faint group-hover:text-accent transition-colors">
          Rejoin
        </span>
      </div>
    </div>
  )
}

export default RoomCard
