import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

const TONE_KEYS = ['amber', 'mint', 'lilac', 'sky', 'coral']

const toneStyles = {
  amber: { background: 'var(--accent-soft)', color: 'rgb(var(--accent))' },
  mint: { background: 'var(--mint-soft)', color: 'var(--mint)' },
  lilac: { background: 'var(--lilac-soft)', color: 'var(--lilac)' },
  sky: { background: 'var(--sky-soft)', color: 'var(--sky)' },
  coral: { background: 'var(--coral-soft)', color: 'var(--coral)' },
}

const sizes = {
  xs: 'h-5 w-5 text-[8px]',
  sm: 'h-6 w-6 text-[9px]',
  md: 'h-8 w-8 text-[10.5px]',
  lg: 'h-10 w-10 text-[12px]',
  xl: 'h-14 w-14 text-[16px]',
  '2xl': 'h-20 w-20 text-[22px]',
}

export function getToneForString(str = '') {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0
  }
  return TONE_KEYS[Math.abs(hash) % TONE_KEYS.length]
}

export function getInitials(name = '?') {
  const clean = (name || '?').trim()
  const parts = clean.split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return clean.slice(0, 2).toUpperCase()
}

export function Avatar({
  person,
  name,
  tone,
  status,
  size = 'md',
  showStatus = false,
  className = '',
  style,
}) {
  const displayName = person?.name || person?.username || name || 'Guest'
  const initials = person?.initials || getInitials(displayName)
  const resolvedTone = person?.tone || tone || getToneForString(person?.id || displayName)
  const resolvedStatus = person?.status || status || (person?.isOnline ? 'online' : 'online')
  const tStyle = toneStyles[resolvedTone] || toneStyles.amber

  return (
    <span
      className={`relative inline-grid shrink-0 place-items-center rounded-full font-bold tracking-[0.02em] select-none ${sizes[size] || sizes.md} ${className}`}
      style={{ background: tStyle.background, color: tStyle.color, ...style }}
      title={displayName}
      aria-label={displayName}
    >
      {initials}
      {showStatus && (
        <span
          className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2"
          style={{
            borderColor: 'var(--surface)',
            background:
              resolvedStatus === 'online'
                ? 'var(--mint)'
                : resolvedStatus === 'away'
                  ? 'rgb(var(--accent))'
                  : 'var(--faint)',
          }}
        />
      )}
    </span>
  )
}

export function AvatarStack({ people = [], max = 4, size = 'sm', className = '' }) {
  const shown = people.slice(0, max)
  const rest = people.length - shown.length
  return (
    <div className={`flex items-center -space-x-2 ${className}`}>
      {shown.map((p, idx) => (
        <Avatar
          key={p.id || p.username || idx}
          person={p}
          size={size}
          className="ring-2 ring-[var(--surface)]"
        />
      ))}
      {rest > 0 && (
        <span
          className={`relative inline-grid place-items-center rounded-full font-bold ring-2 ring-[var(--surface)] ${sizes[size] || sizes.sm}`}
          style={{ background: 'var(--panel-3)', color: 'var(--text-secondary)' }}
        >
          +{rest}
        </span>
      )}
    </div>
  )
}

export function LiveDot({ label = 'Live' }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.13em]"
      style={{ color: 'var(--mint)' }}
    >
      <span className="relative flex h-1.5 w-1.5">
        <span
          className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
          style={{ background: 'var(--mint)' }}
        />
        <span
          className="relative inline-flex h-1.5 w-1.5 rounded-full"
          style={{ background: 'var(--mint)' }}
        />
      </span>
      {label}
    </span>
  )
}

export function Badge({ children, tone = 'neutral', className = '' }) {
  const styles = {
    neutral: { background: 'var(--surface-raised)', color: 'var(--text-secondary)', borderColor: 'var(--border)' },
    mint: { background: 'var(--mint-soft)', color: 'var(--mint)', borderColor: 'transparent' },
    accent: { background: 'var(--accent-soft)', color: 'rgb(var(--accent))', borderColor: 'transparent' },
    lilac: { background: 'var(--lilac-soft)', color: 'var(--lilac)', borderColor: 'transparent' },
    sky: { background: 'var(--sky-soft)', color: 'var(--sky)', borderColor: 'transparent' },
    coral: { background: 'var(--coral-soft)', color: 'var(--coral)', borderColor: 'transparent' },
  }
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9.5px] font-bold uppercase tracking-[0.12em] leading-none ${className}`}
      style={styles[tone] || styles.neutral}
    >
      {children}
    </span>
  )
}

export function ProgressBar({ value = 0, className = '', tone = 'accent' }) {
  return (
    <div
      className={`h-1.5 w-full overflow-hidden rounded-full ${className}`}
      style={{ background: 'var(--panel-3)' }}
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full transition-[width] duration-300"
        style={{
          width: `${Math.min(100, Math.max(0, value))}%`,
          background: tone === 'mint' ? 'var(--mint)' : 'rgb(var(--accent))',
        }}
      />
    </div>
  )
}

export function Toggle({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="relative h-6 w-10 shrink-0 rounded-full border transition-colors"
      style={{
        background: checked ? 'rgb(var(--accent))' : 'var(--panel-3)',
        borderColor: checked ? 'rgb(var(--accent))' : 'var(--border)',
      }}
    >
      <span
        className="absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-white shadow-sm transition-[left] duration-200"
        style={{ left: checked ? 20 : 3 }}
      />
    </button>
  )
}

export function Modal({
  open,
  onClose,
  children,
  className = 'max-w-lg',
  position = 'center',
  hideClose = false,
  label,
}) {
  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div
      className={`fixed inset-0 z-[90] flex justify-center overflow-y-auto p-4 sm:p-6 ${
        position === 'center' ? 'items-center' : 'items-start pt-[10vh] sm:pt-[14vh]'
      }`}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.()
      }}
      style={{
        background: 'rgba(5, 5, 6, 0.65)',
        backdropFilter: 'blur(10px)',
      }}
    >
      <div
        className={`relative my-auto w-full animate-pop-in rounded-[22px] border shadow-2xl ${className}`}
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {!hideClose && (
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 z-10 grid h-8 w-8 place-items-center rounded-lg transition hover:bg-[var(--surface-raised)]"
            style={{ color: 'var(--text-secondary)' }}
            aria-label="Close dialog"
          >
            <X size={16} />
          </button>
        )}
        {children}
      </div>
    </div>,
    document.body
  )
}
