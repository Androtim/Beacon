import { Buffer } from 'buffer'

// Global polyfills for Node.js APIs required by simple-peer and others
if (typeof window !== 'undefined') {
  window.global = window
  window.process = { env: {} }
  window.Buffer = Buffer
}
