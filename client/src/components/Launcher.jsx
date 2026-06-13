import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTransfers } from '../context/TransfersContext'
import { Plus, Tv, FolderUp, ArrowRight } from 'lucide-react'

// One entry point for both worlds: a "New" button (watch party / send files)
// and a single code box that routes by code shape — 8-char codes are file
// shares, everything else is a watch-party room (which is join-or-create).
export default function Launcher({ variant = 'hero' }) {
  const navigate = useNavigate()
  const { createShare, joinShare } = useTransfers()
  const [code, setCode] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const fileRef = useRef(null)
  const wrapRef = useRef(null)

  useEffect(() => {
    if (!menuOpen) return
    const close = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setMenuOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [menuOpen])

  const newParty = () => {
    setMenuOpen(false)
    navigate(`/party/${Math.random().toString(36).substring(2, 8).toUpperCase()}`)
  }
  const newFiles = () => { setMenuOpen(false); fileRef.current?.click() }
  const onFiles = (e) => {
    const files = Array.from(e.target.files)
    if (files.length) { createShare(files); navigate('/files') }
    e.target.value = null
  }

  const submitCode = (e) => {
    e.preventDefault()
    const c = code.trim().toUpperCase()
    if (!c) return
    if (c.length === 8) { joinShare(c); navigate('/files') } // file share
    else navigate(`/party/${c}`) // watch party (join or create)
    setCode('')
  }

  const NewMenu = () => (
    <div className="absolute z-30 mt-2 w-48 rounded-xl overflow-hidden border shadow-xl"
      style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)' }} data-testid="new-menu">
      <button onClick={newParty} className="w-full flex items-center gap-2.5 px-4 py-3 text-sm font-semibold hover:bg-[rgb(var(--accent-2)/0.12)]" style={{ color: 'var(--text-primary)' }} data-testid="new-party">
        <Tv size={16} style={{ color: 'rgb(var(--accent))' }} /> Watch party
      </button>
      <button onClick={newFiles} className="w-full flex items-center gap-2.5 px-4 py-3 text-sm font-semibold hover:bg-[rgb(var(--accent-2)/0.12)]" style={{ color: 'var(--text-primary)' }} data-testid="new-files">
        <FolderUp size={16} style={{ color: 'rgb(var(--accent))' }} /> Send files
      </button>
    </div>
  )

  const fileInput = <input ref={fileRef} type="file" multiple className="hidden" onChange={onFiles} data-testid="launcher-file-input" />

  if (variant === 'rail') {
    return (
      <div ref={wrapRef} className="relative px-1 space-y-2" data-testid="launcher-rail">
        {fileInput}
        <button onClick={() => setMenuOpen((o) => !o)} className="btn btn-primary w-full h-10 text-xs" data-testid="new-button">
          <Plus size={15} /> New
        </button>
        {menuOpen && <NewMenu />}
        <form onSubmit={submitCode}>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Enter a code…"
            className="input-field h-9 text-xs text-center font-mono tracking-widest"
            maxLength={8}
            data-testid="launcher-code"
          />
        </form>
      </div>
    )
  }

  // hero (Home)
  return (
    <div ref={wrapRef} className="relative flex flex-col sm:flex-row items-stretch gap-3" data-testid="launcher-hero">
      {fileInput}
      <div className="relative">
        <button onClick={() => setMenuOpen((o) => !o)} className="btn btn-primary h-14 px-7 text-sm w-full sm:w-auto" data-testid="new-button">
          <Plus size={18} /> New
        </button>
        {menuOpen && <NewMenu />}
      </div>
      <form onSubmit={submitCode} className="flex gap-2 flex-1">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Paste a code to join…"
          className="input-field h-14 flex-1 text-center font-mono tracking-[0.3em]"
          maxLength={8}
          data-testid="launcher-code"
        />
        <button type="submit" disabled={!code.trim()} className="btn btn-secondary h-14 px-6" data-testid="launcher-join">
          Join <ArrowRight size={16} />
        </button>
      </form>
    </div>
  )
}
