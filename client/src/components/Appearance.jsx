import { useState } from 'react'
import { useTheme } from '../context/ThemeContext'
import { TOKENS } from '../lib/themes'
import { Sparkles, SlidersHorizontal, Code2, Sun, Moon, Check, Copy, AlertTriangle, Zap } from 'lucide-react'

const MODES = [
  { id: 'easy', label: 'Easy', icon: Sparkles, hint: 'Presets & basics' },
  { id: 'advanced', label: 'Advanced', icon: SlidersHorizontal, hint: 'Fine-tune tokens' },
  { id: 'tinkerer', label: 'Tinkerer', icon: Code2, hint: 'Full control' },
]

// rgb tokens are stored as "r g b"; the color inputs need hex.
const rgbToHex = (triplet) => {
  const [r, g, b] = (triplet || '0 0 0').split(/\s+/).map(Number)
  return '#' + [r, g, b].map((n) => Math.max(0, Math.min(255, n || 0)).toString(16).padStart(2, '0')).join('')
}
const hexToRgb = (hex) => {
  const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex)
  return m ? `${parseInt(m[1], 16)} ${parseInt(m[2], 16)} ${parseInt(m[3], 16)}` : '0 0 0'
}

function PreviewPane() {
  return (
    <div className="glass-card p-4 space-y-3" data-testid="theme-preview">
      <div className="flex items-center gap-2">
        <div className="beacon-mark w-8 h-8 rounded-xl grid place-items-center"><Zap size={14} className="text-white" /></div>
        <span className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>Preview</span>
      </div>
      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>This is how things look right now.</p>
      <div className="flex gap-2">
        <button className="btn btn-primary h-9 px-4 text-xs">Primary</button>
        <button className="btn btn-secondary h-9 px-4 text-xs">Secondary</button>
      </div>
      <div className="flex gap-2">
        <div className="px-3 py-2 text-xs max-w-[70%]" style={{ background: 'rgb(var(--accent))', color: '#1a0f0d', borderRadius: 'var(--radius)', borderTopRightRadius: 4 }}>Your message</div>
      </div>
      <div className="px-3 py-2 text-xs" style={{ background: 'var(--surface-raised)', color: 'var(--text-primary)', borderRadius: 'var(--radius)' }}>A surface card</div>
    </div>
  )
}

