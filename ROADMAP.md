# Beacon Roadmap

Where the project stands and everything left to do. Updated 2026-07-03.

## Done

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
- **Design system** — Crystal Beacon tokens + theme engine, lighthouse-rail
  "spaces" nav; Home, Files, Watch Party, Messages, Settings, and the auth
  pages are all on it.
- **Customization** — Appearance panel with Easy / Advanced / Tinkerer modes,
  validated custom CSS, shareable theme export/import, a Shadow-DOM revert
  button user styles can't break, and a global motion toggle that honors
  prefers-reduced-motion.
- **Social** — request-to-stream with host approval, file-in-DM (P2P,
  resumable), watch-party invites as in-chat Join cards, group DMs with
  per-member encryption, personal stats, profiles, and leaderboards.
- **Cinema mode** — pure-CSS lights-down while playing.
- **Reliability** — P2P connections fail gracefully with a clear error + retry
  (no more infinite spinner); shared playback control (anyone can pause/seek).
- **Deployed** — live on an Oracle Cloud free VM behind Caddy (HTTPS), systemd,
  SQLite on a persistent path. See `deploy/DEPLOY.md`.

## Remaining

### UI polish
- [ ] The inner FileShare, VideoFileSharing, and Voice panels still carry
      pre-design-system blue/green accents.
- [ ] Replace the default Vite favicon with a real one.

### Connectivity
- [ ] Firefox + TURN: the free Metered relay gives Firefox zero relay
      candidates (see QUESTIONS.md). Try another provider and verify on two
      real devices on different networks.

### PWA
- [ ] Installable app: manifest, icons, offline shell ("add to home screen").
- [ ] (Optional, later) Tauri desktop wrapper from the same web code.

### Smaller debt
- [ ] DM key backup (passphrase) + device-only delivery toggle (deferred from
      the DM work).
- [ ] OPFS cleanup sweep for abandoned partial transfers.
- [ ] Swap the temporary hostname for a real (sub)domain when one is
      available: edit the Caddyfile site line + ALLOWED_ORIGINS, reload Caddy.
