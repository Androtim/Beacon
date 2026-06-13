# Beacon — Synchronized Watch Parties & P2P File Sharing

Beacon lets people watch videos in perfect sync and share files directly between
browsers (WebRTC). Web-first PWA. Core principles: free, zero setup for
non-technical users, private by architecture (the server never sees file or
chat content), no account required to join.

## Architecture

**Thin server, fat P2P.** The Node server is a rendezvous point only: signaling,
presence, auth, TURN config, and (opt-in) encrypted DM mailbox. All heavy data —
file bytes, video, voice, room chat, sync ticks — flows over WebRTC data channels
directly between peers, with the watch-party host acting as the hub. WebRTC's
mandatory DTLS encryption makes all of that end-to-end encrypted by default.

```
client/            React 18 + Vite + Tailwind (JSX, migrating to TS gradually)
  src/components/  VideoPlayer, ChatBox, FileShare, VideoFileSharing, Layout
  src/context/     AuthContext, ThemeContext
  src/hooks/       useSocket, useWatchParty, useWebRTC
  src/pages/       Home, Login, Signup, Settings, WatchParty, Messages
server/            Node + Express + Socket.io, TypeScript (run via tsx)
  src/index.ts     Entrypoint, REST endpoints
  src/db.ts        SQLite layer (better-sqlite3, WAL) — users, messages
  src/auth.ts      Signup/login/me/logout routes (JWT, bcrypt)
  src/middleware.ts JWT sign/verify + express auth middleware
  src/sockets.ts   Socket.io: rooms, sync events, P2P signaling relay
  data/beacon.db   SQLite database (gitignored)
shared/protocol.ts Single source of truth for every socket event and API shape,
                   imported by server (relative) and client (@shared alias)
```

## Commands

```bash
npm run install-all   # install root + client + server deps
npm run dev           # client (localhost:3000) + server (localhost:3001)
npm run build         # production client build
cd server && npm run typecheck   # tsc --noEmit
```

`server/.env` requires `JWT_SECRET` (server refuses to start without it).
Optional: `PORT`, `TURN_SERVER_URL`/`TURN_SERVER_USERNAME`/`TURN_SERVER_PASSWORD`.

## Rebuild status (June 2026)

The core is being rebuilt phase by phase on feature branches. Decisions already
validated by the owner — do not re-litigate:

- **SQLite** (no MongoDB, no in-memory fallback), **TypeScript**, **web-first PWA**
  (no native apps, no Rust/Go), **guest-first** (accounts optional), internet
  deployment with **TURN fallback**.
- Features in scope: stream-while-downloading playback (MSE), real YouTube sync
  via the official IFrame Player API, voice chat, resumable transfers.
- DMs: E2E-encrypted with on-device history; offline delivery via device-retry
  by default, opt-in transient server mailbox (ciphertext only, deleted on
  delivery / 30-day TTL).
- UI overhaul is deliberately LAST — don't polish UI before the core works.

Phases: 0 foundation (TS+SQLite) ✅ → 1 guest identity + persistent rooms ✅
→ 2 sync engine (clock offset, drift loop, YouTube IFrame API) ✅
→ 3a P2P engine (perfect negotiation, OPFS streaming, resume) ✅
→ 3b stream-while-downloading (service worker + P2P range protocol) ✅
→ 4 voice chat + E2E-encrypted DMs ✅ → 5 UI overhaul + PWA (NEXT, needs
owner's design input).
All phases have Playwright coverage (`npm run test:e2e`, 30 tests): real
two-browser drift measurement, restart persistence, loopback resume with
SHA-256 byte-identity, transfer e2e, streamed playback, voice with fake audio
devices, and ciphertext-on-the-server verification for DMs.

Known follow-ups (see QUESTIONS.md): TURN credentials (env-ready, account
needed), DM passphrase key backup, device-only DM delivery toggle, OPFS orphan
sweep for abandoned partial transfers. (HLS dropped — not needed.)

### Known-broken (inherited, fixed by phases 1–3)

- Rooms are in-memory (`server/src/sockets.ts`) — wiped on every server restart.
- Sync echo loop: server broadcasts video events back to their originator; no
  authoritative clock, no drift correction. Player disposed/recreated on state
  changes in `WatchParty.jsx`.
- Each `useSocket()` call opens its own connection; no rejoin on reconnect.
- WebRTC: STUN-only default, no perfect negotiation, received files buffered
  entirely in RAM, transfer must complete before playback.

## Engineering rules

- Every message crossing the wire gets its type in `shared/protocol.ts` first.
- Trust the socket's authenticated identity, never client-supplied usernames/ids.
- Verify with tests (Playwright multi-tab e2e for sync/transfer claims), not
  console.log sessions. Don't claim something works without running it.
- Git: feature branch per phase, small conventional commits, PRs to main.
- YouTube sync IS possible (IFrame Player API) — older docs claiming otherwise
  were wrong.
