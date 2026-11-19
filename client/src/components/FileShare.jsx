import React, { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Upload,
  Download,
  Copy,
  Check,
  X,
  FileIcon,
  Zap,
  AlertCircle,
  ArrowRight,
  KeyRound,
} from 'lucide-react'
import { useTransfers } from '../context/TransfersContext'
import { useToast } from '../context/ToastContext'

export default function FileShare() {
  const [inputCode, setInputCode] = useState('')
  const [copied, setCopied] = useState(false)
  const [dragging, setDragging] = useState(false)
  const fileInputRef = useRef(null)
  const navigate = useNavigate()
  const { notify } = useToast()

  const {
    mode,
    shareCode,
    selectedFiles,
    pendingFiles,
    joinError,
    uploadProgress,
    downloadProgress,
    receiverStatus,
    formatFileSize,
    createShare,
    joinShare,
    startDownload,
    cancel,
  } = useTransfers()

  const cancelTransfer = () => {
    cancel()
    navigate('/')
  }

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files)
    if (files.length) createShare(files)
    e.target.value = null
  }
  const joinFileShare = () => joinShare(inputCode.trim().toUpperCase())
  const handleStartDownload = () => startDownload()

  return (
    <div className="space-y-4">
      {mode !== 'idle' && (
        <div className="flex items-center justify-between panel px-4 py-2.5">
          <div className="flex items-center gap-2.5 text-xs">
            <span className="w-2 h-2 rounded-full bg-accent" />
            <span className="font-medium text-ink">
              {mode === 'sharing' ? 'Sharing session' : 'Receiving session'}
            </span>
            {shareCode && (
              <span className="font-mono text-muted">{shareCode}</span>
            )}
          </div>
          <button
            onClick={cancelTransfer}
            className="btn btn-ghost h-7 px-2.5 text-xs text-muted hover:text-coral"
            data-testid="fileshare-cancel"
            aria-label="Cancel transfer"
          >
            <X size={14} />
            Cancel
          </button>
        </div>
      )}

      {mode === 'idle' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Sender dropzone */}
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragging(false)
              const files = Array.from(e.dataTransfer.files || [])
              if (files.length) createShare(files)
            }}
            className={`lg:col-span-7 panel p-6 flex flex-col justify-between gap-6 transition-colors ${
              dragging ? 'border-accent bg-accent-soft/40' : 'hover:border-line-strong'
            }`}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-lg bg-panel-2 border border-line text-accent flex items-center justify-center">
                  <Upload size={17} />
                </div>
                <span className="text-[11px] font-mono text-faint">
                  WebRTC DataChannel
                </span>
              </div>
              <div>
                <h2 className="text-base font-semibold tracking-[-0.02em] text-ink">
                  Send files
                </h2>
                <p className="text-xs text-muted mt-1 leading-relaxed">
                  Drop files here or browse to generate an 8-character transfer code. Multiple files bundle automatically as a zip.
                </p>
              </div>
            </div>

            <div className="space-y-2.5">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileSelect}
                className="hidden"
                data-testid="fileshare-input"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="btn btn-primary w-full h-10 text-xs"
              >
                <Upload size={14} />
                Choose files
              </button>
            </div>
          </div>

          {/* Receiver code entry */}
          <div className="lg:col-span-5 panel p-6 flex flex-col justify-between gap-6">
            <div className="space-y-3">
              <div className="w-9 h-9 rounded-lg bg-panel-2 border border-line text-mint flex items-center justify-center">
                <Download size={17} />
              </div>
              <div>
                <h2 className="text-base font-semibold tracking-[-0.02em] text-ink">
                  Receive files
                </h2>
                <p className="text-xs text-muted mt-1 leading-relaxed">
                  Enter the 8-character code from the sender to connect directly.
                </p>
              </div>
            </div>

            <div className="space-y-2.5">
              <div className="relative">
                <KeyRound className="w-3.5 h-3.5 text-faint absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={inputCode}
                  onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                  placeholder="8-CHAR CODE"
                  className="input-field pl-9 text-center font-mono uppercase tracking-[0.22em] h-10"
                  maxLength={8}
                  onKeyDown={(e) =>
                    e.key === 'Enter' && inputCode.length === 8 && joinFileShare()
                  }
                  data-testid="fileshare-code-input"
                />
              </div>
              <button
                onClick={joinFileShare}
                disabled={inputCode.length !== 8}
                className="btn btn-secondary w-full h-10 text-xs"
                data-testid="fileshare-join"
              >
                Join transfer
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {mode === 'sharing' && (
        <div className="space-y-4">
          <div className="panel p-6 text-center space-y-4">
            <p className="text-xs text-muted">
              Share this code with the recipient
            </p>
            <div
              className="flex items-center justify-center gap-1.5"
              data-testid="fileshare-code"
            >
              {shareCode.split('').map((char, i) => (
                <span
                  key={i}
                  className="w-9 h-11 border border-line-strong rounded-lg flex items-center justify-center text-lg font-semibold font-mono bg-panel-2 text-ink"
                >
                  {char}
                </span>
              ))}
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(shareCode)
                setCopied(true)
                notify(`Copied code · ${shareCode}`, 'Share it with the recipient', 'mint')
                setTimeout(() => setCopied(false), 2000)
              }}
              className="btn btn-secondary h-8 px-3 text-xs mx-auto"
            >
              {copied ? (
                <>
                  <Check size={13} className="text-mint" /> Copied
                </>
              ) : (
                <>
                  <Copy size={13} /> Copy code
                </>
              )}
            </button>
          </div>

          <div className="panel p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-medium text-muted">
                Files ({selectedFiles.length})
              </h3>
              <span className="text-[11px] font-medium text-mint">Ready to send</span>
            </div>
            <div className="space-y-2 max-h-[240px] overflow-y-auto">
              {selectedFiles.map((file, i) => {
                const progress = uploadProgress[file.name] || uploadProgress[i] || 0
                return (
                  <div
                    key={i}
                    className="p-3 rounded-lg border border-line bg-panel-2 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <FileIcon size={15} className="shrink-0 text-accent" />
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate text-ink">
                            {file.name}
                          </p>
                          <p className="text-[11px] text-faint font-mono">
                            {formatFileSize(file.size)}
                          </p>
                        </div>
                      </div>
                      {progress > 0 && (
                        <span className="text-[11px] font-mono text-accent">
                          {progress}%
                        </span>
                      )}
                    </div>
                    {progress > 0 && (
                      <div className="w-full h-1.5 rounded-full overflow-hidden bg-panel">
                        <div
                          style={{ width: `${progress}%` }}
                          className="h-full rounded-full bg-accent transition-all duration-150"
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {mode === 'receiving' && (
        <div className="space-y-4">
          {receiverStatus === 'error' && (
            <div
              className="panel p-4 border-coral/30 bg-coral-soft flex gap-3 items-center"
              data-testid="fileshare-failed"
            >
              <AlertCircle className="text-coral shrink-0" size={18} />
              <div>
                <p className="text-xs font-medium text-coral">Connection failed</p>
                <p className="text-xs mt-0.5 text-ink-soft">
                  {joinError ||
                    "Couldn't establish a direct connection. The sender may be offline."}
                </p>
              </div>
            </div>
          )}

          {receiverStatus === 'connecting' && (
            <div className="panel p-8 text-center flex flex-col items-center justify-center gap-2">
              <Zap className="text-accent animate-pulse" size={22} />
              <p className="text-xs font-medium text-ink">Connecting to sender…</p>
              <p className="text-[11px] text-muted">Negotiating direct peer channel</p>
            </div>
          )}

          {receiverStatus === 'ready' && pendingFiles.length > 0 && (
            <div className="panel p-5 space-y-4">
              <div>
                <h3 className="text-sm font-medium text-ink">Incoming files</h3>
                <p className="text-xs text-muted mt-0.5">
                  Accept to stream directly to your device
                </p>
              </div>

              <div className="space-y-2 max-h-[220px] overflow-y-auto">
                {pendingFiles.map((file, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-2.5 border border-line rounded-lg bg-panel-2"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <FileIcon size={15} className="shrink-0 text-accent" />
                      <span className="text-xs font-medium truncate text-ink">
                        {file.name}
                      </span>
                    </div>
                    <span className="text-[11px] font-mono shrink-0 text-muted">
                      {formatFileSize(file.size)}
                    </span>
                  </div>
                ))}
              </div>

              <button
                onClick={handleStartDownload}
                className="btn btn-primary w-full h-10 text-xs"
                data-testid="fileshare-accept"
              >
                <Download size={14} />
                Accept & download
              </button>
            </div>
          )}

          {receiverStatus === 'transferring' && (
            <div className="panel p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-medium text-ink">Downloading…</h3>
                <span className="text-[11px] font-medium text-mint">Connected</span>
              </div>

              <div className="space-y-3 max-h-[240px] overflow-y-auto">
                {Object.entries(downloadProgress).map(([fileIndex, prog]) => (
                  <div
                    key={fileIndex}
                    className="space-y-2 p-3 border border-line rounded-lg bg-panel-2"
                  >
                    <div className="flex justify-between items-center gap-3">
                      <span className="text-xs font-medium truncate text-ink">
                        {pendingFiles[fileIndex]?.name ??
                          `File ${Number(fileIndex) + 1}`}
                      </span>
                      <span className="text-xs font-mono text-accent">{prog}%</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full overflow-hidden bg-panel">
                      <div
                        style={{ width: `${prog}%` }}
                        className="h-full rounded-full bg-accent transition-all duration-150"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {receiverStatus === 'complete' && (
            <div
              className="panel p-8 text-center border-mint/25 space-y-4"
              data-testid="fileshare-complete"
            >
              <div className="w-10 h-10 bg-mint-soft text-mint rounded-xl flex items-center justify-center mx-auto">
                <Check size={20} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-ink">Transfer complete</h3>
                <p className="text-xs text-muted mt-1">
                  Your files were saved directly to your downloads folder.
                </p>
              </div>
              <button
                onClick={cancelTransfer}
                className="btn btn-primary h-9 px-6 text-xs mx-auto"
              >
                Done
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
