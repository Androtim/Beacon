import { useEffect, useRef } from 'react'
import { useTheme } from '../context/ThemeContext'

/**
 * A "reset theme" escape hatch rendered inside a Shadow DOM. Because Tinkerer
 * custom CSS is injected into the main document, it can restyle or hide any
 * normal element — but it cannot reach into a shadow root. So this button is
 * always visible and clickable no matter how badly a custom theme breaks the
 * page. It only appears once the theme has been customized.
 */
export default function ThemeReset() {
  const { isCustomized, resetToDefault } = useTheme()
  const hostRef = useRef(null)
  const btnRef = useRef(null)

  useEffect(() => {
    const host = document.createElement('div')
    host.style.cssText = 'position:fixed;right:14px;bottom:14px;z-index:2147483647'
    const root = host.attachShadow({ mode: 'open' })
    const btn = document.createElement('button')
    btn.textContent = '↺ Reset theme'
    btn.style.cssText = [
      'font:600 12px system-ui,sans-serif',
      'padding:8px 14px',
      'border-radius:10px',
      'border:1px solid rgba(255,255,255,0.25)',
      'background:#1a1330',
      'color:#fff',
      'box-shadow:0 4px 16px rgba(0,0,0,0.4)',
      'cursor:pointer',
    ].join(';')
    root.appendChild(btn)
    document.body.appendChild(host)
    hostRef.current = host
    btnRef.current = btn
    return () => host.remove()
  }, [])

  // Keep the click handler current and toggle visibility.
  useEffect(() => {
    const btn = btnRef.current
    const host = hostRef.current
    if (!btn || !host) return
    host.style.display = isCustomized ? 'block' : 'none'
    btn.onclick = () => resetToDefault()
  }, [isCustomized, resetToDefault])

  return null
}
