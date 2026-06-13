# Beacon — decisions log & open items

Decisions made during the autonomous rebuild, plus what's still open.

## Resolved

- **HLS streams (.m3u8): dropped.** You confirmed you don't use them. Native
  `<video>` (mp4/webm/mov/blob) + YouTube cover all sources. The HLS mention
  was removed from the UI copy. (If that ever changes, hls.js is ~1 day to add.)
- **Stale branches deleted.** `feat/p2p-stability-and-mobile-ui` and `staging`
  (both pre-rebuild, 0 commits ahead of main) are gone; all merged phase
  branches were auto-deleted. Only `main` remains.
- **Video controls are host-only**, enforced server-side. Say so if you want an
  "anyone can control" room option later.
- **Player is native HTML5 video**, not Video.js (Video.js fought the sync
  engine and caused the dispose/recreate crashes).
- **Chat timestamps are server-assigned** (clients can't forge message times).

## Still open

### 1. TURN server (only thing blocking cross-network P2P)

Without TURN, P2P connects for ~80–85% of network pairs; strict/corporate/
mobile-carrier NATs need a relay. Setup is ~5 minutes and free:

1. Sign up at **https://www.metered.ca/tools/openrelay/** (free tier: 20 GB/mo
   relayed — only the unlucky NAT pairs ever use it) or run your own coturn.
2. From the dashboard, copy the TURN URL, username, and credential.
3. Add them to `server/.env`:
   ```
   TURN_SERVER_URL=turn:your-subdomain.metered.live:80
   TURN_SERVER_USERNAME=your-username
   TURN_SERVER_PASSWORD=your-credential
   ```
4. Restart the server. The `/api/ice-servers` endpoint already picks these up
   and hands them to every browser automatically — no code change needed.

(I can't do step 1–2: it needs an email signup. Everything after is wired.)

### 2. Deferred to Phase 5 (UI/PWA)

- **DM key backup** — encryption keys are per-device today (a new device can't
  read old messages). The passphrase-protected backup you approved needs UI.
- **Device-only DM delivery toggle** — right now undelivered messages park on
  the server as ciphertext (mailbox always on). Making device-only the default
  needs local-first history. Either way the server can't read anything.

## Note for Phase 5

UI overhaul + PWA is the last phase and is intentionally not started — it needs
your design direction. DESIGN.md says "premium, dark-first, glassmorphism";
confirm or redirect when ready.
