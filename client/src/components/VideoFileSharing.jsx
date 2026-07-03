import { useState, useRef, useEffect, useCallback } from 'react'
import { Upload, Users, Download, CheckCircle, AlertCircle, Radio } from 'lucide-react'
import { useFileTransfer } from '../hooks/useFileTransfer'
import { motion } from 'framer-motion'

export default function VideoFileSharing({ socket, roomId, isHost, onVideoReady, hostVideoSource, initialFileShare }) {
  const [selectedFile, setSelectedFile] = useState(null)
  const [isSharing, setIsSharing] = useState(false)
  const [pendingFileInfo, setPendingFileInfo] = useState(null)
  const [pendingHostId, setPendingHostId] = useState(null)
  const [phase, setPhase] = useState('idle') // idle|selected|pending|done (pre/post transfer UI)

  const fileInputRef = useRef(null)
  const selectedFileRef = useRef(null)
  const videoUrlRef = useRef(null)

  useEffect(() => () => {
    if (videoUrlRef.current) URL.revokeObjectURL(videoUrlRef.current)
  }, [])

  const formatFileSize = useCallback((bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024, sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }, [])

  const {
    status, serveTo, streamFrom, cancelAll,
  } = useFileTransfer({
    socket,
    signalEvent: 'video-file-signal',
  })

  const cancelTransfer = useCallback(() => {
    cancelAll()
    setSelectedFile(null)
    selectedFileRef.current = null
    setIsSharing(false)
    setPendingFileInfo(null)
    setPendingHostId(null)
    setPhase('idle')
    if (videoUrlRef.current) {
      URL.revokeObjectURL(videoUrlRef.current)
      videoUrlRef.current = null
    }
    if (socket && isHost) socket.emit('video-file-cancel', { roomId })
  }, [socket, roomId, isHost, cancelAll])

  // Streaming: playback starts as soon as the channel is up — the browser's
  // demuxer pulls byte ranges from the host on demand; no full download.
  const acceptFileTransfer = useCallback(async () => {
    setPhase('accepted')
    const key = `${roomId}-${Math.random().toString(36).slice(2, 10)}`
    await streamFrom(pendingHostId, key, {
      size: pendingFileInfo.size,
      type: pendingFileInfo.type || 'video/mp4',
    }, (url) => {
      setPhase('done')
      onVideoReady?.(url, pendingFileInfo)
    })
    socket.emit('video-file-request', { to: pendingHostId })
  }, [socket, pendingHostId, pendingFileInfo, streamFrom, roomId, onVideoReady])

  // Room state already had a share in flight when we joined.
  useEffect(() => {
    if (initialFileShare && !isHost && phase === 'idle') {
      setPendingFileInfo(initialFileShare.fileInfo)
      setPendingHostId(initialFileShare.hostId)
      setPhase('pending')
    }
  }, [initialFileShare, isHost, phase])

  useEffect(() => {
    if (!socket) return

    const onInfo = ({ fileInfo, hostId }) => {
      if (isHost) return
      // Reset any prior attempt (errored/finished/half-open peer) so a re-shared
      // video is actionable again instead of staying stuck on the old status —
      // otherwise a failed transfer leaves the receiver unable to accept the next.
      cancelAll()
      setPendingFileInfo(fileInfo)
      setPendingHostId(hostId)
      setPhase('pending')
    }
    // Host: participant accepted — dial them and serve byte ranges on demand.
    const onRequest = ({ from }) => {
      if (selectedFileRef.current) serveTo(from, selectedFileRef.current)
    }
    const onCancel = () => cancelTransfer()

    socket.on('video-file-info', onInfo)
    socket.on('video-file-request', onRequest)
    socket.on('video-file-cancel', onCancel)
    return () => {
      socket.off('video-file-info', onInfo)
      socket.off('video-file-request', onRequest)
      socket.off('video-file-cancel', onCancel)
    }
  }, [socket, isHost, serveTo, cancelTransfer, cancelAll])

  const participantStatus = phase === 'done' ? 'ready'
    : status === 'error' ? 'error' // a failed/timed-out connection wins over the spinner
    : phase === 'accepted' ? 'connecting'
    : phase // idle | pending

  return (
    <div className="border backdrop-blur-md rounded-2xl p-5 space-y-4 font-mono shadow-xl" style={{ background: 'var(--surface)' }}>
      <h3 className="text-[10px] font-black uppercase tracking-[0.3em] flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
        <Upload className="h-4 w-4" style={{ color: 'rgb(var(--accent))' }} />
        Share a video
      </h3>

      {isHost && hostVideoSource === 'file' ? (
        <div className="space-y-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            onChange={(e) => {
              const file = e.target.files[0]
              if (!file) return
              setSelectedFile(file)
              selectedFileRef.current = file
              setPhase('selected')
            }}
            className="hidden"
            data-testid="party-file-input"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="btn btn-secondary w-full h-11 text-[10px] tracking-[0.2em]"
          >
            Choose a video
          </button>

          {selectedFile && (
            <div className="border rounded-xl p-4 space-y-3" style={{ background: 'var(--surface-raised)' }}>
              <div className="flex items-center gap-3">
                <div className="flex-1 overflow-hidden">
                  <p className="text-[10px] font-bold truncate uppercase" style={{ color: 'var(--text-primary)' }}>{selectedFile.name}</p>
                  <p className="text-[9px] uppercase font-black" style={{ color: 'var(--text-secondary)' }}>{formatFileSize(selectedFile.size)}</p>
                </div>
                <CheckCircle className="h-4.5 w-4.5" style={{ color: 'rgb(var(--accent))' }} />
              </div>

              {!isSharing && (
                <button
                  onClick={() => {
                    setIsSharing(true)
                    const url = URL.createObjectURL(selectedFile)
                    videoUrlRef.current = url
                    onVideoReady?.(url, { name: selectedFile.name, size: selectedFile.size, type: selectedFile.type })
                    socket.emit('video-file-share', {
                      roomId,
                      fileInfo: { name: selectedFile.name, size: selectedFile.size, type: selectedFile.type },
                    })
                  }}
                  className="btn btn-primary w-full h-11 text-[10px] tracking-[0.2em]"
                  data-testid="party-broadcast"
                >
                  Share with the party
                </button>
              )}

              {isSharing && (
                <div className="space-y-3">
                  <div className="border rounded-lg p-3 text-center flex items-center justify-center gap-2" style={{ background: 'rgb(var(--accent) / 0.05)', borderColor: 'rgb(var(--accent) / 0.2)' }}>
                    <Radio size={12} className="animate-pulse" style={{ color: 'rgb(var(--accent))' }} />
                    <p className="text-[10px] font-black uppercase tracking-wider" style={{ color: 'rgb(var(--accent))' }}>
                      {status === 'streaming' ? 'Streaming to the party' : 'Ready — waiting for others'}
                    </p>
                  </div>
                  <button
                    onClick={cancelTransfer}
                    className="btn bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/20 w-full h-9 text-[9px] tracking-[0.2em]"
                  >
                    Stop sharing
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      ) : isHost ? (
        <div className="text-center py-6 px-4 rounded-xl border border-dashed opacity-60" style={{ background: 'var(--surface-raised)' }}>
          <Upload className="h-7 w-7 mx-auto mb-2.5" style={{ color: 'var(--text-secondary)' }} />
          <p className="text-[9px] font-black uppercase tracking-[0.2em] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
Switch to "File" mode<br/>to share a video
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {participantStatus === 'idle' && (
            <div className="text-center py-7 rounded-xl border border-dashed opacity-60 animate-pulse" style={{ background: 'var(--surface-raised)' }}>
              <Users className="h-7 w-7 mx-auto mb-2.5" style={{ color: 'var(--text-secondary)' }} />
              <p className="text-[9px] font-black uppercase tracking-[0.2em]" style={{ color: 'var(--text-secondary)' }}>
                Waiting for the host to share a video…
              </p>
            </div>
          )}

          {participantStatus === 'pending' && pendingFileInfo && (
            <div className="border rounded-xl p-5 text-center" style={{ background: 'rgb(var(--accent) / 0.05)', borderColor: 'rgb(var(--accent) / 0.2)' }}>
              <Download className="h-8 w-8 mx-auto mb-3" style={{ color: 'rgb(var(--accent))' }} />
              <p className="font-black text-[10px] uppercase tracking-[0.2em] mb-3" style={{ color: 'var(--text-primary)' }}>The host wants to share a video</p>
              <div className="rounded-lg p-3 mb-4 border" style={{ background: 'var(--surface)' }}>
                <p className="font-bold text-[9px] truncate uppercase" style={{ color: 'rgb(var(--accent))' }}>{pendingFileInfo.name}</p>
                <p className="text-[8px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>{formatFileSize(pendingFileInfo.size)}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={acceptFileTransfer} className="btn btn-primary flex-1 h-10 text-[10px]" data-testid="party-accept">ACCEPT</button>
                <button onClick={() => setPhase('idle')} className="btn btn-secondary flex-1 h-10 text-[10px]">REJECT</button>
              </div>
            </div>
          )}

          {participantStatus === 'connecting' && (
            <div className="text-center py-6 px-4 rounded-xl border space-y-2" style={{ background: 'rgb(var(--accent) / 0.05)', borderColor: 'rgb(var(--accent) / 0.2)' }}>
              <div className="h-5 w-5 border-2 rounded-full animate-spin mx-auto" style={{ borderColor: 'rgb(var(--accent))', borderTopColor: 'transparent' }} />
              <p className="text-[9px] font-black uppercase tracking-[0.2em]" style={{ color: 'rgb(var(--accent))' }}>Connecting…</p>
            </div>
          )}

          {participantStatus === 'ready' && (
            <div className="text-center py-7 px-4 bg-emerald-500/5 rounded-xl border border-emerald-500/20" data-testid="party-file-ready">
              <CheckCircle className="h-7 w-7 mx-auto mb-2 text-emerald-400" />
              <p className="text-emerald-400 text-[10px] font-black uppercase tracking-[0.2em] leading-relaxed">
Streaming — playing now
              </p>
            </div>
          )}

          {participantStatus === 'error' && (
            <div className="bg-rose-500/5 border border-rose-500/20 rounded-xl p-5 text-center space-y-3" data-testid="party-connection-failed">
              <AlertCircle className="h-8 w-8 mx-auto text-rose-400" />
              <p className="text-rose-400 font-black text-[10px] uppercase tracking-[0.2em]">Couldn't connect</p>
              <p className="text-[9px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>The direct connection couldn't be established. This can happen on restrictive networks.</p>
              <div className="flex gap-2">
                {pendingHostId && (
                  <button onClick={acceptFileTransfer} className="btn btn-primary flex-1 h-9 text-[9px]" data-testid="party-retry">Try again</button>
                )}
                <button onClick={cancelTransfer} className="btn btn-secondary flex-1 h-9 text-[9px]">Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="rounded-xl p-3 border" style={{ background: 'var(--surface-raised)' }}>
        <p className="text-[8px] text-center font-black uppercase tracking-[0.2em] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          Encrypted peer-to-peer · starts playing as it streams<br/>
          <span className="mt-1 block opacity-70">MP4, WebM, MOV</span>
        </p>
      </div>
    </div>
  )
}
