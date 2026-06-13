# Beacon — Synchronized Watch Parties & P2P File Sharing 📡

Beacon lets people watch videos in perfect sync and share files directly
between browsers. It's web-first and private by architecture: the server only
introduces peers and relays signaling — video, file bytes, voice, and room
chat all flow peer-to-peer over WebRTC (DTLS-encrypted), and direct messages
are end-to-end encrypted. No account is needed to join.

![Status](https://img.shields.io/badge/Status-Core_Complete-violet)
![Tests](https://img.shields.io/badge/Tests-30_passing-green)
![Security](https://img.shields.io/badge/DMs-E2E_Encrypted-cyan)

## ✨ Features

### 🎬 Synchronized watch parties
*   **Authoritative sync** — the server owns playback state; every client steers
    toward it with clock-offset estimation and continuous drift correction
    (invisible rate nudges, hard-seek only for large gaps). Late joiners land
    mid-playback in sync.
*   **Multi-source** — direct video links (.mp4/.webm/.mov), YouTube (synced via
    the official IFrame Player API), and local files shared peer-to-peer.
*   **Stream-while-downloading** — when a host shares a local file, participants
    start watching within seconds (a service worker pulls byte ranges from the
    host on demand) instead of waiting for a full transfer.
*   **Voice chat** — opt-in P2P mesh voice with mute/leave.
*   **Live chat** — real-time room chat with server-authenticated identities.

### 📁 P2P file sharing
*   **Pure P2P transfer** — files stream directly browser-to-browser; the server
    stores nothing.
*   **Resumable** — transfers survive disconnects and page reloads, continuing
    from the last byte on disk (received data is written to OPFS, not held in
    RAM, so large files don't exhaust memory).
*   **Share codes** — 8-character codes for one-to-many transfers; multiple files
    arrive as a zip.

### 🔐 Accounts & privacy
*   **Guest-first** — anyone can join or host from a link with an
    auto-generated identity; accounts are optional.
*   **End-to-end encrypted DMs** — ECDH P-256 + AES-GCM via WebCrypto; the
    server stores only ciphertext envelopes it cannot read.

## 🛠 Tech stack

*   **Frontend**: React 18, Vite, Tailwind CSS, Framer Motion, Lucide icons
*   **Networking**: native WebRTC (perfect negotiation), Socket.io
*   **Backend**: Node.js, Express, Socket.io (TypeScript, run via tsx)
*   **Database**: SQLite (better-sqlite3)
*   **Shared**: typed client/server protocol in `shared/`
*   **Tests**: Playwright (`npm run test:e2e`)

## 🚀 Quick start

```bash
git clone https://github.com/Androtim/Beacon.git
cd Beacon
npm run install-all

# Server needs a JWT secret to start
cd server && echo "JWT_SECRET=replace-with-a-long-random-string" > .env && cd ..

npm run dev   # client on :3000, server on :3001
```

For watching/sharing across different networks (not just one LAN), configure a
TURN server — see [`QUESTIONS.md`](./QUESTIONS.md) for the 5-minute setup.

## ⚙️ Server environment (`server/.env`)

| Variable | Required | Purpose |
| --- | --- | --- |
| `JWT_SECRET` | yes | Signs auth tokens; server refuses to start without it |
| `PORT` | no | Server port (default 3001) |
| `ALLOWED_ORIGINS` | no | Comma-separated CORS allowlist for production |
| `TURN_SERVER_URL` / `TURN_SERVER_USERNAME` / `TURN_SERVER_PASSWORD` | no | TURN relay for cross-network P2P |

## 🧪 Tests

```bash
npm run test:e2e   # Playwright: sync drift, restart persistence, P2P resume,
                   # transfers, streaming, voice, and DM encryption
```

## 📋 Key API routes

*   `POST /api/auth/guest` — create an anonymous identity
*   `POST /api/auth/signup` · `POST /api/auth/login` — accounts (signup upgrades a guest in place)
*   `POST /api/auth/public-key` — publish an E2E-DM public key
*   `GET /api/ice-servers` — STUN/TURN configuration for WebRTC
*   `GET /api/messages/:userId` · `GET /api/conversations` — DM history (ciphertext)

---

See [`CLAUDE.md`](./CLAUDE.md) for architecture and the rebuild log, and
[`DESIGN.md`](./DESIGN.md) for design direction.
