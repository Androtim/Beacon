# Beacon 📡

**Synchronized watch parties and peer-to-peer file sharing, in the browser.**

Beacon lets people watch videos in perfect sync and send files directly between
devices — no install for the people you invite, and no account required to join.
It's private by design: video, files, voice, and room chat travel peer-to-peer
between participants while the server only handles signaling and presence.
Direct messages are end-to-end encrypted.

![Status](https://img.shields.io/badge/Status-Core_Complete-violet)
![Tests](https://img.shields.io/badge/Tests-30_passing-green)
![DMs](https://img.shields.io/badge/DMs-E2E_Encrypted-cyan)

---

## Features

**Watch parties**
- Authoritative, drift-corrected sync — everyone sees the same moment; late
  joiners snap to the current position.
- Sources: direct video links (`.mp4`/`.webm`), YouTube (synced via the IFrame
  Player API), and local files shared peer-to-peer.
- Stream-while-downloading: shared files start playing within seconds instead of
  after a full transfer.
- Opt-in voice chat and live text chat per room.

**File sharing**
- Direct browser-to-browser transfer; nothing is stored on a server.
- Resumable — interrupted transfers continue from where they stopped.
- 8-character share codes; multiple files are delivered as a zip.

**Accounts & privacy**
- Guest-first: a friendly identity is created automatically, so anyone can join
  or host immediately. Accounts add direct messages, a persistent identity, and
  stats.
- End-to-end encrypted DMs (ECDH P-256 + AES-GCM); the server stores only
  ciphertext it cannot read.

---

## Getting started

### Prerequisites

- **Node.js 18+** (includes `npm`). Get it from [nodejs.org](https://nodejs.org)
  — the LTS release. Verify with `node --version`.

### Install

From the project root:

```bash
npm run install-all      # installs root, client, and server dependencies
```

### Configure

The server needs a single required setting. Create `server/.env`:

```bash
# server/.env
JWT_SECRET=a-long-random-private-string
```

> **`JWT_SECRET`** is the key used to sign session tokens (JSON Web Tokens), so
> the server can trust that a request really comes from a logged-in user. Use any
> sufficiently long, random, private value — it's required for the server to
> start. Never commit it, and use a strong unique value in production.

Optional settings (TURN relay, CORS origins, port) are listed under
[Configuration](#configuration).

### Run

```bash
npm run dev              # starts the client (:3000) and server (:3001) together
```

Then open **http://localhost:3000**. Stop the app with `Ctrl + C`.

### Testing it yourself

Beacon ties your identity to your browser session, so **two tabs in the same
browser count as the same person** — a watch party with yourself there will look
empty. To simulate two participants on one machine, use two *separate* sessions:
a normal window plus an Incognito/Private window, two different browsers, or two
devices. (In a party, remember the host must set a video source before anything
plays.)

---

## Scripts

| Command | Description |
| --- | --- |
| `npm run install-all` | Install dependencies for root, client, and server |
| `npm run dev` | Run client and server together for development |
| `npm run build` | Production build of the client |
| `npm run test:e2e` | Run the Playwright test suite |

---

## Configuration

All server settings live in `server/.env`.

| Variable | Required | Description |
| --- | --- | --- |
| `JWT_SECRET` | **Yes** | Signing key for session tokens; the server won't start without it. |
| `PORT` | No | Server port (default `3001`). |
| `ALLOWED_ORIGINS` | No | Comma-separated list of permitted browser origins for a public deployment. |
| `TURN_CREDENTIAL_API_URL` | No | Provider endpoint (e.g. metered.ca) that returns the full ICE/TURN server list for cross-network P2P. |
| `TURN_SERVER_URL`, `TURN_SERVER_USERNAME`, `TURN_SERVER_PASSWORD` | No | A single static TURN server, as an alternative to the API URL (e.g. self-hosted coturn). |

---

## Architecture

- **Client** — React 18, Vite, Tailwind CSS.
- **Server** — Node, Express, Socket.io, written in TypeScript and run with
  `tsx`.
- **Database** — SQLite (`better-sqlite3`).
- **Realtime/transport** — Socket.io for signaling; native WebRTC for all
  peer-to-peer media and data.
- **Shared** — a typed client/server protocol in `shared/`.
- **Tests** — Playwright end-to-end suite covering sync, persistence, P2P
  transfer/resume, streaming, voice, and DM encryption.

See [`CLAUDE.md`](./CLAUDE.md) for the full architecture and build log.

---

## Deployment

Running locally is reachable only from your own machine. To use Beacon across
the internet, either expose the local server through a tunnel (e.g. Cloudflare
Tunnel) for quick testing, or host it and set `ALLOWED_ORIGINS` to your real
domain.

Peer-to-peer connections between different home networks generally require a
TURN relay. See [`QUESTIONS.md`](./QUESTIONS.md) for a free five-minute setup.

---

## Documentation

- [`CLAUDE.md`](./CLAUDE.md) — architecture and engineering notes
- [`DESIGN.md`](./DESIGN.md) — design direction
- [`QUESTIONS.md`](./QUESTIONS.md) — open items and TURN setup

## License

[MIT](./LICENSE)
