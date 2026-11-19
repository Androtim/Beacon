export function BeaconMark({ className = 'h-7 w-7', size }) {
  const dim =
    size === 'sm'
      ? 'h-7 w-7'
      : size === 'lg'
      ? 'h-10 w-10'
      : typeof size === 'number'
      ? ''
      : className
  const style = typeof size === 'number' ? { width: size, height: size } : undefined

  return (
    <span
      style={style}
      className={`beacon-mark relative grid shrink-0 place-items-center overflow-hidden rounded-lg ${dim}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" className="h-[58%] w-[58%]" fill="none">
        <circle cx="12" cy="12" r="3" fill="currentColor" />
        <path
          d="M7.8 16.2a6 6 0 0 1 0-8.4m8.4 0a6 6 0 0 1 0 8.4"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M4.9 19.1a10 10 0 0 1 0-14.2m14.2 0a10 10 0 0 1 0 14.2"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeOpacity="0.45"
        />
      </svg>
    </span>
  )
}

export function Wordmark({ compact = false, className = '' }) {
  return (
    <span
      className={`font-semibold tracking-[-0.03em] text-ink ${
        compact ? 'text-[15px]' : 'text-[16px]'
      } ${className}`}
    >
      Beacon
    </span>
  )
}
