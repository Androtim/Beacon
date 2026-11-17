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
    label: 'Beacon Amber',
    mode: 'dark',
    tokens: {
      '--accent': '234 182 109', // amber lamp #eab66d — the guiding light
      '--accent-2': '147 220 184', // mint signal
      '--bg-primary': '#0A0B0D',
      '--bg-secondary': '#0E0F12',
      '--surface': '#131417',
      '--surface-raised': '#18191D',
      '--text-primary': '#F4F1EA',
      '--text-secondary': '#908D86',
      '--radius': '14px',
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
      '--radius': '12px',
      '--glow-strength': '0.2',
    },
  },
  ember: {
    label: 'Ember Coral',
    mode: 'dark',
    tokens: {
      '--accent': '242 126 114', // warm coral #f27e72
      '--accent-2': '215 158 74', // lantern amber
      '--bg-primary': '#120E0D',
      '--bg-secondary': '#1A1311',
      '--surface': '#181210',
      '--surface-raised': '#211916',
      '--text-primary': '#F5EEE9',
      '--text-secondary': '#B3A296',
      '--radius': '14px',
      '--glow-strength': '0.35',
    },
  },
  daylight: {
    label: 'Warm Daylight',
    mode: 'light',
    tokens: {
      '--accent': '169 97 34', // burnt ochre #a96122 on warm paper
      '--accent-2': '33 115 78',
      '--bg-primary': '#F4F0E8',
      '--bg-secondary': '#EDE8DE',
      '--surface': '#FFFDF9',
      '--surface-raised': '#F8F4EC',
      '--text-primary': '#1C1914',
      '--text-secondary': '#746F65',
      '--radius': '14px',
      '--glow-strength': '0.12',
    },
  },
}

export const DEFAULT_PRESET = 'crystal'

