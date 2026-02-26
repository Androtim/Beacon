import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Polyfills for P2P networking
import { Buffer } from 'buffer'
window.Buffer = Buffer
window.global = window
window.process = { env: {} }

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)