export default function Appearance() {
  const {
    presetId, presets, mode, motion, overrides, customCss,
    setPreset, setToken, setMode, setMotion, setCustomCss, validateCustomCss, exportTheme, importTheme,
  } = useTheme()
  const [uiMode, setUiMode] = useState('easy')
  const [cssDraft, setCssDraft] = useState(customCss)
  const [cssError, setCssError] = useState(null)
  const [shareCode, setShareCode] = useState('')
  const [importCode, setImportCode] = useState('')
  const [importMsg, setImportMsg] = useState(null)
  const [copied, setCopied] = useState(false)

  const tokenVal = (key) => overrides[key] ?? presets[presetId].tokens[key]

  const applyCss = () => {
    const result = validateCustomCss(cssDraft)
    if (!result.ok) { setCssError(result.error); return }
    setCssError(null)
    setCustomCss(cssDraft)
  }

  const doExport = () => { setShareCode(exportTheme()); setCopied(false) }
  const doImport = () => setImportMsg(importTheme(importCode))

  return (
    <div className="space-y-5">
      {/* Mode switch */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'rgb(0 0 0 / 0.2)' }}>
        {MODES.map(({ id, label, icon: Icon, hint }) => (
          <button
            key={id}
            onClick={() => setUiMode(id)}
            data-testid={`appearance-mode-${id}`}
            className="flex-1 px-3 py-2 rounded-lg text-xs font-bold transition-all flex flex-col items-center gap-0.5"
            style={uiMode === id ? { background: 'rgb(var(--accent) / 0.2)', color: 'rgb(var(--accent))' } : { color: 'var(--text-secondary)' }}
          >
            <span className="flex items-center gap-1.5"><Icon size={13} /> {label}</span>
            <span className="text-[9px] font-medium opacity-70">{hint}</span>
          </button>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        <div className="space-y-4">
          {/* Light/dark + motion always available */}
          <div className="flex gap-2">
            <button onClick={() => setMode('dark')} className="btn btn-secondary flex-1 h-10 text-xs" style={mode === 'dark' ? { borderColor: 'rgb(var(--accent))' } : undefined}><Moon size={14} /> Dark</button>
            <button onClick={() => setMode('light')} className="btn btn-secondary flex-1 h-10 text-xs" style={mode === 'light' ? { borderColor: 'rgb(var(--accent))' } : undefined}><Sun size={14} /> Light</button>
          </div>
          <label className="flex items-center justify-between glass-card px-4 py-3">
            <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Animations & glow</span>
            <input type="checkbox" checked={motion} onChange={(e) => setMotion(e.target.checked)} data-testid="motion-toggle" />
          </label>

          {/* EASY: presets + accent */}
          {uiMode === 'easy' && (
            <>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-secondary)' }}>Theme</p>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(presets).map(([id, p]) => (
                    <button
                      key={id}
                      onClick={() => setPreset(id)}
                      data-testid={`preset-${id}`}
                      className="px-3 py-2.5 rounded-xl text-xs font-bold text-left border transition-all"
                      style={{
                        borderColor: presetId === id ? 'rgb(var(--accent))' : 'var(--border)',
                        background: 'var(--surface-raised)', color: 'var(--text-primary)',
                      }}
                    >
                      <span className="inline-block w-3 h-3 rounded-full mr-2 align-middle" style={{ background: `rgb(${p.tokens['--accent']})` }} />
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
              <label className="flex items-center justify-between glass-card px-4 py-3">
                <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Accent color</span>
                <input type="color" value={rgbToHex(tokenVal('--accent'))} onChange={(e) => setToken('--accent', hexToRgb(e.target.value))} data-testid="accent-picker" />
              </label>
            </>
          )}

          {/* ADVANCED: token knobs */}
          {uiMode === 'advanced' && (
            <div className="space-y-2">
              {TOKENS.map((t) => (
                <div key={t.key} className="flex items-center justify-between glass-card px-4 py-2.5">
                  <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{t.label}</span>
                  {t.type === 'rgb' ? (
                    <input type="color" value={rgbToHex(tokenVal(t.key))} onChange={(e) => setToken(t.key, hexToRgb(e.target.value))} />
                  ) : t.type === 'color' ? (
                    <input type="color" value={tokenVal(t.key)} onChange={(e) => setToken(t.key, e.target.value)} />
                  ) : t.type === 'length' ? (
                    <input type="range" min={t.min} max={t.max} value={parseInt(tokenVal(t.key)) || 0} onChange={(e) => setToken(t.key, `${e.target.value}${t.unit}`)} />
                  ) : (
                    <input type="range" min={t.min} max={t.max} step={t.step} value={parseFloat(tokenVal(t.key)) || 0} onChange={(e) => setToken(t.key, e.target.value)} />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* TINKERER: raw token sheet + custom CSS */}
          {uiMode === 'tinkerer' && (
            <div className="space-y-3">
              <div className="glass-card p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-secondary)' }}>Live tokens</p>
                <pre className="text-[10px] overflow-x-auto" style={{ color: 'var(--text-secondary)' }}>
{Object.entries({ ...presets[presetId].tokens, ...overrides }).filter(([k]) => k !== '--mode').map(([k, v]) => `${k}: ${v};`).join('\n')}
                </pre>
              </div>
              <div className="glass-card p-3 space-y-2">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider" style={{ color: 'rgb(245 166 35)' }}>
                  <AlertTriangle size={12} /> Custom CSS — advanced, applied only to you
                </div>
                <textarea
                  value={cssDraft}
                  onChange={(e) => setCssDraft(e.target.value)}
                  data-testid="custom-css"
                  rows={6}
                  spellCheck={false}
                  placeholder={'.glass-card { border-color: rgb(var(--accent)); }'}
                  className="input-field w-full font-mono text-[11px]"
                  style={{ height: 'auto', resize: 'vertical' }}
                />
                {cssError && <p className="text-[11px] text-rose-400" data-testid="css-error">{cssError}</p>}
                <button onClick={applyCss} className="btn btn-primary h-9 px-4 text-xs" data-testid="apply-css">Apply CSS</button>
              </div>
            </div>
          )}

          {/* Share themes (token-only) */}
          <div className="glass-card p-3 space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Share this theme</p>
            <div className="flex gap-2">
              <button onClick={doExport} className="btn btn-secondary h-9 px-3 text-xs">Export code</button>
              {shareCode && (
                <button onClick={() => { navigator.clipboard?.writeText(shareCode); setCopied(true) }} className="btn btn-secondary h-9 px-3 text-xs">
                  {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />} {copied ? 'Copied' : 'Copy'}
                </button>
              )}
            </div>
            {shareCode && <textarea readOnly value={shareCode} rows={2} className="input-field w-full font-mono text-[10px]" style={{ height: 'auto' }} />}
            <div className="flex gap-2">
              <input value={importCode} onChange={(e) => setImportCode(e.target.value)} placeholder="Paste a theme code…" className="input-field flex-1 h-9 text-xs" />
              <button onClick={doImport} className="btn btn-secondary h-9 px-3 text-xs">Import</button>
            </div>
            {importMsg && <p className={`text-[11px] ${importMsg.ok ? 'text-emerald-400' : 'text-rose-400'}`}>{importMsg.ok ? 'Theme applied ✓' : importMsg.error}</p>}
          </div>
        </div>

        {/* Live preview */}
        <div className="md:sticky md:top-4 self-start w-full">
          <PreviewPane />
        </div>
      </div>
    </div>
  )
}
