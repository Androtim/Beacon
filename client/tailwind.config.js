/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Manrope"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['"Fraunces"', 'Georgia', '"Times New Roman"', 'serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        app: 'var(--bg-primary)',
        soft: 'var(--bg-secondary)',
        panel: 'var(--surface)',
        'panel-2': 'var(--surface-raised)',
        'panel-3': 'var(--panel-3)',
        line: 'var(--border)',
        'line-strong': 'var(--line-strong)',
        ink: 'var(--text-primary)',
        'ink-soft': 'var(--ink-soft)',
        muted: 'var(--text-secondary)',
        faint: 'var(--faint)',
        accent: 'rgb(var(--accent) / <alpha-value>)',
        'accent-strong': 'var(--accent-strong)',
        'accent-ink': 'var(--accent-ink)',
        'accent-soft': 'var(--accent-soft)',
        mint: 'var(--mint)',
        'mint-soft': 'var(--mint-soft)',
        lilac: 'var(--lilac)',
        'lilac-soft': 'var(--lilac-soft)',
        coral: 'var(--coral)',
        'coral-soft': 'var(--coral-soft)',
        sky: 'var(--sky)',
        'sky-soft': 'var(--sky-soft)',
      },
    },
  },
  plugins: [],
}