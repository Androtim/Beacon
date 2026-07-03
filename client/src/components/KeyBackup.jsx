import { useState } from 'react'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'
import { exportKeyBackup, importKeyBackup } from '../lib/dmCrypto'
import { KeyRound, Download, Upload } from 'lucide-react'

// Passphrase-protected backup of this device's DM key, so message history can
// move to another device. The exported blob is encrypted with the passphrase;
// the server never sees it.
export default function KeyBackup() {
  const { user } = useAuth()
  const [tab, setTab] = useState('export')
  const [pass, setPass] = useState('')
  const [blob, setBlob] = useState('')
  const [msg, setMsg] = useState(null) // { kind: 'ok'|'err', text }

  const doExport = async () => {
    setMsg(null)
    try {
      const out = await exportKeyBackup(user.id, pass)
      setBlob(out)
      const url = URL.createObjectURL(new Blob([out], { type: 'application/json' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `beacon-key-${user.username}.txt`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 30_000)
      setMsg({ kind: 'ok', text: 'Backup downloaded. Keep it and the passphrase safe.' })
    } catch (e) {
      setMsg({ kind: 'err', text: e.message })
    }
  }

  const doImport = async () => {
    setMsg(null)
    try {
      const publicJwk = await importKeyBackup(user.id, pass, blob.trim())
      // Republish the restored public key so peers encrypt to it.
      await axios.post('/api/auth/public-key', { publicKey: JSON.stringify(publicJwk) }).catch(() => {})
      setMsg({ kind: 'ok', text: 'Key restored. Reopen a conversation to read its history.' })
    } catch (e) {
      setMsg({ kind: 'err', text: e.message })
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <div className="w-9 h-9 rounded-xl grid place-items-center" style={{ background: 'rgb(var(--accent) / 0.14)', color: 'rgb(var(--accent))' }}>
          <KeyRound size={17} />
        </div>
        <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: 'var(--text-primary)' }}>Message key backup</h3>
      </div>

      <p className="text-[11px] leading-relaxed mb-4" style={{ color: 'var(--text-secondary)' }}>
        Your messages are encrypted with a key that lives only on this device. Back it up with a passphrase
        to read your history on another device. The backup is useless without the passphrase — keep both safe.
      </p>

      <div className="flex gap-1 mb-4 p-1 rounded-xl" style={{ background: 'var(--surface-raised)' }}>
        {['export', 'import'].map((t) => (
          <button key={t} onClick={() => { setTab(t); setMsg(null) }}
            className="flex-1 h-8 rounded-lg text-xs font-bold capitalize transition-colors"
            style={tab === t
              ? { background: 'rgb(var(--accent))', color: '#1a0f0d' }
              : { color: 'var(--text-secondary)' }}
            data-testid={`keybackup-tab-${t}`}>
            {t === 'export' ? 'Back up' : 'Restore'}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        <input type="password" className="input-field" placeholder="Passphrase (8+ characters)"
          value={pass} onChange={(e) => setPass(e.target.value)} data-testid="keybackup-pass" />

        {tab === 'import' && (
          <textarea className="input-field !h-24 resize-none font-mono !text-[10px]" placeholder="Paste your backup here"
            value={blob} onChange={(e) => setBlob(e.target.value)} data-testid="keybackup-blob" />
        )}

        <button onClick={tab === 'export' ? doExport : doImport}
          className="btn btn-primary w-full h-11 text-xs" data-testid="keybackup-go">
          {tab === 'export' ? <><Download size={15} /> Download backup</> : <><Upload size={15} /> Restore key</>}
        </button>

        {msg && (
          <p className="text-[11px] text-center leading-relaxed"
            style={{ color: msg.kind === 'ok' ? '#52b788' : '#fb7185' }} data-testid="keybackup-msg">
            {msg.text}
          </p>
        )}
      </div>
    </div>
  )
}
