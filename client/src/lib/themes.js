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
      '--accent-2': '139 110 209', // lifted crystal violet
      '--bg-primary': '#0E0A1A',
      '--bg-secondary': '#1A1233',
      '--surface': '#1A1330',
      '--surface-raised': '#241A3D',
      '--text-primary': '#F3EEFF',
      '--text-secondary': '#A99FC9',
      '--radius': '16px',
      '--glow-strength': '0.5',
    },
  },
  midnight: {
    label: 'Midnight',
    mode: 'dark',
    tokens: {
      '--accent': '139 110 209', // violet-forward
      '--accent-2': '99 102 241',
      '--bg-primary': '#0A0A14',
      '--bg-secondary': '#14122B',
      '--surface': '#15152A',
      '--surface-raised': '#1F1F3D',
      '--text-primary': '#EDEFFF',
      '--text-secondary': '#8E92B8',
      '--radius': '12px',
      '--glow-strength': '0.4',
    },
  },
  ember: {
    label: 'Ember',
    mode: 'dark',
    tokens: {
      '--accent': '247 126 114', // warmer coral
      '--accent-2': '245 166 35', // amber
      '--bg-primary': '#140C12',
      '--bg-secondary': '#27141C',
      '--surface': '#1F141C',
      '--surface-raised': '#2C1D27',
      '--text-primary': '#FBEFEA',
      '--text-secondary': '#C4A79E',
      '--radius': '20px',
      '--glow-strength': '0.65',
    },
  },
  daylight: {
    label: 'Daylight',
    mode: 'light',
    tokens: {
      '--accent': '232 90 76', // coral that reads on light
      '--accent-2': '109 79 160',
      '--bg-primary': '#FAF8FF',
      '--bg-secondary': '#EEE8FB',
      '--surface': '#FFFFFF',
      '--surface-raised': '#F5F1FE',
      '--text-primary': '#1E1633',
      '--text-secondary': '#6B6385',
      '--radius': '16px',
      '--glow-strength': '0.25',
    },
  },
}

export const DEFAULT_PRESET = 'crystal'
