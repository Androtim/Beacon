import { useEffect, useRef } from 'react'
import { Mic, MicOff, PhoneOff, Headphones } from 'lucide-react'
import { useVoiceChat } from '../hooks/useVoiceChat'

function PeerAudio({ stream }) {
  const ref = useRef(null)
  useEffect(() => {
    if (ref.current && stream) ref.current.srcObject = stream
  }, [stream])
  return <audio ref={ref} autoPlay />
}

export default function VoicePanel({ socket, roomId }) {
  const { joined, muted, peers, join, leave, toggleMute } = useVoiceChat(socket, roomId)
  const peerEntries = Object.entries(peers)

  return (
    <div className="p-3 border-b" style={{ background: 'var(--bg-secondary)' }} data-testid="voice-panel">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Headphones size={14} className="shrink-0" style={{ color: 'rgb(var(--accent))' }} />
          <span className="text-[10px] font-black uppercase tracking-wider truncate" style={{ color: 'var(--text-secondary)' }}>
            {joined
              ? peerEntries.length === 0
                ? 'Voice: alone in here'
                : `Voice: ${peerEntries.map(([, p]) => p.username ?? 'peer').join(', ')}`
              : 'Voice chat'}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {joined ? (
            <>
              <button
                onClick={toggleMute}
                data-testid="voice-mute"
                className={`p-2 rounded-lg transition-colors ${muted ? 'bg-rose-500/10 text-rose-400' : 'bg-emerald-500/10 text-emerald-400'}`}
                title={muted ? 'Unmute' : 'Mute'}
              >
                {muted ? <MicOff size={14} /> : <Mic size={14} />}
              </button>
              <button
                onClick={leave}
                data-testid="voice-leave"
                className="p-2 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-colors"
                title="Leave voice"
              >
                <PhoneOff size={14} />
              </button>
            </>
          ) : (
            <button
              onClick={join}
              data-testid="voice-join"
              className="btn btn-primary flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] uppercase tracking-wider transition-colors"
            >
              <Mic size={12} /> Join voice
            </button>
          )}
        </div>
      </div>
      {joined && peerEntries.length > 0 && (
        <div className="mt-1 text-[9px] text-emerald-400 font-bold uppercase tracking-wider" data-testid="voice-connected-count">
          {peerEntries.filter(([, p]) => p.stream).length} connected
        </div>
      )}
      {peerEntries.map(([id, p]) => (p.stream ? <PeerAudio key={id} stream={p.stream} /> : null))}
    </div>
  )
}
