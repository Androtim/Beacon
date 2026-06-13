import { useState, useEffect } from 'react'
import { useTheme } from '../context/ThemeContext'
import { TOKENS } from '../lib/themes'
import { Sparkles, SlidersHorizontal, Code2, Sun, Moon, Check, Copy, AlertTriangle, Zap, Save, Undo2 } from 'lucide-react'

const MODES = [
  { id: 'easy', label: 'Easy', icon: Sparkles, hint: 'Presets & basics' },
  { id: 'advanced', label: 'Advanced', icon: SlidersHorizontal, hint: 'Fine-tune tokens' },
  { id: 'tinkerer', label: 'Tinkerer', icon: Code2, hint: 'Full control' },
]

const rgbToHex = (triplet) => {
  const [r, g, b] = (triplet || '0 0 0').split(/\s+/).map(Number)
  return '#' + [r, g, b].map((n) => Math.max(0, Math.min(255, n || 0)).toString(16).padStart(2, '0')).join('')
}
const hexToRgb = (hex) => {
  const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex)
  return m ? `${parseInt(m[1], 16)} ${parseInt(m[2], 16)} ${parseInt(m[3], 16)}` : '0 0 0'
}

// The preview renders with the DRAFT tokens scoped to itself only — editing
// never touches the rest of the app until Save.
function PreviewPane({ tokens }) {
  const style = { ...tokens, background: tokens['--bg-primary'], color: tokens['--text-primary'], borderRadius: tokens['--radius'] }
  return (
    <div data-testid="theme-preview" className="p-4 border space-y-3" style={{ ...style, borderColor: 'var(--border)' }}>
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-xl grid place-items-center" style={{ background: `linear-gradient(140deg, rgb(${tokens['--accent']}), rgb(${tokens['--accent-2']}))` }}>
          <Zap size={14} className="text-white" />
        </div>
        <span className="font-bold text-sm" style={{ color: tokens['--text-primary'] }}>Preview</span>
      </div>
      <p className="text-xs" style={{ color: tokens['--text-secondary'] }}>Only this box shows your edits until you save.</p>
      <div className="flex gap-2">
        <button className="px-4 h-9 text-xs font-extrabold" style={{ background: `rgb(${tokens['--accent']})`, color: '#1a0f0d', borderRadius: tokens['--radius'] }}>Primary</button>
        <button className="px-4 h-9 text-xs font-bold" style={{ background: tokens['--surface-raised'], color: tokens['--text-primary'], borderRadius: tokens['--radius'] }}>Secondary</button>
      </div>
      <div className="px-3 py-2 text-xs max-w-[70%]" style={{ background: `rgb(${tokens['--accent']})`, color: '#1a0f0d', borderRadius: tokens['--radius'] }}>Your message</div>
      <div className="px-3 py-2 text-xs" style={{ background: tokens['--surface-raised'], color: tokens['--text-primary'], borderRadius: tokens['--radius'] }}>A surface card</div>
    </div>
  )
}

