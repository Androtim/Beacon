import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload, Download, Copy, Check, X, FileIcon, Share2, ShieldCheck, Zap, AlertCircle } from 'lucide-react'
import { useTransfers } from '../context/TransfersContext'
import { motion, AnimatePresence } from 'framer-motion'

// Thin view onto the app-level TransfersContext, so the transfer keeps running
// even when you leave this page (it's surfaced live in the sidebar).
export default function FileShare() {
  const [inputCode, setInputCode] = useState('')
  const [copied, setCopied] = useState(false)
  const fileInputRef = useRef(null)
  const navigate = useNavigate()

  const {
    mode, shareCode, selectedFiles, pendingFiles, joinError,
    uploadProgress, downloadProgress, receiverStatus, formatFileSize,
    createShare, joinShare, startDownload, cancel,
  } = useTransfers()

  // Closing a transfer returns Home (the launcher), not the bare Files page.
  const cancelTransfer = () => { cancel(); navigate('/') }

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files)
    if (files.length) createShare(files)
    e.target.value = null
  }
  const joinFileShare = () => joinShare(inputCode.trim().toUpperCase())
  const handleStartDownload = () => startDownload()

  return (
    <div className="flex flex-col gap-6 max-w-xl mx-auto py-4 font-sans">
      <div className="flex items-center justify-between border-b pb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl" style={{ background: 'rgb(var(--accent) / 0.12)', color: 'rgb(var(--accent))' }}>
            <Share2 size={22} className="animate-pulse" />
          </div>
          <div>
            <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>P2P File Transfer</h2>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Encrypted direct browser-to-browser pipe · resumable</p>
          </div>
        </div>
        {mode !== 'idle' && (
          <button
            onClick={cancelTransfer}
            className="btn-ghost p-2 rounded-lg transition-colors"
            data-testid="fileshare-cancel"
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
            className="grid grid-cols-1 sm:grid-cols-2 gap-6"
          >
            {/* Sender panel */}
            <div className="glass-card p-6 flex flex-col justify-between hover:border-[rgb(var(--accent)/0.3)] transition-all duration-300 group border">
              <div>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 group-hover:scale-105 transition-transform duration-300" style={{ background: 'rgb(var(--accent) / 0.12)', color: 'rgb(var(--accent))' }}>
                  <Upload size={24} />
                </div>
                <h3 className="text-base font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Send Files</h3>
                <p className="text-xs mb-6 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  Stream files directly from your device. No servers store your files; interrupted transfers resume where they left off.
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
            <div className="glass-card p-6 flex flex-col justify-between hover:border-[rgb(var(--accent-2)/0.3)] transition-all duration-300 group border">
              <div>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 group-hover:scale-105 transition-transform duration-300" style={{ background: 'rgb(var(--accent-2) / 0.12)', color: 'rgb(var(--accent-2))' }}>
                  <Download size={24} />
                </div>
                <h3 className="text-base font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Receive Files</h3>
                <p className="text-xs mb-6 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  Enter the 8-character code from the sender to start the transfer.
                </p>
              </div>
              <div className="space-y-3">
                <input
                  type="text"
                  value={inputCode}
                  onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                  placeholder="CODE (E.G. A1B2C3D4)"
                  className="input-field text-center font-mono uppercase tracking-widest h-11"
                  maxLength={8}
                  onKeyDown={(e) => e.key === 'Enter' && inputCode.length === 8 && joinFileShare()}
                  data-testid="fileshare-code-input"
                />
                <button
                  onClick={joinFileShare}
                  disabled={inputCode.length !== 8}
                  className="btn btn-secondary w-full h-11 text-xs uppercase tracking-wider"
                  data-testid="fileshare-join"
                >
                  Join Transfer
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
            <div className="glass-card p-6 text-center border" style={{ borderColor: 'rgb(var(--accent) / 0.2)', background: 'rgb(var(--accent) / 0.05)' }}>
              <ShieldCheck className="mx-auto mb-3" size={36} style={{ color: 'rgb(var(--accent))' }} />
              <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'rgb(var(--accent))' }}>Your share code</p>
              <div className="flex items-center justify-center gap-1.5 mb-4" data-testid="fileshare-code">
                {shareCode.split('').map((char, i) => (
                  <span
                    key={i}
                    className="w-9 h-11 border rounded-lg flex items-center justify-center text-xl font-bold font-mono shadow-sm"
                    style={{ background: 'var(--surface-raised)', color: 'var(--text-primary)' }}
                  >
                    {char}
                  </span>
                ))}
              </div>
              <button
                onClick={() => { navigator.clipboard.writeText(shareCode); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
                className="text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1.5 mx-auto bg-[var(--surface-raised)] py-1.5 px-3.5 rounded-lg transition-colors border"
              >
                {copied ? <><Check size={13} className="text-emerald-400 animate-bounce" /> Copied</> : <><Copy size={13} /> Copy Code</>}
              </button>
            </div>

            {/* Selected File List / Progress */}
            <div className="glass-card p-0 overflow-hidden border shadow-lg">
              <div className="px-5 py-3.5 border-b flex justify-between items-center" style={{ background: 'var(--surface)' }}>
                <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Sending</span>
                <span className="text-xs font-bold" style={{ color: 'rgb(var(--accent))' }}>{selectedFiles.length} file(s)</span>
              </div>
              <div className="p-4 space-y-3 max-h-[260px] overflow-y-auto">
                {selectedFiles.map((file, i) => {
                  const progress = uploadProgress[file.name] || 0
                  return (
                    <div key={i} className="flex flex-col gap-2 p-3 border rounded-xl" style={{ background: 'var(--surface)' }}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 overflow-hidden">
                          <FileIcon size={16} className="shrink-0" style={{ color: 'rgb(var(--accent))' }} />
                          <div className="min-w-0">
                            <p className="text-xs font-bold truncate" style={{ color: 'var(--text-primary)' }}>{file.name}</p>
                            <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>{formatFileSize(file.size)}</p>
                          </div>
                        </div>
                        {progress > 0 && (
                          <span className="text-[10px] font-bold" style={{ color: 'rgb(var(--accent))' }}>{progress}%</span>
                        )}
                      </div>
                      {progress > 0 && (
                        <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-raised)' }}>
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            className="h-full rounded-full"
                            style={{ background: 'rgb(var(--accent))' }}
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
            <div className="glass-card p-4 flex items-center justify-between border" style={{ background: 'var(--surface)' }}>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: 'var(--text-secondary)' }}>Share code</p>
                <p className="text-lg font-bold font-mono tracking-widest" style={{ color: 'var(--text-primary)' }}>{shareCode}</p>
              </div>
              <div className="px-3 py-1 bg-emerald-500/10 text-emerald-400 text-xs font-bold rounded-lg border border-emerald-500/20">
                Connected
              </div>
            </div>

            {receiverStatus === 'error' && (
              <div className="glass-card p-5 border-rose-500/20 bg-rose-500/5 flex gap-3 items-center" data-testid="fileshare-failed">
                <AlertCircle className="text-rose-400 shrink-0" size={24} />
                <div>
                  <p className="text-xs font-bold text-rose-400">Connection failed</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                    {joinError || "Couldn't establish a direct connection. The sender may be offline, or the network is too restrictive."}
                  </p>
                </div>
              </div>
            )}

            {receiverStatus === 'connecting' && (
              <div className="glass-card p-8 text-center flex flex-col items-center justify-center border">
                <Zap className="animate-bounce mb-3" size={32} fill="currentColor" style={{ color: 'rgb(var(--accent))' }} />
                <p className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>Connecting to the sender…</p>
                <p className="text-[10px] mt-1" style={{ color: 'var(--text-secondary)' }}>Setting up a direct connection</p>
              </div>
            )}

            {receiverStatus === 'ready' && pendingFiles.length > 0 && (
              <div className="glass-card p-6 border shadow-xl space-y-5 animate-in slide-in-from-bottom-2 duration-300">
                <div>
                  <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Files ready</h3>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Accept to start downloading</p>
                </div>

                <div className="space-y-2.5 max-h-[200px] overflow-y-auto pr-1">
                  {pendingFiles.map((file, i) => (
                    <div key={i} className="flex items-center justify-between p-3 border rounded-xl" style={{ background: 'var(--surface)' }}>
                      <div className="flex items-center gap-3 overflow-hidden">
                        <FileIcon size={16} className="shrink-0" style={{ color: 'rgb(var(--accent-2))' }} />
                        <span className="text-xs font-bold truncate" style={{ color: 'var(--text-primary)' }}>{file.name}</span>
                      </div>
                      <span className="text-[10px] font-mono shrink-0" style={{ color: 'var(--text-secondary)' }}>{formatFileSize(file.size)}</span>
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
              <div className="glass-card p-6 border shadow-lg space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-widest animate-pulse" style={{ color: 'var(--text-secondary)' }}>Downloading</h3>
                  <span className="text-xs font-bold text-emerald-400">Connected</span>
                </div>

                <div className="space-y-4 max-h-[220px] overflow-y-auto">
                  {Object.entries(downloadProgress).map(([fileIndex, prog]) => (
                    <div key={fileIndex} className="space-y-2 p-2.5 border rounded-xl" style={{ background: 'var(--surface)' }}>
                      <div className="flex justify-between items-end gap-3">
                        <span className="text-xs font-bold truncate max-w-[80%]" style={{ color: 'var(--text-primary)' }}>
                          {pendingFiles[fileIndex]?.name ?? `File ${Number(fileIndex) + 1}`}
                        </span>
                        <span className="text-xs font-bold" style={{ color: 'rgb(var(--accent))' }}>{prog}%</span>
                      </div>
                      <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'var(--surface-raised)' }}>
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${prog}%` }}
                          className="h-full rounded-full"
                          style={{ background: 'rgb(var(--accent))' }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {receiverStatus === 'complete' && (
              <div className="glass-card p-8 text-center border border-emerald-500/20 bg-emerald-500/5 space-y-6" data-testid="fileshare-complete">
                <div className="w-14 h-14 bg-emerald-500/10 text-emerald-400 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
                  <Check size={28} className="animate-bounce" />
                </div>
                <div>
                  <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>All done</h3>
                  <p className="text-xs leading-relaxed mt-1" style={{ color: 'var(--text-secondary)' }}>
                    Your files were downloaded directly from the sender — check your downloads folder.
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
