# Beacon — Synchronized Watch Parties & P2P File Sharing 📡

Beacon lets you watch videos in perfect sync with friends and send files
straight between browsers. It's a website (nothing to install for the people
you invite), and it's private by design: video, files, voice, and chat travel
directly between people — the server just introduces everyone and gets out of
the way. Direct messages are end-to-end encrypted, and you don't even need an
account to join a party.

![Status](https://img.shields.io/badge/Status-Core_Complete-violet)
![Tests](https://img.shields.io/badge/Tests-30_passing-green)
![Security](https://img.shields.io/badge/DMs-E2E_Encrypted-cyan)

---

## 🟢 Just want to see it? (complete beginner — no experience needed)

You can run Beacon on your own computer in a few minutes. Follow these exactly;
you don't need to understand any of it.

### Step 1 — Install Node.js (one time only)

Node.js is the engine that runs Beacon. Think of it like installing the app
that opens a file type.

1. Go to **https://nodejs.org**
2. Click the big button that says **"LTS"** (it's the recommended version).
3. Open the downloaded file and click Next → Next → Install, accepting the
   defaults. Done.

*(If you're not sure whether you already have it: skip to Step 3 and run
`node --version`. If it prints a number like `v22.14.0`, you already have it.)*

### Step 2 — Get the project onto your computer

If you're reading this, you probably already have the `Beacon` folder. If not,
download it from GitHub (green **Code** button → **Download ZIP**) and unzip it
somewhere easy like your Desktop.

### Step 3 — Open a terminal *inside the Beacon folder*

A "terminal" is just a window where you type commands. The easy way to open one
in the right place:

1. Open the **Beacon** folder in File Explorer.
2. Click the **address bar** at the top (where the folder path is shown).
3. Type `cmd` and press **Enter**.

A black window opens, already pointing at the Beacon folder. You type commands
here and press Enter after each one.

### Step 4 — Set up the project (one time only)

In that black window, type this and press Enter, then wait (it downloads the
building blocks — can take a couple of minutes):

```
npm run install-all
```

Then create the one required setting (explained in the glossary below). Copy
this whole line, paste it in, press Enter:

```
cd server && echo JWT_SECRET=please-change-me-to-anything-long-and-random > .env && cd ..
```

### Step 5 — Start Beacon

```
npm run dev
```

Wait a few seconds until it stops printing new lines. **Leave this window open**
— closing it stops Beacon.

### Step 6 — Open it

Open your web browser and go to:

> **http://localhost:3000**

That's Beacon, running on your computer. 🎉

### Try a watch party with yourself

1. In a **normal** browser window, open http://localhost:3000 and click
   **Start watching**. Look at the address bar — it now shows a room code like
   `localhost:3000/party/AB12CD`.
2. Open a **second** window in **Incognito / Private mode** (so it counts as a
   different person) and go to that same `/party/AB12CD` address.
3. You now have two "people" in one room. Set a video as the host and watch it
   stay in sync.

### To stop Beacon

Click the black terminal window and press **Ctrl + C**. To start it again later,
just do Step 5 (`npm run dev`) — you never have to repeat steps 1–4.

---

## 📖 Plain-English glossary (what the words mean)

- **Terminal / command line** — the black window where you type instructions to
  the computer instead of clicking buttons.
- **Node.js** — the program that runs Beacon's code. Install once, forget about it.
- **npm** — comes with Node.js. It downloads the bits Beacon is built from and
  runs Beacon's commands (`npm run dev`, etc.). You don't interact with it
  beyond typing those commands.
- **localhost:3000** — "localhost" means *this computer*, and `3000` is just a
  numbered door. So this address means "the Beacon running right here on my
  machine." Other people on the internet can't reach it unless you deliberately
  share it (see Deploying).
- **JWT secret** — when you log in, the server hands you a little digital
  "membership card" (a token) so it knows it's you on later clicks. The JWT
  secret is the private signature the server stamps those cards with, so nobody
  can forge a fake card. **It just needs to be a long, random, private string**
  — like a password you never tell anyone. For running it on your own machine,
  literally any long phrase works. For a real public deployment, use a long
  random one and keep it secret.
- **P2P (peer-to-peer)** — data going *directly* between two people's browsers
  instead of through a middle server. It's why your files and video aren't
  stored anywhere and stay private.
- **TURN server** — a helper that relays the P2P connection when two people's
  home networks are too locked-down to connect directly. Optional; see below.
- **Guest** — you can use Beacon without making an account. A guest can join and
  host watch parties and send/receive files. Accounts add direct messages,
  saved identity, and stats.

---

## ✨ What Beacon does

### 🎬 Synchronized watch parties
- Everyone watches the same moment at the same time — Beacon keeps playback in
  sync and gently corrects drift. Late arrivals jump straight to the right spot.
- Play a direct video link (.mp4/.webm), a **YouTube** video, or a file from
  your own device shared peer-to-peer.
- **Start watching in seconds**: when you share a file, friends begin watching
  almost immediately instead of waiting for a full download.
- Opt-in **voice chat** and live text chat in every room.

### 📁 File sharing
- Files go **directly browser-to-browser** — nothing is stored on a server.
- **Resumable**: if a transfer is interrupted (closed tab, dropped Wi-Fi), it
  continues from where it stopped instead of starting over.
- Share with a simple 8-character code; multiple files arrive as a zip.

### 🔐 Accounts & privacy
- **No account needed to join** — you get a friendly guest name automatically.
- **End-to-end encrypted direct messages**: only you and the recipient can read
  them; the server stores scrambled text it cannot decode.

---

## 🛠 For developers

**Stack**: React 18 + Vite + Tailwind (client) · Node + Express + Socket.io in
TypeScript via `tsx` (server) · SQLite (better-sqlite3) · native WebRTC ·
Playwright tests. A typed client/server protocol lives in `shared/`.

```bash
npm run install-all   # install everything (root + client + server)
npm run dev           # run client (:3000) + server (:3001) together
npm run build         # production build of the client
npm run test:e2e      # Playwright tests
```

### Server settings (`server/.env`)

| Variable | Required | What it's for |
| --- | --- | --- |
| `JWT_SECRET` | **yes** | Private signature for login tokens (see glossary). Server won't start without it. |
| `PORT` | no | Which port the server uses (default 3001). |
| `ALLOWED_ORIGINS` | no | Comma-separated list of allowed website addresses, for a public deployment. |
| `TURN_CREDENTIAL_API_URL` | no | A provider URL (e.g. metered.ca) that supplies TURN relay servers for cross-network P2P. |
| `TURN_SERVER_URL` / `TURN_SERVER_USERNAME` / `TURN_SERVER_PASSWORD` | no | Alternative: a single TURN server (e.g. self-hosted coturn). |

### Deploying / using it across the internet

Running locally (the guide above) only works on your own machine. To watch with
friends elsewhere you either:
- expose your local server with a tunnel (e.g. Cloudflare Tunnel) for quick
  testing, or
- host it on a small server and set `ALLOWED_ORIGINS` to your real address.

For P2P to succeed across different home networks you'll usually want a TURN
relay — see [`QUESTIONS.md`](./QUESTIONS.md) for a 5-minute free setup.

---

See [`CLAUDE.md`](./CLAUDE.md) for architecture and the build log, and
[`DESIGN.md`](./DESIGN.md) for the design direction.
