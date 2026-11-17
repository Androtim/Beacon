import React, { useEffect, useRef } from 'react'
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
    <div
      className="p-3.5 border-b border-line bg-panel-2/70"
      data-testid="voice-panel"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className={`w-7 h-7 rounded-lg flex items-center justify-center border shrink-0 ${
              joined
                ? 'bg-mint-soft border-mint/30 text-mint'
                : 'bg-panel border-line text-muted'
            }`}
          >
            <Headphones size={14} className="shrink-0" />
          </div>
          <div className="min-w-0">
            <span className="block text-xs font-semibold text-ink truncate">
              {joined
                ? peerEntries.length === 0
                  ? 'Voice: alone in here'
                  : `Voice: ${peerEntries.map(([, p]) => p.username ?? 'peer').join(', ')}`
                : 'Room voice'}
            </span>
            <span className="block text-[11px] text-muted truncate">
              {joined
                ? muted
                  ? 'Microphone muted'
                  : 'Connected · WebRTC audio'
                : 'Opt-in voice channel'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {joined ? (
            <>
              <button
                onClick={toggleMute}
                data-testid="voice-mute"
                className={`p-2 rounded-lg border transition-colors ${
                  muted
                    ? 'bg-coral-soft border-coral/35 text-coral'
                    : 'bg-mint-soft border-mint/35 text-mint'
                }`}
                title={muted ? 'Unmute' : 'Mute'}
              >
                {muted ? <MicOff size={14} /> : <Mic size={14} />}
              </button>
              <button
                onClick={leave}
                data-testid="voice-leave"
                className="p-2 rounded-lg bg-coral-soft border border-coral/35 text-coral hover:bg-coral/20 transition-colors"
                title="Leave voice"
              >
                <PhoneOff size={14} />
              </button>
            </>
          ) : (
            <button
              onClick={join}
              data-testid="voice-join"
              className="btn btn-primary flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs transition-colors"
            >
              <Mic size={12} /> Join voice
            </button>
          )}
        </div>
      </div>
      {joined && peerEntries.length > 0 && (
        <div
          className="mt-2 text-[10px] text-mint font-mono uppercase tracking-wider"
          data-testid="voice-connected-count"
        >
          {peerEntries.filter(([, p]) => p.stream).length} connected
        </div>
      )}
      {peerEntries.map(([id, p]) =>
        p.stream ? <PeerAudio key={id} stream={p.stream} /> : null
      )}
    </div>
  )
}
