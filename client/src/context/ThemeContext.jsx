import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import { PRESETS, DEFAULT_PRESET } from '../lib/themes'

const ThemeContext = createContext()
const STORAGE_KEY = 'beacon-theme'

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used within a ThemeProvider')
  return context
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed && PRESETS[parsed.presetId]) {
        return { presetId: parsed.presetId, overrides: parsed.overrides ?? {} }
      }
    }
  } catch {
    // ignore
  }
  return { presetId: DEFAULT_PRESET, overrides: {} }
}

// Resolved tokens = preset tokens with user overrides layered on top.
function resolveTokens(presetId, overrides) {
  const preset = PRESETS[presetId] ?? PRESETS[DEFAULT_PRESET]
  return { ...preset.tokens, ...overrides }
}

function applyToDom(presetId, overrides) {
  const preset = PRESETS[presetId] ?? PRESETS[DEFAULT_PRESET]
  const mode = overrides['--mode'] ?? preset.mode
  document.documentElement.classList.toggle('dark', mode === 'dark')
  const tokens = resolveTokens(presetId, overrides)
  const root = document.documentElement
  for (const [key, value] of Object.entries(tokens)) {
    if (key === '--mode') continue
    root.style.setProperty(key, value)
  }
}

export function ThemeProvider({ children }) {
  const [{ presetId, overrides }, setState] = useState(loadState)

  // Apply on mount and whenever the theme changes.
  useEffect(() => {
    applyToDom(presetId, overrides)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ presetId, overrides }))
    } catch {
      // storage full / disabled — theme still applies in-memory
    }
  }, [presetId, overrides])

  const preset = PRESETS[presetId] ?? PRESETS[DEFAULT_PRESET]
  const mode = overrides['--mode'] ?? preset.mode

  const setPreset = useCallback((id) => {
    if (!PRESETS[id]) return
    // Switching presets clears per-token overrides for a clean slate.
    setState({ presetId: id, overrides: {} })
  }, [])

  const setToken = useCallback((key, value) => {
    setState((s) => ({ ...s, overrides: { ...s.overrides, [key]: value } }))
  }, [])

  const setMode = useCallback((nextMode) => {
    setState((s) => ({ ...s, overrides: { ...s.overrides, '--mode': nextMode } }))
  }, [])

  const resetToDefault = useCallback(() => {
    setState({ presetId: DEFAULT_PRESET, overrides: {} })
  }, [])

  // Back-compat for components written against the old API.
  const toggleTheme = useCallback(() => {
    setMode(mode === 'dark' ? 'light' : 'dark')
  }, [mode, setMode])

  const value = useMemo(() => ({
    presetId,
    preset,
    overrides,
    mode,
    theme: mode, // back-compat alias
    tokens: resolveTokens(presetId, overrides),
    presets: PRESETS,
    setPreset,
    setToken,
    setMode,
    resetToDefault,
    toggleTheme,
  }), [presetId, preset, overrides, mode, setPreset, setToken, setMode, resetToDefault, toggleTheme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
