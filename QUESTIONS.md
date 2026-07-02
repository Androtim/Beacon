# Beacon — decisions log & open items

Decisions made during the 2026 rebuild, plus what's still open.

## Resolved

- **HLS streams (.m3u8): dropped.** Not used in practice. Native `<video>`
  (mp4/webm/mov/blob) + YouTube cover all sources. The HLS mention was removed
  from the UI copy. (If that ever changes, hls.js is ~1 day to add.)
- **Stale branches deleted.** `feat/p2p-stability-and-mobile-ui` and `staging`
  (both pre-rebuild, 0 commits ahead of main) are gone; all merged phase
  branches were auto-deleted. Only `main` remains.
- **Video source is host-only, playback control is shared.** Setting what plays
  is enforced server-side as a host decision; play/pause/seek is open to the
  room. Non-hosts can propose a source via request-to-stream.
- **Player is native HTML5 video**, not Video.js (Video.js fought the sync
  engine and caused the dispose/recreate crashes).
- **Chat timestamps are server-assigned** (clients can't forge message times).

## Known issue — Firefox + the Metered TURN relay

Diagnosed 2026-06-13 from a Chrome-host → Firefox-participant test that hung
forever. Two findings:

1. **Fixed: the infinite "connecting" hang.** P2P connections now time out
   after 25s (and Firefox's ICE failure is now detected — previously only
   `connectionState` was watched, which Firefox doesn't drive). A failed
   connection shows "Couldn't connect" with Try again / Cancel instead of
   spinning forever. Applies to both watch-party file sharing and share-code
   transfers.

2. **Open: Firefox can't use the current TURN relay.** Chromium gathers relay
   candidates from `standard.relay.metered.ca` fine, but Firefox gets zero on
   every transport (80/443, udp/tcp/tls). So Chrome↔Firefox (and Firefox on a
   restrictive network) can't connect via relay. Chrome↔Chrome and same-network
   cases are unaffected. Likely the free shared Metered relay; next step is a
   different TURN provider/credentials and a Firefox re-test, or a check on two
   real machines on different networks. Not a code bug — a relay reachability
   gap.

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

The signup needs an email account, so it can't be automated; everything after
is wired.

### 2. Deferred to the UI/PWA phase

- **DM key backup** — encryption keys are per-device today (a new device can't
  read old messages). The planned passphrase-protected backup needs UI.
- **Device-only DM delivery toggle** — right now undelivered messages park on
  the server as ciphertext (mailbox always on). Making device-only the default
  needs local-first history. Either way the server can't read anything.

## Note for the UI phase

UI overhaul + PWA is the last phase and is intentionally not started — it needs
design direction (current lean: dark-first with the Crystal Beacon token
system). Confirm or redirect when ready.
