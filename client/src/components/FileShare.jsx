import React, { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Upload,
  Download,
  Copy,
  Check,
  X,
  FileIcon,
  Share2,
  ShieldCheck,
  Zap,
  AlertCircle,
  ArrowRight,
  KeyRound,
} from 'lucide-react'
import { useTransfers } from '../context/TransfersContext'
import { useToast } from '../context/ToastContext'
import { motion, AnimatePresence } from 'framer-motion'

// Thin view onto the app-level TransfersContext, so the transfer keeps running
// even when you leave this page (it's surfaced live in the sidebar).
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

  // Closing a transfer returns Home (the launcher), not the bare Files page.
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
    <div className="flex flex-col gap-6 max-w-4xl mx-auto py-2 font-sans">
      <div className="flex items-center justify-between border-b border-line pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-accent-soft border border-accent/25 text-accent">
            <Share2 size={20} />
          </div>
          <div>
            <h2 className="font-serif text-lg text-ink">P2P File Transfer</h2>
            <p className="text-xs text-muted">
              Encrypted direct browser-to-browser pipe · resumable
            </p>
          </div>
        </div>
        {mode !== 'idle' && (
          <button
            onClick={cancelTransfer}
            className="icon-btn"
            data-testid="fileshare-cancel"
            aria-label="Cancel transfer"
          >
            <X size={18} />
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {mode === 'idle' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-6"
          >
            {/* Sender panel */}
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
              className={`lg:col-span-7 panel p-6 sm:p-8 flex flex-col justify-between transition-all duration-300 group ${
                dragging ? 'border-accent bg-accent-soft/40' : 'hover:border-line-strong'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-accent-soft border border-accent/30 text-accent flex items-center justify-center group-hover:scale-105 transition-transform duration-300">
                    <Upload size={22} />
                  </div>
                  <span className="text-[11px] font-mono uppercase tracking-wider text-muted px-2.5 py-1 rounded-full bg-panel-2 border border-line">
                    WebRTC DataChannel
                  </span>
                </div>
                <h3 className="font-serif text-2xl sm:text-3xl text-ink mb-1.5">
                  Drop it.{' '}
                  <span className="italic font-normal text-accent">
                    Don’t upload it.
                  </span>
                </h3>
                <p className="text-sm text-ink-soft mb-6 leading-relaxed">
                  Stream files directly from your device. No servers store your files;
                  interrupted transfers resume where they left off.
                </p>
              </div>
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
                className="btn btn-primary w-full h-11 text-xs uppercase tracking-wider"
              >
                Choose Files
              </button>
            </div>

            {/* Receiver panel */}
            <div className="lg:col-span-5 panel p-6 sm:p-8 flex flex-col justify-between hover:border-line-strong transition-all duration-300 group">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-mint-soft border border-mint/30 text-mint flex items-center justify-center mb-4 group-hover:scale-105 transition-transform duration-300">
                  <Download size={22} />
                </div>
                <h3 className="font-serif text-2xl text-ink mb-1.5">Receive Files</h3>
                <p className="text-sm text-ink-soft mb-6 leading-relaxed">
                  Enter the 8-character code from the sender to start the transfer.
                </p>
              </div>
              <div className="space-y-3">
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={inputCode}
                    onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                    placeholder="CODE (E.G. A1B2C3D4)"
                    className="input-field pl-10 text-center font-mono uppercase tracking-widest h-11"
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
                  className="btn btn-secondary w-full h-11 text-xs uppercase tracking-wider inline-flex items-center justify-center gap-1.5"
                  data-testid="fileshare-join"
                >
                  Join Transfer
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {mode === 'sharing' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
          >
            {/* Share Code Presentation */}
            <div className="panel p-6 sm:p-8 text-center border-accent/30 bg-accent-soft/20">
              <ShieldCheck className="mx-auto mb-3 text-accent" size={36} />
              <p className="text-xs font-bold uppercase tracking-widest mb-3 text-accent">
                Your share code
              </p>
              <div
                className="flex items-center justify-center gap-1.5 mb-4"
                data-testid="fileshare-code"
              >
                {shareCode.split('').map((char, i) => (
                  <span
                    key={i}
                    className="w-9 h-11 border border-line-strong rounded-lg flex items-center justify-center text-xl font-bold font-mono shadow-sm bg-panel-2 text-ink"
                  >
                    {char}
                  </span>
                ))}
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(shareCode)
                  setCopied(true)
                  notify(`Copied transfer code · ${shareCode}`, 'Share it with the recipient', 'mint')
                  setTimeout(() => setCopied(false), 2000)
                }}
                className="text-xs font-semibold text-ink-soft hover:text-ink flex items-center gap-1.5 mx-auto bg-panel-2 py-1.5 px-3.5 rounded-lg transition-colors border border-line"
              >
                {copied ? (
                  <>
                    <Check size={13} className="text-mint" /> Copied
                  </>
                ) : (
                  <>
                    <Copy size={13} /> Copy Code
                  </>
                )}
              </button>
            </div>

            {/* Selected Files List */}
            <div className="panel p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-widest text-muted">
                  Files ({selectedFiles.length})
                </h3>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md bg-mint-soft text-mint border border-mint/25">
                  Ready to send
                </span>
              </div>
              <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
                {selectedFiles.map((file, i) => {
                  const progress = uploadProgress[i] || 0
                  return (
                    <div
                      key={i}
                      className="p-3 rounded-xl border border-line bg-panel-2 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 overflow-hidden">
                          <FileIcon size={18} className="shrink-0 text-accent" />
                          <div className="min-w-0">
                            <p className="text-xs font-bold truncate text-ink">
                              {file.name}
                            </p>
                            <p className="text-[10px] text-muted font-mono">
                              {formatFileSize(file.size)}
                            </p>
                          </div>
                        </div>
                        {progress > 0 && (
                          <span className="text-[10px] font-bold font-mono text-accent">
                            {progress}%
                          </span>
                        )}
                      </div>
                      {progress > 0 && (
                        <div className="w-full h-1.5 rounded-full overflow-hidden bg-panel">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            className="h-full rounded-full bg-accent"
                          />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </motion.div>
        )}

        {mode === 'receiving' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
          >
            {/* Connection coordinates header */}
            <div className="panel p-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5 text-muted">
                  Share code
                </p>
                <p className="text-lg font-bold font-mono tracking-widest text-ink">
                  {shareCode}
                </p>
              </div>
              <div className="px-3 py-1 bg-mint-soft text-mint text-xs font-bold rounded-lg border border-mint/25">
                Connected
              </div>
            </div>

            {receiverStatus === 'error' && (
              <div
                className="panel p-5 border-coral/30 bg-coral-soft flex gap-3 items-center"
                data-testid="fileshare-failed"
              >
                <AlertCircle className="text-coral shrink-0" size={24} />
                <div>
                  <p className="text-xs font-bold text-coral">Connection failed</p>
                  <p className="text-xs mt-0.5 text-ink-soft">
                    {joinError ||
                      "Couldn't establish a direct connection. The sender may be offline, or the network is too restrictive."}
                  </p>
                </div>
              </div>
            )}

            {receiverStatus === 'connecting' && (
              <div className="panel p-8 text-center flex flex-col items-center justify-center">
                <Zap
                  className="animate-bounce mb-3 text-accent"
                  size={32}
                  fill="currentColor"
                />
                <p className="text-xs font-bold text-ink">Connecting to the sender…</p>
                <p className="text-[10px] mt-1 text-muted">
                  Setting up a direct connection
                </p>
              </div>
            )}

            {receiverStatus === 'ready' && pendingFiles.length > 0 && (
              <div className="panel p-6 shadow-xl space-y-5">
                <div>
                  <h3 className="text-sm font-bold text-ink">Files ready</h3>
                  <p className="text-xs text-muted">Accept to start downloading</p>
                </div>

                <div className="space-y-2.5 max-h-[200px] overflow-y-auto pr-1">
                  {pendingFiles.map((file, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-3 border border-line rounded-xl bg-panel-2"
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <FileIcon size={16} className="shrink-0 text-accent" />
                        <span className="text-xs font-bold truncate text-ink">
                          {file.name}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono shrink-0 text-muted">
                        {formatFileSize(file.size)}
                      </span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={handleStartDownload}
                  className="btn btn-primary w-full h-12 font-bold text-xs uppercase tracking-widest"
                  data-testid="fileshare-accept"
                >
                  Accept & Stream Files
                </button>
              </div>
            )}

            {receiverStatus === 'transferring' && (
              <div className="panel p-6 shadow-lg space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-widest animate-pulse text-muted">
                    Downloading
                  </h3>
                  <span className="text-xs font-bold text-mint">Connected</span>
                </div>

                <div className="space-y-4 max-h-[220px] overflow-y-auto">
                  {Object.entries(downloadProgress).map(([fileIndex, prog]) => (
                    <div
                      key={fileIndex}
                      className="space-y-2 p-2.5 border border-line rounded-xl bg-panel-2"
                    >
                      <div className="flex justify-between items-end gap-3">
                        <span className="text-xs font-bold truncate max-w-[80%] text-ink">
                          {pendingFiles[fileIndex]?.name ??
                            `File ${Number(fileIndex) + 1}`}
                        </span>
                        <span className="text-xs font-bold font-mono text-accent">
                          {prog}%
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full overflow-hidden bg-panel">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${prog}%` }}
                          className="h-full rounded-full bg-accent"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {receiverStatus === 'complete' && (
              <div
                className="panel p-8 text-center border-mint/30 bg-mint-soft/30 space-y-6"
                data-testid="fileshare-complete"
              >
                <div className="w-14 h-14 bg-mint-soft text-mint rounded-2xl flex items-center justify-center mx-auto shadow-sm border border-mint/30">
                  <Check size={28} className="animate-bounce" />
                </div>
                <div>
                  <h3 className="font-serif text-xl text-ink">All done</h3>
                  <p className="text-xs leading-relaxed mt-1 text-muted">
                    Your files were downloaded directly from the sender — check your
                    downloads folder.
                  </p>
                </div>
                <button
                  onClick={cancelTransfer}
                  className="btn btn-primary w-full h-11 text-xs uppercase tracking-wider"
                >
                  Done
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