export default function Appearance() {
  const {
    mode, getSlot, saveTheme, setMode, presets, resolveTokens, motion, customCss,
    setMotion, setCustomCss, validateCustomCss, exportTheme, importTheme,
  } = useTheme()

  const [uiMode, setUiMode] = useState('easy')
  // Draft = the theme being edited for the CURRENT mode. Reset when mode flips.
  const [draft, setDraft] = useState(() => getSlot(mode))
  useEffect(() => { setDraft(getSlot(mode)) }, [mode])

  const [cssDraft, setCssDraft] = useState(customCss)
  const [cssError, setCssError] = useState(null)
  const [shareCode, setShareCode] = useState('')
  const [importCode, setImportCode] = useState('')
  const [importMsg, setImportMsg] = useState(null)
  const [copied, setCopied] = useState(false)
  const [justSaved, setJustSaved] = useState(false)

  const tokenVal = (key) => draft.overrides[key] ?? presets[draft.presetId].tokens[key]
  const setDraftToken = (key, value) => setDraft((d) => ({ ...d, overrides: { ...d.overrides, [key]: value } }))
  const setDraftPreset = (id) => setDraft({ presetId: id, overrides: {} })

  const dirty = JSON.stringify(draft) !== JSON.stringify(getSlot(mode))
  const save = () => { saveTheme(mode, draft); setJustSaved(true); setTimeout(() => setJustSaved(false), 1500) }
  const discard = () => setDraft(getSlot(mode))

  const applyCss = () => {
    const result = validateCustomCss(cssDraft)
    if (!result.ok) { setCssError(result.error); return }
    setCssError(null)
    setCustomCss(cssDraft)
  }

  const doExport = () => { setShareCode(exportTheme()); setCopied(false) }
  const doImport = () => { const r = importTheme(importCode); setImportMsg(r); if (r.ok) setDraft(getSlot(mode)) }

  const previewTokens = resolveTokens(draft)

  return (
    <div className="space-y-5">
      {/* Live global mode — switches the whole app between your dark & light themes */}
      <div className="flex items-center justify-between glass-card px-4 py-3">
        <div>
          <p className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>Theme mode</p>
          <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>Switches the whole app · you're editing the <b>{mode}</b> theme below</p>
        </div>
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'rgb(0 0 0 / 0.2)' }}>
          <button onClick={() => setMode('dark')} data-testid="mode-dark" className="px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5"
            style={mode === 'dark' ? { background: 'rgb(var(--accent) / 0.2)', color: 'rgb(var(--accent))' } : { color: 'var(--text-secondary)' }}><Moon size={13} /> Dark</button>
          <button onClick={() => setMode('light')} data-testid="mode-light" className="px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5"
            style={mode === 'light' ? { background: 'rgb(var(--accent) / 0.2)', color: 'rgb(var(--accent))' } : { color: 'var(--text-secondary)' }}><Sun size={13} /> Light</button>
        </div>
      </div>

      {/* Editor mode switch */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'rgb(0 0 0 / 0.2)' }}>
        {MODES.map(({ id, label, icon: Icon, hint }) => (
          <button key={id} onClick={() => setUiMode(id)} data-testid={`appearance-mode-${id}`}
            className="flex-1 px-3 py-2 rounded-lg text-xs font-bold flex flex-col items-center gap-0.5"
            style={uiMode === id ? { background: 'rgb(var(--accent) / 0.2)', color: 'rgb(var(--accent))' } : { color: 'var(--text-secondary)' }}>
            <span className="flex items-center gap-1.5"><Icon size={13} /> {label}</span>
            <span className="text-[9px] font-medium opacity-70">{hint}</span>
          </button>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        <div className="space-y-4">
          <label className="flex items-center justify-between glass-card px-4 py-3">
            <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Animations & glow</span>
            <input type="checkbox" checked={motion} onChange={(e) => setMotion(e.target.checked)} data-testid="motion-toggle" />
          </label>

          {uiMode === 'easy' && (
            <>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-secondary)' }}>Preset</p>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(presets).map(([id, p]) => (
                    <button key={id} onClick={() => setDraftPreset(id)} data-testid={`preset-${id}`}
                      className="px-3 py-2.5 rounded-xl text-xs font-bold text-left border transition-all"
                      style={{ borderColor: draft.presetId === id ? 'rgb(var(--accent))' : 'var(--border)', background: 'var(--surface-raised)', color: 'var(--text-primary)' }}>
                      <span className="inline-block w-3 h-3 rounded-full mr-2 align-middle" style={{ background: `rgb(${p.tokens['--accent']})` }} />
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
              <label className="flex items-center justify-between glass-card px-4 py-3">
                <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Accent color</span>
                <input type="color" value={rgbToHex(tokenVal('--accent'))} onChange={(e) => setDraftToken('--accent', hexToRgb(e.target.value))} data-testid="accent-picker" />
              </label>
            </>
          )}

          {uiMode === 'advanced' && (
            <div className="space-y-2">
              {TOKENS.map((t) => (
                <div key={t.key} className="flex items-center justify-between glass-card px-4 py-2.5">
                  <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{t.label}</span>
                  {t.type === 'rgb' ? (
                    <input type="color" value={rgbToHex(tokenVal(t.key))} onChange={(e) => setDraftToken(t.key, hexToRgb(e.target.value))} />
                  ) : t.type === 'color' ? (
                    <input type="color" value={tokenVal(t.key)} onChange={(e) => setDraftToken(t.key, e.target.value)} />
                  ) : t.type === 'length' ? (
                    <input type="range" min={t.min} max={t.max} value={parseInt(tokenVal(t.key)) || 0} onChange={(e) => setDraftToken(t.key, `${e.target.value}${t.unit}`)} />
                  ) : (
                    <input type="range" min={t.min} max={t.max} step={t.step} value={parseFloat(tokenVal(t.key)) || 0} onChange={(e) => setDraftToken(t.key, e.target.value)} />
                  )}
                </div>
              ))}
            </div>
          )}

          {uiMode === 'tinkerer' && (
            <div className="space-y-3">
              <div className="glass-card p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-secondary)' }}>Live tokens (this theme)</p>
                <pre className="text-[10px] overflow-x-auto" style={{ color: 'var(--text-secondary)' }}>
{Object.entries(previewTokens).map(([k, v]) => `${k}: ${v};`).join('\n')}
                </pre>
              </div>
              <div className="glass-card p-3 space-y-2">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider" style={{ color: 'rgb(245 166 35)' }}>
                  <AlertTriangle size={12} /> Custom CSS — applied globally to you, not part of the saved theme
                </div>
                <textarea value={cssDraft} onChange={(e) => setCssDraft(e.target.value)} data-testid="custom-css" rows={6} spellCheck={false}
                  placeholder={'.glass-card { border-color: rgb(var(--accent)); }'} className="input-field w-full font-mono text-[11px]" style={{ height: 'auto', resize: 'vertical' }} />
                {cssError && <p className="text-[11px] text-rose-400" data-testid="css-error">{cssError}</p>}
                <button onClick={applyCss} className="btn btn-primary h-9 px-4 text-xs" data-testid="apply-css">Apply CSS</button>
              </div>
            </div>
          )}

          {/* Save / discard the edited theme */}
          <div className="flex gap-2">
            <button onClick={save} disabled={!dirty} className="btn btn-primary flex-1 h-11 text-xs" data-testid="save-theme">
              {justSaved ? <><Check size={14} /> Saved</> : <><Save size={14} /> Save {mode} theme</>}
            </button>
            {dirty && <button onClick={discard} className="btn btn-secondary h-11 px-4 text-xs" data-testid="discard-theme"><Undo2 size={14} /> Discard</button>}
          </div>

          {/* Share (token values only) */}
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
            {importMsg && <p className={`text-[11px] ${importMsg.ok ? 'text-emerald-400' : 'text-rose-400'}`}>{importMsg.ok ? 'Loaded into the editor — Save to keep it' : importMsg.error}</p>}
          </div>
        </div>

        <div className="md:sticky md:top-4 self-start w-full">
          <PreviewPane tokens={previewTokens} />
        </div>
      </div>
    </div>
  )
}
