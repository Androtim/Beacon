import React from 'react'
import { FolderUp, Lock, ShieldCheck, Zap } from 'lucide-react'
import FileShare from '../components/FileShare'

export default function Files() {
  return (
    <div className="px-4 sm:px-6 lg:px-10 py-6 sm:py-8 max-w-[1320px] mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-2 border-b border-line">
        <div>
          <div className="eyebrow flex items-center gap-2 mb-1.5">
            <FolderUp className="w-3.5 h-3.5 text-accent" />
            Direct peer-to-peer transfer
          </div>
          <h1 className="font-serif text-2xl sm:text-4xl text-ink tracking-tight">
            Big files.{' '}
            <span className="italic font-normal text-accent">Small wait.</span>
          </h1>
          <p className="text-sm text-ink-soft mt-1 max-w-xl">
            Send raw footage, archives, or builds directly between browsers over WebRTC.
            Nothing touches cloud storage, and transfers keep running while you browse.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-panel border border-line text-ink-soft">
            <Zap className="w-3.5 h-3.5 text-accent" />
            Zero cloud upload
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-panel border border-line text-ink-soft">
            <Lock className="w-3.5 h-3.5 text-mint" />
            DTLS encrypted
          </span>
        </div>
      </div>

      <FileShare />

      {/* How it travels explainer */}
      <div className="panel-soft p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          {
            step: '01',
            title: 'Drop or pick any file',
            body: 'Beacon generates an 8-character handoff code immediately — no waiting for a cloud upload first.',
          },
          {
            step: '02',
            title: 'Share the 8-character code',
            body: 'Your friend enters the code on their device and accepts the file handoff.',
          },
          {
            step: '03',
            title: 'Streams device-to-device',
            body: 'Bytes flow directly over a peer-to-peer WebRTC DataChannel with automatic backpressure.',
          },
        ].map((s) => (
          <div key={s.step} className="flex items-start gap-3">
            <span className="font-mono text-xs px-2 py-1 rounded-lg bg-accent-soft border border-accent/25 text-accent shrink-0">
              {s.step}
            </span>
            <div>
              <div className="text-xs font-semibold text-ink">{s.title}</div>
              <p className="text-[11px] text-muted leading-relaxed mt-0.5">{s.body}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
