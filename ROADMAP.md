# Beacon Roadmap

Where the project stands and everything left to do. Updated 2026-06-13.

## ✅ Done

- **Foundation** — TypeScript + SQLite, typed shared client/server protocol, tests.
- **Sessions** — guest-first identity, persistent rooms that survive restarts,
  auto rejoin + resync on reconnect, host-grace migration.
- **Sync engine** — server-authoritative playback, clock-offset estimation,
  drift correction; direct video, YouTube, and P2P local files.
- **P2P engine** — perfect negotiation, OPFS disk streaming, resumable
  transfers; share-code file sending; stream-while-downloading watch parties.
- **Voice chat** — opt-in P2P mesh audio with mute/leave.
- **E2E-encrypted DMs** — server stores only ciphertext.
- **TURN** — relay configured via provider API (works in Chromium).
- **Design system (Phase 5a)** — Crystal Beacon tokens + theme engine,
  lighthouse-rail "spaces" nav, redesigned Home (Watch) and Files screens.
- **Reliability** — P2P connections fail gracefully with a clear error + retry
  (no more infinite spinner); shared playback control (anyone can pause/seek).

## 🔜 Remaining

### 1. Finish the visual overhaul (reskin remaining screens to Crystal Beacon)
- [ ] Watch Party (the heart of the app — biggest screen)
- [ ] Messages / DMs
- [ ] Settings
- [ ] Login / Signup (auth pages)
- [ ] Polish the inner FileShare, VideoFileSharing, and Voice panels (leftover
      blue/green accents)

### 2. Customization system (3 modes, on the token engine already built)
- [ ] Appearance panel with an Easy / Advanced / Tinkerer mode switch
- [ ] Easy: preset picker + accent + light/dark + motion toggle
- [ ] Advanced: more token knobs with contrast guards + bounded ranges
- [ ] Tinkerer: full token sheet + sandboxed custom CSS, validated before apply,
      with a warning label
- [ ] Live preview pane (sample components/screens) for all modes
- [ ] Revert-to-default button rendered in Shadow DOM so user styles can never
      hide or break it
- [ ] Shareable themes (export/import token values; raw CSS stays local)
- [ ] Wire the motion toggle globally (honor prefers-reduced-motion)

### 3. New social features
- [ ] **Request-to-stream**: any participant can offer a video (URL or file);
      the room owner approves before it goes live. (Playback control is already
      shared; this is the source-authorization flow.)
- [ ] **File-in-DM**: send/download files inside a DM — P2P, resumable, live
      status on both sides, "safe to close" when done.
- [ ] **Watch-party-from-DM**: a rich in-chat "Join" card.
- [ ] **Group DMs**: multi-person chats with the same features; file status
      shows count downloading + the furthest-behind downloader's %.
- [ ] **Stats / gamification**: global personal stats + per-group leaderboards
      (watch time, most talkative, parties started), themed as "constellation"
      badges.
- [ ] **User profiles**: bio, display name, beacon avatar, stats, custom theme.

### 4. Connectivity
- [ ] Firefox + TURN: find a relay Firefox can use (provider swap) and verify on
      two real devices on different networks. (Fails gracefully today.)
- [ ] Optional "lights down" cinema mode (UI dims when playback starts).

### 5. Ship it
- [ ] PWA packaging — installable, app icon, offline shell ("add to home screen").
- [ ] Production deploy — strong JWT_SECRET, ALLOWED_ORIGINS, hosting or tunnel.
- [ ] (Optional, later) Tauri desktop wrapper from the same web code.

### 6. Smaller debt
- [ ] DM key backup (passphrase) + device-only delivery toggle (deferred from
      the DM work).
- [ ] OPFS cleanup sweep for abandoned partial transfers.

## Suggested order

Finish the **Watch Party reskin** (1) → **request-to-stream** (3, you just asked
for it, and it pairs with the Watch Party screen) → **customization system** (2)
→ remaining screens (1) → group DMs / file-in-DM / stats / profiles (3) → PWA +
deploy (5). Connectivity (4) and debt (6) slot in opportunistically.
