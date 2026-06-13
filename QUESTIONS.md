# Questions & overnight decisions — for Androtim

Decisions I made on your behalf during the autonomous overnight run, plus open
questions. Nothing here blocks the work; answer whenever.

## Decisions made (flag if you disagree)

1. **Phase 1 merged (PR #3).** Self-reviewed with a multi-agent code review,
   fixed 4 findings (stale socket identity after rename, undefined coercion,
   file-share session purging, protocol type cleanup), all 7 tests green.

2. **Video controls are now host-only, enforced server-side.** The old server
   let any participant emit play/pause/seek for the room. The UI only ever
   exposed controls to the host, so nothing visible changed — but if you want
   "anyone can control playback" as a room option, say so and I'll add a room
   setting in a later phase.

3. **Phase 2 player: native HTML5 video instead of Video.js for direct URLs.**
   Video.js fought the sync engine (it wraps events and made
   programmatic-vs-user action detection unreliable) and is the source of the
   dispose/recreate crashes. Native <video> handles mp4/webm/mov/blob. The one
   loss: **HLS streams (.m3u8) no longer play** — that needs hls.js (~1 day to
   add back). Question: do you actually use HLS streams? If yes I'll add hls.js
   support in Phase 3/5.

4. **Chat timestamps are server-assigned** (clients can't fake message times).

## Open questions (answer when you're back)

- **TURN server**: the code reads TURN_SERVER_URL/USERNAME/PASSWORD from
  server/.env but nothing is configured. For internet-grade P2P you'll want a
  free account at a managed TURN provider (e.g. metered.ca free tier / Open
  Relay) — takes 5 minutes, then paste the 3 values into server/.env. I can't
  create the account for you (needs an email signup).
- **HLS streams** — see decision 3 above.
- The old `feat/p2p-stability-and-mobile-ui` and `staging` remote branches are
  fully merged and stale. OK to delete them on GitHub? (I left them alone.)
