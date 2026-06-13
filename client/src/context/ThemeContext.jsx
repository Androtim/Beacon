import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import { PRESETS, DEFAULT_PRESET } from '../lib/themes'

const ThemeContext = createContext()
const STORAGE_KEY = 'beacon-theme-v2'
const CUSTOM_CSS_STYLE_ID = 'beacon-custom-css'

// A Beacon theme is two slots — one for dark, one for light — each a preset id
// plus per-token overrides. The active `mode` chooses which slot is live.
// Defaults: dark = Crystal, light = Daylight (so light mode is actually light).
const DEFAULTS = {
  mode: 'dark',
  dark: { presetId: 'crystal', overrides: {} },
  light: { presetId: 'daylight', overrides: {} },
  motion: true,
  customCss: '',
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used within a ThemeProvider')
  return context
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const p = JSON.parse(raw)
      return {
        mode: p.mode === 'light' ? 'light' : 'dark',
        dark: validSlot(p.dark, 'crystal'),
        light: validSlot(p.light, 'daylight'),
        motion: p.motion !== false,
        customCss: typeof p.customCss === 'string' ? p.customCss : '',
      }
    }
  } catch {
    // ignore — fall through to defaults
  }
  return structuredClone(DEFAULTS)
}

function validSlot(slot, fallbackPreset) {
  const presetId = slot && PRESETS[slot.presetId] ? slot.presetId : fallbackPreset
  const overrides = slot && slot.overrides && typeof slot.overrides === 'object' ? slot.overrides : {}
  return { presetId, overrides }
}

export function resolveTokens(slot) {
  const preset = PRESETS[slot.presetId] ?? PRESETS[DEFAULT_PRESET]
  return { ...preset.tokens, ...slot.overrides }
}

function applyToDom(state) {
  const slot = state[state.mode]
  document.documentElement.classList.toggle('dark', state.mode === 'dark')
  document.documentElement.style.colorScheme = state.mode
  document.documentElement.dataset.motion = state.motion ? 'on' : 'off'

  const root = document.documentElement
  for (const [key, value] of Object.entries(resolveTokens(slot))) {
    root.style.setProperty(key, value)
  }

  let styleEl = document.getElementById(CUSTOM_CSS_STYLE_ID)
  if (state.customCss) {
    if (!styleEl) {
      styleEl = document.createElement('style')
      styleEl.id = CUSTOM_CSS_STYLE_ID
      document.head.appendChild(styleEl)
    }
    styleEl.textContent = state.customCss
  } else if (styleEl) {
    styleEl.remove()
  }
}

/** Light validation for Tinkerer custom CSS — returns { ok, error }. */
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

  useEffect(() => {
    applyToDom(state)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // storage disabled — theme still applies in-memory
    }
  }, [state])

  const { mode, motion, customCss } = state

  // Switch the live mode (dark/light) — applies the matching saved slot.
  const setMode = useCallback((next) => {
    setState((s) => ({ ...s, mode: next === 'light' ? 'light' : 'dark' }))
  }, [])
  const toggleTheme = useCallback(() => {
    setState((s) => ({ ...s, mode: s.mode === 'dark' ? 'light' : 'dark' }))
  }, [])

  // Commit an edited theme to a slot ('dark' | 'light').
  const saveTheme = useCallback((slotName, slot) => {
    setState((s) => ({ ...s, [slotName]: validSlot(slot, s[slotName].presetId) }))
  }, [])

  const setMotion = useCallback((on) => setState((s) => ({ ...s, motion: !!on })), [])
  const setCustomCss = useCallback((css) => setState((s) => ({ ...s, customCss: css })), [])
  const resetToDefault = useCallback(() => setState(structuredClone(DEFAULTS)), [])

  // Shareable theme = the active slot's tokens (no raw CSS).
  const exportTheme = useCallback(() => {
    const payload = { mode, slot: state[mode] }
    return btoa(unescape(encodeURIComponent(JSON.stringify(payload))))
  }, [mode, state])
  const importTheme = useCallback((code) => {
    try {
      const p = JSON.parse(decodeURIComponent(escape(atob(code.trim()))))
      const slot = validSlot(p.slot, DEFAULT_PRESET)
      setState((s) => ({ ...s, [s.mode]: slot }))
      return { ok: true }
    } catch {
      return { ok: false, error: 'That theme code could not be read' }
    }
  }, [])

  const isCustomized = useMemo(() => {
    const dirty = (slot, def) => slot.presetId !== def.presetId || Object.keys(slot.overrides).length > 0
    return dirty(state.dark, DEFAULTS.dark) || dirty(state.light, DEFAULTS.light) || !!customCss || !motion
  }, [state, customCss, motion])

  const value = useMemo(() => ({
    mode,
    theme: mode, // back-compat alias
    motion,
    customCss,
    activeSlot: state[mode],
    getSlot: (m) => state[m],
    presets: PRESETS,
    resolveTokens,
    isCustomized,
    setMode, toggleTheme, saveTheme, setMotion, setCustomCss, resetToDefault,
    exportTheme, importTheme, validateCustomCss,
  }), [mode, motion, customCss, state, isCustomized, setMode, toggleTheme, saveTheme, setMotion, setCustomCss, resetToDefault, exportTheme, importTheme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
