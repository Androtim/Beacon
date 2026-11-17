export function BeaconMark({ className = 'h-9 w-9', size }) {
  const dim = size === 'sm' ? 'h-8 w-8' : size === 'lg' ? 'h-12 w-12' : className
  return (
    <span
      className={`beacon-mark relative grid shrink-0 place-items-center overflow-hidden rounded-[11px] ${dim}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" className="h-[66%] w-[66%]" fill="none">
        <path
          d="M9.7 9.7h4.6l.9 8.6H8.8l.9-8.6Z"
          fill="currentColor"
          fillOpacity=".22"
          stroke="currentColor"
          strokeWidth="1.35"
          strokeLinejoin="round"
        />
        <path d="M9 9.7 12 3l3 6.7H9Z" fill="currentColor" />
        <path d="M9.8 7.6h4.4" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
        <circle cx="12" cy="6.6" r=".9" fill="var(--accent-ink)" />
        <circle cx="12" cy="13.4" r="1.15" fill="currentColor" />
        <path
          d="M7 18.3h10M6.7 20.7c1.6-1 3.2-1 5.3-1s3.7 0 5.3 1"
          stroke="currentColor"
          strokeWidth="1.35"
          strokeLinecap="round"
        />
      </svg>
    </span>
  )
}

export function Wordmark({ compact = false }) {
  return (
    <span className="flex items-baseline gap-[1px]">
      <span
        className={`font-serif tracking-[-0.02em] ${compact ? 'text-[19px]' : 'text-[22px]'}`}
        style={{ color: 'var(--text-primary)' }}
      >
        Beacon
      </span>
      <span className="text-[22px] leading-none text-accent">.</span>
    </span>
  )
}
