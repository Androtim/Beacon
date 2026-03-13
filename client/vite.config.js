import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
      protocolImports: true,
    })
  ],
  server: {
    port: 3000,
    strictPort: true,
    allowedHosts: [
      'acid-former-gulf-impression.trycloudflare.com',
      '.trycloudflare.com'
    ],
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      },
      '/ws': {
        target: 'http://localhost:8080',
        ws: true
      }
    }
  },
})