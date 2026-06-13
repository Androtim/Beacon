import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import { PRESETS, DEFAULT_PRESET } from '../lib/themes'

const ThemeContext = createContext()
const STORAGE_KEY = 'beacon-theme'
const CUSTOM_CSS_STYLE_ID = 'beacon-custom-css'

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used within a ThemeProvider')
  return context
}

function loadState() {
  const base = { presetId: DEFAULT_PRESET, overrides: {}, motion: true, customCss: '' }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const p = JSON.parse(raw)
      return {
        presetId: PRESETS[p.presetId] ? p.presetId : DEFAULT_PRESET,
        overrides: p.overrides && typeof p.overrides === 'object' ? p.overrides : {},
        motion: p.motion !== false,
        customCss: typeof p.customCss === 'string' ? p.customCss : '',
      }
    }
  } catch {
    // ignore
  }
  return base
}

function resolveTokens(presetId, overrides) {
  const preset = PRESETS[presetId] ?? PRESETS[DEFAULT_PRESET]
  return { ...preset.tokens, ...overrides }
}

function applyToDom({ presetId, overrides, motion, customCss }) {
  const preset = PRESETS[presetId] ?? PRESETS[DEFAULT_PRESET]
  const mode = overrides['--mode'] ?? preset.mode
  document.documentElement.classList.toggle('dark', mode === 'dark')
  document.documentElement.dataset.motion = motion ? 'on' : 'off'

  const root = document.documentElement
  for (const [key, value] of Object.entries(resolveTokens(presetId, overrides))) {
    if (key === '--mode') continue
    root.style.setProperty(key, value)
  }

  // Tinkerer custom CSS goes in a managed <style>; cleared when empty.
  let styleEl = document.getElementById(CUSTOM_CSS_STYLE_ID)
  if (customCss) {
    if (!styleEl) {
      styleEl = document.createElement('style')
      styleEl.id = CUSTOM_CSS_STYLE_ID
      document.head.appendChild(styleEl)
    }
    styleEl.textContent = customCss
  } else if (styleEl) {
    styleEl.remove()
  }
}

/**
 * Light validation for Tinkerer custom CSS — true browser CSS parsing has no
 * error API, so we balance-check braces and block the few genuinely dangerous
 * constructs. Returns { ok, error }.
 */
export function validateCustomCss(css) {
  if (typeof css !== 'string') return { ok: false, error: 'Not a string' }
  if (/@import|javascript:|expression\(|<\/?style/i.test(css)) {
    return { ok: false, error: '@import, javascript:, expression(), and <style> tags are not allowed' }
  }
  let depth = 0
  for (const ch of css) {
    if (ch === '{') depth++
    else if (ch === '}') { depth--; if (depth < 0) return { ok: false, error: 'Unbalanced } brace' } }
  }
  if (depth !== 0) return { ok: false, error: 'Unbalanced { brace' }
  return { ok: true, error: null }
}

export function ThemeProvider({ children }) {
  const [state, setState] = useState(loadState)
  const { presetId, overrides, motion, customCss } = state

  useEffect(() => {
    applyToDom(state)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // storage disabled — theme still applies in-memory
    }
  }, [state])

  const preset = PRESETS[presetId] ?? PRESETS[DEFAULT_PRESET]
  const mode = overrides['--mode'] ?? preset.mode

  const setPreset = useCallback((id) => {
    if (PRESETS[id]) setState((s) => ({ ...s, presetId: id, overrides: {} }))
  }, [])
  const setToken = useCallback((key, value) => {
    setState((s) => ({ ...s, overrides: { ...s.overrides, [key]: value } }))
  }, [])
  const setMode = useCallback((next) => {
    setState((s) => ({ ...s, overrides: { ...s.overrides, '--mode': next } }))
  }, [])
  const setMotion = useCallback((on) => setState((s) => ({ ...s, motion: !!on })), [])
  const setCustomCss = useCallback((css) => setState((s) => ({ ...s, customCss: css })), [])
  const resetToDefault = useCallback(() => {
    setState({ presetId: DEFAULT_PRESET, overrides: {}, motion: true, customCss: '' })
  }, [])
  const toggleTheme = useCallback(() => setMode(mode === 'dark' ? 'light' : 'dark'), [mode, setMode])

  // Shareable theme = tokens only (no raw CSS — see the privacy decision).
  const exportTheme = useCallback(() => {
    const payload = { presetId, overrides, motion }
    return btoa(unescape(encodeURIComponent(JSON.stringify(payload))))
  }, [presetId, overrides, motion])
  const importTheme = useCallback((code) => {
    try {
      const p = JSON.parse(decodeURIComponent(escape(atob(code.trim()))))
      if (!PRESETS[p.presetId]) return { ok: false, error: 'Unknown preset in theme code' }
      setState((s) => ({
        ...s,
        presetId: p.presetId,
        overrides: p.overrides && typeof p.overrides === 'object' ? p.overrides : {},
        motion: p.motion !== false,
      }))
      return { ok: true }
    } catch {
      return { ok: false, error: 'That theme code could not be read' }
    }
  }, [])

  const isCustomized = useMemo(
    () => presetId !== DEFAULT_PRESET || Object.keys(overrides).length > 0 || !!customCss || !motion,
    [presetId, overrides, customCss, motion],
  )

  const value = useMemo(() => ({
    presetId, preset, overrides, mode, motion, customCss,
    theme: mode, // back-compat alias
    tokens: resolveTokens(presetId, overrides),
    presets: PRESETS,
    isCustomized,
    setPreset, setToken, setMode, setMotion, setCustomCss, resetToDefault, toggleTheme,
    exportTheme, importTheme, validateCustomCss,
  }), [presetId, preset, overrides, mode, motion, customCss, isCustomized,
       setPreset, setToken, setMode, setMotion, setCustomCss, resetToDefault, toggleTheme, exportTheme, importTheme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
