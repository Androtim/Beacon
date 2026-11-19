import React from 'react'
import { Lock } from 'lucide-react'
import FileShare from '../components/FileShare'

export default function Files() {
  return (
    <div className="px-4 sm:px-6 lg:px-10 py-8 max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold tracking-[-0.025em] text-ink">
            File transfer
          </h1>
          <p className="text-xs text-muted mt-0.5">
            Direct browser-to-browser transfer over WebRTC. Nothing is uploaded to a server.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-panel border border-line text-[11px] text-muted self-start sm:self-auto">
          <Lock className="w-3 h-3 text-mint" />
          DTLS encrypted · Resumable
        </span>
      </div>

      <FileShare />
    </div>
  )
}
