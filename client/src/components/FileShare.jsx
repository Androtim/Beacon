import { useState, useRef } from 'react'
import { Upload, Download, Copy, Check, X, FileIcon, Share2, ShieldCheck, Zap, AlertCircle } from 'lucide-react'
import { useTransfers } from '../context/TransfersContext'
import { motion, AnimatePresence } from 'framer-motion'

// Thin view onto the app-level TransfersContext, so the transfer keeps running
// even when you leave this page (it's surfaced live in the sidebar).
export default function FileShare() {
  const [inputCode, setInputCode] = useState('')
  const [copied, setCopied] = useState(false)
  const fileInputRef = useRef(null)

  const {
    mode, shareCode, selectedFiles, pendingFiles, joinError,
    uploadProgress, downloadProgress, receiverStatus, formatFileSize,
    createShare, joinShare, startDownload, cancel: cancelTransfer,
  } = useTransfers()

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files)
    if (files.length) createShare(files)
    e.target.value = null
  }
  const joinFileShare = () => joinShare(inputCode.trim().toUpperCase())
  const handleStartDownload = () => startDownload()

  return (
    <div className="flex flex-col gap-6 max-w-xl mx-auto py-4 font-sans">
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl">
            <Share2 size={22} className="animate-pulse" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">P2P File Transfer</h2>
            <p className="text-xs text-slate-400 dark:text-slate-500">Encrypted direct browser-to-browser pipe · resumable</p>
          </div>
        </div>
        {mode !== 'idle' && (
          <button
            onClick={cancelTransfer}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"
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
            <div className="glass-card p-6 flex flex-col justify-between hover:border-blue-500/30 transition-all duration-300 group border border-slate-200/50 dark:border-slate-800">
              <div>
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform duration-300">
                  <Upload size={24} />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">Send Files</h3>
                <p className="text-xs text-slate-400 dark:text-slate-500 mb-6 leading-relaxed">
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
            <div className="glass-card p-6 flex flex-col justify-between hover:border-emerald-500/30 transition-all duration-300 group border border-slate-200/50 dark:border-slate-800">
              <div>
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform duration-300">
                  <Download size={24} />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">Receive Files</h3>
                <p className="text-xs text-slate-400 dark:text-slate-500 mb-6 leading-relaxed">
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
                  className="btn bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 w-full h-11 text-xs uppercase tracking-wider"
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
            <div className="glass-card p-6 text-center border border-blue-500/20 bg-blue-500/5">
              <ShieldCheck className="text-blue-500 dark:text-blue-400 mx-auto mb-3" size={36} />
              <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-3">Your share code</p>
              <div className="flex items-center justify-center gap-1.5 mb-4" data-testid="fileshare-code">
                {shareCode.split('').map((char, i) => (
                  <span
                    key={i}
                    className="w-9 h-11 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg flex items-center justify-center text-xl font-bold text-slate-850 dark:text-white font-mono shadow-sm"
                  >
                    {char}
                  </span>
                ))}
              </div>
              <button
                onClick={() => { navigator.clipboard.writeText(shareCode); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
                className="text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 flex items-center gap-1.5 mx-auto bg-slate-100 dark:bg-slate-800 py-1.5 px-3.5 rounded-lg transition-colors border border-slate-200/50 dark:border-slate-700/50"
              >
                {copied ? <><Check size={13} className="text-green-500 animate-bounce" /> Copied</> : <><Copy size={13} /> Copy Code</>}
              </button>
            </div>

            {/* Selected File List / Progress */}
            <div className="glass-card p-0 overflow-hidden border border-slate-200 dark:border-slate-800 shadow-lg">
              <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Sending</span>
                <span className="text-xs font-bold text-blue-600 dark:text-blue-400">{selectedFiles.length} file(s)</span>
              </div>
              <div className="p-4 space-y-3 max-h-[260px] overflow-y-auto">
                {selectedFiles.map((file, i) => {
                  const progress = uploadProgress[file.name] || 0
                  return (
                    <div key={i} className="flex flex-col gap-2 p-3 border border-slate-100 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-900/30">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 overflow-hidden">
                          <FileIcon size={16} className="text-blue-500 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{file.name}</p>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500">{formatFileSize(file.size)}</p>
                          </div>
                        </div>
                        {progress > 0 && (
                          <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">{progress}%</span>
                        )}
                      </div>
                      {progress > 0 && (
                        <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            className="h-full bg-blue-500 rounded-full"
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
            <div className="glass-card p-4 flex items-center justify-between bg-slate-50 dark:bg-slate-800/40 border border-slate-200/50 dark:border-slate-800">
              <div>
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-0.5">Share code</p>
                <p className="text-lg font-bold font-mono tracking-widest text-slate-800 dark:text-white">{shareCode}</p>
              </div>
              <div className="px-3 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold rounded-lg border border-emerald-500/20">
                Connected
              </div>
            </div>

            {receiverStatus === 'error' && (
              <div className="glass-card p-5 border-red-500/20 bg-red-500/5 flex gap-3 items-center" data-testid="fileshare-failed">
                <AlertCircle className="text-red-500 shrink-0" size={24} />
                <div>
                  <p className="text-xs font-bold text-red-500">Connection failed</p>
                  <p className="text-xs text-slate-500 dark:text-slate-450 mt-0.5">
                    {joinError || "Couldn't establish a direct connection. The sender may be offline, or the network is too restrictive."}
                  </p>
                </div>
              </div>
            )}

            {receiverStatus === 'connecting' && (
              <div className="glass-card p-8 text-center flex flex-col items-center justify-center border border-slate-200/50 dark:border-slate-800">
                <Zap className="text-blue-500 dark:text-blue-400 animate-bounce mb-3" size={32} fill="currentColor" />
                <p className="text-xs font-bold text-slate-650 dark:text-slate-350">Connecting to the sender…</p>
                <p className="text-[10px] text-slate-400 mt-1">Setting up a direct connection</p>
              </div>
            )}

            {receiverStatus === 'ready' && pendingFiles.length > 0 && (
              <div className="glass-card p-6 border border-slate-200/50 dark:border-slate-800 shadow-xl space-y-5 animate-in slide-in-from-bottom-2 duration-300">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-white">Files ready</h3>
                  <p className="text-xs text-slate-400 dark:text-slate-500">Accept to start downloading</p>
                </div>

                <div className="space-y-2.5 max-h-[200px] overflow-y-auto pr-1">
                  {pendingFiles.map((file, i) => (
                    <div key={i} className="flex items-center justify-between p-3 border border-slate-100 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-900/30">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <FileIcon size={16} className="text-emerald-500 shrink-0" />
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{file.name}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono shrink-0">{formatFileSize(file.size)}</span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={handleStartDownload}
                  className="btn btn-primary w-full h-12 font-bold text-xs uppercase tracking-widest shadow-blue-500/20"
                  data-testid="fileshare-accept"
                >
                  Accept & Stream Files
                </button>
              </div>
            )}

            {receiverStatus === 'transferring' && (
              <div className="glass-card p-6 border border-slate-200/50 dark:border-slate-800 shadow-lg space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-400 dark:text-slate-550 uppercase tracking-widest animate-pulse">Downloading</h3>
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">Connected</span>
                </div>

                <div className="space-y-4 max-h-[220px] overflow-y-auto">
                  {Object.entries(downloadProgress).map(([fileIndex, prog]) => (
                    <div key={fileIndex} className="space-y-2 p-2.5 border border-slate-100 dark:border-slate-800 rounded-xl bg-slate-50/30">
                      <div className="flex justify-between items-end gap-3">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate max-w-[80%]">
                          {pendingFiles[fileIndex]?.name ?? `File ${Number(fileIndex) + 1}`}
                        </span>
                        <span className="text-xs font-bold text-blue-600 dark:text-blue-400">{prog}%</span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${prog}%` }}
                          className="h-full bg-blue-500 rounded-full"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {receiverStatus === 'complete' && (
              <div className="glass-card p-8 text-center border border-emerald-500/20 bg-emerald-500/5 space-y-6" data-testid="fileshare-complete">
                <div className="w-14 h-14 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
                  <Check size={28} className="animate-bounce" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">All done</h3>
                  <p className="text-xs text-slate-400 dark:text-slate-500 leading-relaxed mt-1">
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
