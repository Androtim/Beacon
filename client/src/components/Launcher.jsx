import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTransfers } from '../context/TransfersContext'
import { randomCode } from '../lib/randomCode'
import { Plus, Tv, FolderUp, ArrowRight, ChevronDown } from 'lucide-react'

// Unified entry point: "New" (watch party / send files) + one code box that
// routes by code shape — 8-char codes are file shares, everything else is a
// watch-party room (join-or-create).
export default function Launcher({ variant = 'hero' }) {
  const navigate = useNavigate()
  const { createShare, joinShare } = useTransfers()
  const [code, setCode] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const fileRef = useRef(null)
  const wrapRef = useRef(null)

  useEffect(() => {
    if (!menuOpen) return
    const close = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [menuOpen])

  const newParty = () => {
    setMenuOpen(false)
    navigate(`/party/${randomCode(6)}`)
  }
  const newFiles = () => {
    setMenuOpen(false)
    fileRef.current?.click()
  }
  const onFiles = (e) => {
    const files = Array.from(e.target.files)
    if (files.length) {
      createShare(files)
      navigate('/files')
    }
    e.target.value = null
  }

  const submitCode = (e) => {
    e.preventDefault()
    const c = code.trim().toUpperCase()
    if (!c) return
    if (c.length === 8) {
      joinShare(c)
      navigate('/files')
    } else {
      navigate(`/party/${c}`)
    }
    setCode('')
  }

  const NewMenu = () => (
    <div
      className="absolute left-0 z-30 mt-1.5 w-48 rounded-xl overflow-hidden border border-line-strong bg-panel shadow-2xl p-1"
      data-testid="new-menu"
    >
      <button
        type="button"
        onClick={newParty}
        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-ink hover:bg-panel-2 transition-colors"
        data-testid="new-party"
      >
        <Tv size={14} className="text-accent" />
        <span>Watch party</span>
      </button>
      <button
        type="button"
        onClick={newFiles}
        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-ink hover:bg-panel-2 transition-colors"
        data-testid="new-files"
      >
        <FolderUp size={14} className="text-accent" />
        <span>Send files</span>
      </button>
    </div>
  )

  const fileInput = (
    <input
      ref={fileRef}
      type="file"
      multiple
      className="hidden"
      onChange={onFiles}
      data-testid="launcher-file-input"
    />
  )

  if (variant === 'rail') {
    return (
      <div ref={wrapRef} className="relative space-y-1.5" data-testid="launcher-rail">
        {fileInput}
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          className="btn btn-primary w-full h-8 text-xs justify-between px-2.5"
          data-testid="new-button"
        >
          <span className="inline-flex items-center gap-1.5">
            <Plus size={14} />
            New
          </span>
          <ChevronDown size={13} className="opacity-70" />
        </button>
        {menuOpen && <NewMenu />}
        <form onSubmit={submitCode}>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Join code…"
            className="input-field h-8 text-[11px] font-mono tracking-wider"
            maxLength={8}
            data-testid="launcher-code"
          />
        </form>
      </div>
    )
  }

  // hero (Home command bar)
  return (
    <div
      ref={wrapRef}
      className="relative flex flex-col sm:flex-row items-stretch gap-2 p-1.5 rounded-xl bg-panel border border-line-strong"
      data-testid="launcher-hero"
    >
      {fileInput}
      <div className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          className="btn btn-primary h-10 px-4 text-xs w-full sm:w-auto"
          data-testid="new-button"
        >
          <Plus size={15} />
          <span>New</span>
          <ChevronDown size={13} className="opacity-70" />
        </button>
        {menuOpen && <NewMenu />}
      </div>

      <div className="hidden sm:block w-px bg-line my-1.5" />

      <form onSubmit={submitCode} className="flex items-center gap-1.5 flex-1">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Paste a 6-char room or 8-char file code…"
          className="flex-1 h-10 bg-transparent px-3 text-xs text-ink placeholder:text-faint font-mono tracking-wider focus:outline-none"
          maxLength={8}
          data-testid="launcher-code"
        />
        <button
          type="submit"
          disabled={!code.trim()}
          className="btn btn-secondary h-9 px-3.5 text-xs shrink-0"
          data-testid="launcher-join"
        >
          <span>Join</span>
          <ArrowRight size={13} />
        </button>
      </form>
    </div>
  )
}
