import { useState, useRef, useEffect, useCallback } from 'react'
import { Upload, Users, Download, CheckCircle, AlertCircle } from 'lucide-react'
import { useFileTransfer } from '../hooks/useFileTransfer'
import { cleanupTransfer } from '../lib/p2p/transfer'
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
  const transferId = `room-${roomId}`

  // Leaving the party: release the blob and only then the OPFS bytes under it.
  useEffect(() => () => {
    if (videoUrlRef.current) URL.revokeObjectURL(videoUrlRef.current)
    cleanupTransfer(`room-${roomId}`)
  }, [roomId])

  const formatFileSize = useCallback((bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024, sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }, [])

  // NOTE: no cleanupTransfer here — the File is a live reference to the OPFS
  // entry; deleting it would invalidate the blob URL mid-playback.
  const handleVideoReceived = useCallback((file, meta) => {
    const url = URL.createObjectURL(file)
    videoUrlRef.current = url
    setPhase('done')
    onVideoReady?.(url, { name: meta.name, size: file.size, type: meta.type })
  }, [onVideoReady])

  const {
    status, uploadProgress, downloadProgress, sendTo, receiveFrom, cancelAll,
  } = useFileTransfer({
    socket,
    signalEvent: 'video-file-signal',
    onFileReceived: handleVideoReceived,
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

  const acceptFileTransfer = useCallback(async () => {
    setPhase('accepted')
    await receiveFrom(pendingHostId, transferId)
    socket.emit('video-file-request', { to: pendingHostId })
  }, [socket, pendingHostId, receiveFrom, transferId])

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
      setPendingFileInfo(fileInfo)
      setPendingHostId(hostId)
      setPhase('pending')
    }
    // Host: participant accepted — dial them and stream the video.
    const onRequest = ({ from }) => {
      if (selectedFileRef.current) sendTo(from, [selectedFileRef.current], transferId)
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
  }, [socket, isHost, sendTo, transferId, cancelTransfer])

  const participantStatus = phase === 'done' ? 'ready'
    : status === 'transferring' ? 'downloading'
    : phase === 'accepted' ? 'connecting'
    : phase // idle | pending

  const uploadPercent = selectedFile ? (uploadProgress[selectedFile.name] || 0) : 0

  return (
    <div className="bg-[#1e293b]/50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800 backdrop-blur-md rounded-2xl p-5 space-y-4 font-mono shadow-xl shadow-slate-100/50 dark:shadow-none">
      <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.3em] flex items-center gap-2">
        <Upload className="h-4 w-4 text-blue-500" />
        Protocol: P2P Watch Sync
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
            SELECT_PAYLOAD
          </button>

          {selectedFile && (
            <div className="bg-slate-50 dark:bg-slate-800/20 border border-slate-200/50 dark:border-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex-1 overflow-hidden">
                  <p className="text-slate-700 dark:text-slate-200 text-[10px] font-bold truncate uppercase">{selectedFile.name}</p>
                  <p className="text-slate-400 text-[9px] uppercase font-black">{formatFileSize(selectedFile.size)}</p>
                </div>
                <CheckCircle className="h-4.5 w-4.5 text-blue-500" />
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
                  BROADCAST_PAYLOAD
                </button>
              )}

              {isSharing && (
                <div className="space-y-3">
                  <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-3 text-center">
                    <p className="text-blue-500 text-[10px] font-black uppercase tracking-wider">{uploadPercent}% SYNCED</p>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                      <motion.div
                        animate={{ width: `${uploadPercent}%` }}
                        className="h-full bg-blue-500"
                      />
                    </div>
                  </div>
                  <button
                    onClick={cancelTransfer}
                    className="btn bg-rose-500 text-white hover:bg-rose-600 w-full h-9 text-[9px] tracking-[0.2em]"
                  >
                    TERMINATE_LINK
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      ) : isHost ? (
        <div className="text-center py-6 px-4 bg-slate-50 dark:bg-slate-850/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 opacity-60">
          <Upload className="h-7 w-7 mx-auto mb-2.5 text-slate-400" />
          <p className="text-slate-500 dark:text-slate-400 text-[9px] font-black uppercase tracking-[0.2em] leading-relaxed">
            SWITCH TO "P2P_FILE"<br/>MODE TO BROADCAST
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {participantStatus === 'idle' && (
            <div className="text-center py-7 bg-slate-50 dark:bg-slate-850/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 opacity-60 animate-pulse">
              <Users className="h-7 w-7 mx-auto mb-2.5 text-slate-400" />
              <p className="text-slate-400 dark:text-slate-500 text-[9px] font-black uppercase tracking-[0.2em]">
                Awaiting_Transmission...
              </p>
            </div>
          )}

          {participantStatus === 'pending' && pendingFileInfo && (
            <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-5 text-center">
              <Download className="h-8 w-8 mx-auto mb-3 text-blue-500" />
              <p className="text-slate-800 dark:text-slate-200 font-black text-[10px] uppercase tracking-[0.2em] mb-3">INCOMING_VIDEO_STREAM</p>
              <div className="bg-slate-50 dark:bg-black/40 rounded-lg p-3 mb-4 border border-slate-200/50 dark:border-slate-850">
                <p className="text-blue-500 font-bold text-[9px] truncate uppercase">{pendingFileInfo.name}</p>
                <p className="text-slate-400 text-[8px] mt-0.5">{formatFileSize(pendingFileInfo.size)}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={acceptFileTransfer} className="btn btn-primary flex-1 h-10 text-[10px]" data-testid="party-accept">ACCEPT</button>
                <button onClick={() => setPhase('idle')} className="btn btn-secondary flex-1 h-10 text-[10px]">REJECT</button>
              </div>
            </div>
          )}

          {participantStatus === 'connecting' && (
            <div className="text-center py-6 px-4 bg-blue-500/5 rounded-xl border border-blue-500/20 space-y-2">
              <div className="h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-blue-500 text-[9px] font-black uppercase tracking-[0.2em]">TUNNELING_CONNECTION...</p>
            </div>
          )}

          {participantStatus === 'downloading' && (
            <div className="space-y-4 bg-slate-50 dark:bg-slate-800/10 border border-slate-200/50 dark:border-slate-800 rounded-xl p-5">
              <div className="text-center text-slate-700 dark:text-slate-300 font-black text-[9px] uppercase tracking-[0.3em] animate-pulse">Syncing_Payload...</div>
              {Object.entries(downloadProgress).map(([fileIndex, prog]) => (
                <div key={fileIndex} className="space-y-2">
                  <div className="flex justify-between font-bold text-[9px] text-blue-500">
                    <span data-testid="party-download-percent">{prog}%</span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <motion.div
                      animate={{ width: `${prog}%` }}
                      className="h-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.2)]"
                    />
                  </div>
                </div>
              ))}
              <button
                onClick={cancelTransfer}
                className="btn bg-rose-500 text-white w-full h-8 text-[9px]"
              >
                ABORT
              </button>
            </div>
          )}

          {participantStatus === 'ready' && (
            <div className="text-center py-7 px-4 bg-emerald-500/5 rounded-xl border border-emerald-500/20" data-testid="party-file-ready">
              <CheckCircle className="h-7 w-7 mx-auto mb-2 text-emerald-500" />
              <p className="text-emerald-500 text-[10px] font-black uppercase tracking-[0.2em] leading-relaxed">
                Payload_Synchronized
              </p>
            </div>
          )}

          {participantStatus !== 'ready' && status === 'error' && (
            <div className="bg-rose-500/5 border border-rose-500/20 rounded-xl p-5 text-center space-y-3">
              <AlertCircle className="h-8 w-8 mx-auto text-rose-500" />
              <p className="text-rose-500 font-black text-[10px] uppercase tracking-[0.2em]">CONNECTION_FAILED</p>
              <button onClick={cancelTransfer} className="btn btn-secondary w-full h-9 text-[9px]">RETRY</button>
            </div>
          )}
        </div>
      )}

      <div className="bg-slate-50 dark:bg-slate-800/10 rounded-xl p-3 border border-slate-200/50 dark:border-slate-800">
        <p className="text-[8px] text-slate-400 dark:text-slate-500 text-center font-black uppercase tracking-[0.2em] leading-relaxed">
          E2E P2P Pipe // DTLS encrypted, resumable<br/>
          <span className="text-slate-300 dark:text-slate-650 mt-1 block">Protocols: MP4, WebM, MOV, AVI</span>
        </p>
      </div>
    </div>
  )
}
