import { createContext, useContext, useState, useCallback } from 'react'
import { AlertCircle, Check, Info, X } from 'lucide-react'

const ToastContext = createContext(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    return { notify: () => {}, dismiss: () => {} }
  }
  return ctx
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((t) => t.id !== id))
  }, [])

  const notify = useCallback((message, detail, tone = 'success') => {
    const id = Date.now() + Math.random()
    setToasts((current) => [...current.slice(-3), { id, message, detail, tone }])
    window.setTimeout(() => {
      setToasts((current) => current.filter((t) => t.id !== id))
    }, 3600)
  }, [])

  return (
    <ToastContext.Provider value={{ toasts, notify, dismiss }}>
      {children}
      <div
        className="pointer-events-none fixed bottom-20 right-4 z-[120] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2 md:bottom-6 md:right-6"
        aria-live="polite"
        aria-atomic="false"
      >
        {toasts.map((toast) => {
          const Icon = toast.tone === 'error' ? AlertCircle : toast.tone === 'info' ? Info : Check
          const bg =
            toast.tone === 'error'
              ? 'var(--coral-soft)'
              : toast.tone === 'info'
                ? 'var(--sky-soft)'
                : 'var(--mint-soft)'
          const color =
            toast.tone === 'error'
              ? 'var(--coral)'
              : toast.tone === 'info'
                ? 'var(--sky)'
                : 'var(--mint)'

          return (
            <div
              key={toast.id}
              className="pointer-events-auto flex animate-pop-in items-start gap-3 rounded-xl border p-3.5 shadow-2xl backdrop-blur-md"
              style={{ background: 'color-mix(in srgb, var(--surface) 95%, transparent)', borderColor: 'var(--border)' }}
            >
              <span
                className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full"
                style={{ background: bg, color }}
              >
                <Icon size={13} strokeWidth={2.4} />
              </span>
              <div className="min-w-0 flex-1 pt-0.5">
                <p className="text-[11.5px] font-bold leading-snug" style={{ color: 'var(--text-primary)' }}>
                  {toast.message}
                </p>
                {toast.detail && (
                  <p className="mt-0.5 text-[10px] leading-snug" style={{ color: 'var(--text-secondary)' }}>
                    {toast.detail}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                className="grid h-6 w-6 shrink-0 place-items-center rounded-md transition hover:bg-[var(--surface-raised)]"
                style={{ color: 'var(--faint)' }}
                aria-label="Dismiss notification"
              >
                <X size={12} />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}
