// Theme presets for the Crystal Beacon design system.
//
// The entire UI reads from CSS custom properties (design tokens). A preset is
// a mode (dark/light) plus a set of token overrides layered on the base
// palette defined in index.css. The customization engine (ThemeContext) can
// layer further user overrides on top, so Easy/Advanced/Tinkerer modes all
// just write token values — nothing hardcodes a color.

export const TOKENS = [
  // identity
  { key: '--accent', label: 'Accent', type: 'rgb' },
  { key: '--accent-2', label: 'Secondary', type: 'rgb' },
  // surfaces
  { key: '--bg-primary', label: 'Background', type: 'color' },
  { key: '--bg-secondary', label: 'Background glow', type: 'color' },
  { key: '--surface', label: 'Surface', type: 'color' },
  { key: '--surface-raised', label: 'Raised surface', type: 'color' },
  // text
  { key: '--text-primary', label: 'Text', type: 'color' },
  { key: '--text-secondary', label: 'Muted text', type: 'color' },
  // shape & feel
  { key: '--radius', label: 'Corner radius', type: 'length', min: 0, max: 28, unit: 'px' },
  { key: '--glow-strength', label: 'Glow', type: 'number', min: 0, max: 1, step: 0.05 },
]

export const PRESETS = {
  crystal: {
    label: 'Crystal',
    mode: 'dark',
    tokens: {
      '--accent': '242 126 114', // coral #f27e72 — the guiding light
      '--accent-2': '122 148 187', // muted sapphire
      '--bg-primary': '#10131A',
      '--bg-secondary': '#171C26',
      '--surface': '#161A23',
      '--surface-raised': '#1D222E',
      '--text-primary': '#EDEFF3',
      '--text-secondary': '#929BAD',
      '--radius': '10px',
      '--glow-strength': '0.25',
    },
  },
  midnight: {
    label: 'Midnight',
    mode: 'dark',
    tokens: {
      '--accent': '124 156 205', // sapphire-forward
      '--accent-2': '92 112 148',
      '--bg-primary': '#0C0F16',
      '--bg-secondary': '#121724',
      '--surface': '#111622',
      '--surface-raised': '#18202F',
      '--text-primary': '#E9EDF5',
      '--text-secondary': '#8791A6',
      '--radius': '8px',
      '--glow-strength': '0.2',
    },
  },
  ember: {
    label: 'Ember',
    mode: 'dark',
    tokens: {
      '--accent': '247 126 114', // warmer coral
      '--accent-2': '215 158 74', // lantern amber
      '--bg-primary': '#15100E',
      '--bg-secondary': '#201714',
      '--surface': '#1C1512',
      '--surface-raised': '#251C18',
      '--text-primary': '#F5EEE9',
      '--text-secondary': '#B3A296',
      '--radius': '12px',
      '--glow-strength': '0.4',
    },
  },
  daylight: {
    label: 'Daylight',
    mode: 'light',
    tokens: {
      '--accent': '224 82 68', // coral that reads on light
      '--accent-2': '86 110 146',
      '--bg-primary': '#F7F7F5',
      '--bg-secondary': '#EDEDEA',
      '--surface': '#FFFFFF',
      '--surface-raised': '#F1F1EE',
      '--text-primary': '#22252B',
      '--text-secondary': '#6A7180',
      '--radius': '10px',
      '--glow-strength': '0.1',
    },
  },
}

export const DEFAULT_PRESET = 'crystal'
