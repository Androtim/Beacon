# Deploying Beacon

Beacon is a **thin signaling server + static SPA**; the heavy data (files, video,
voice) is peer-to-peer, so the cheapest small VPS is plenty. This guide uses a
Hetzner VPS + Caddy (automatic HTTPS) + systemd, with the client served as static
files on the same origin as the API. **HTTPS is mandatory** — voice (mic), the
streaming service worker, and secure WebRTC only work in a secure context.

Legend: 🧑 = only you can do it · 🤖 = doable over SSH.

> **Using Oracle Cloud (Always Free) instead of Hetzner?** Replace section 1 with
> the [Oracle appendix](#appendix-oracle-cloud-always-free) below, then continue
> from section 2. Sections 3–9 are identical (just SSH in as `ubuntu` and `sudo`).

---

## 1. 🧑 Create the server (Hetzner Cloud)

- **Location:** an **EU** region (Falkenstein / Nuremberg / Helsinki). ARM is EU-only
  and cheapest. Signaling is tiny, so EU latency is fine even for non-EU users.
- **Image:** Ubuntu 24.04 LTS.
- **Type:** **CAX11** (ARM, 2 vCPU / 4 GB) — the cheapest plan (~€3.79/mo + ~€0.60
  for the IPv4). Avoid US locations / the CPX line; that's where the ~€5.39 comes from.
- **SSH key:** add the **public key of the machine running Claude Code** so `ssh
  root@<IP>` works from here. (Generate with `ssh-keygen` if needed; paste the
  `.pub` contents into Hetzner.)
- **Firewall** (Hetzner Cloud → Firewalls), inbound allow:
  - `22/tcp` (SSH), `80/tcp` + `443/tcp` (web).
  - Only if self-hosting TURN: `3478/tcp`, `3478/udp`, `5349/tcp`, `5349/udp`,
    and UDP `49152-65535`.

Note the server's **public IPv4** — you'll need it for DNS.

## 2. 🧑 DNS — a subdomain is fine

Ask your friend (the domain owner) to add **one record**:

| Type | Name (host) | Value           | Proxy        |
|------|-------------|-----------------|--------------|
| A    | `beacon`    | `<server IPv4>` | **DNS only** |

That publishes `beacon.theirdomain.com`. If their DNS is on **Cloudflare**, set the
record to **DNS only (grey cloud)** so Caddy can fetch its own Let's Encrypt cert
directly (orange-cloud/proxy adds avoidable TLS complications for WebSockets/TURN).
Optionally add an `AAAA` record to the IPv6 if you enabled one.

Check it resolves: `dig +short beacon.theirdomain.com` → your IP.

## 3. 🤖 Provision the box

```bash
ssh root@<IP>
apt update && apt -y upgrade

# Node 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt -y install nodejs git build-essential   # build tools: better-sqlite3 compiles natively

# Caddy (automatic HTTPS reverse proxy)
apt -y install debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt update && apt -y install caddy

# Unprivileged service user + app + data dirs
useradd --system --create-home --shell /usr/sbin/nologin beacon
mkdir -p /opt/beacon /opt/beacon/data
chown -R beacon:beacon /opt/beacon
```

## 4. 🤖 Get the code and build

```bash
git clone https://github.com/Androtim/Beacon.git /opt/beacon   # public repo, no token needed
cd /opt/beacon
npm run install-all      # root + client + server deps
npm run build            # produces client/dist (the static SPA)
chown -R beacon:beacon /opt/beacon
```

## 5. 🤖 Configure the server env

```bash
cp /opt/beacon/server/.env.example /opt/beacon/server/.env
# Generate a strong secret:
echo "JWT_SECRET=$(openssl rand -base64 48)"
nano /opt/beacon/server/.env
```

Set at minimum:

```
PORT=3001
JWT_SECRET=<the generated value>
ALLOWED_ORIGINS=https://beacon.theirdomain.com
DB_PATH=/opt/beacon/data/beacon.db
```

(TURN comes in step 8.)

## 6. 🤖 Run the server under systemd

```bash
cp /opt/beacon/deploy/beacon.service /etc/systemd/system/beacon.service
# Confirm the npm path matches ExecStart:  which npm
systemctl daemon-reload
systemctl enable --now beacon
journalctl -u beacon -f      # should log: ✅ Beacon Server running on port 3001
```

## 7. 🤖 Caddy (HTTPS + static + proxy)

```bash
cp /opt/beacon/deploy/Caddyfile /etc/caddy/Caddyfile
sed -i 's/beacon.example.com/beacon.theirdomain.com/' /etc/caddy/Caddyfile
systemctl reload caddy
```

Caddy now serves the SPA from `client/dist`, proxies `/api` + `/socket.io` to the
Node server, and obtains HTTPS automatically. Visit **https://beacon.theirdomain.com**.

## 8. TURN (WebRTC relay fallback)

Most P2P connects directly; ~10–20% behind strict NATs need a relay. Pick one:

- **Managed (easiest):** 🧑 create a free **Metered** account (~50 GB/mo free), then 🤖
  set in `.env`: `TURN_CREDENTIAL_API_URL=https://<sub>.metered.live/api/v1/turn/credentials?apiKey=<key>`
  and `systemctl restart beacon`.
- **Self-hosted:** 🤖 `apt install coturn`, use `deploy/coturn.conf` (set the password
  and `external-ip`), open the TURN firewall ports (step 1), and point the
  `TURN_SERVER_URL/USERNAME/PASSWORD` vars in `.env` at it.

## 9. ✅ Verify

- Load the site in two different browsers / devices, sign in, start a watch party.
- Test voice (mic permission must appear — proves HTTPS secure context).
- Send a file in a DM and confirm it transfers.

## Updating later

```bash
cd /opt/beacon && git pull
npm run install-all && npm run build
systemctl restart beacon && systemctl reload caddy
```

## Backups

The whole app state is one SQLite file. Back it up safely with:

```bash
sqlite3 /opt/beacon/data/beacon.db ".backup '/opt/beacon/data/backup-$(date +%F).db'"
```

(Add to a cron job; copy off-box for safety.)

---

## Appendix: Oracle Cloud (Always Free)

Runs Beacon at **$0/mo**. Use this in place of section 1, then continue from
section 2 (DNS). Two things trip everyone up: a **dual firewall** (cloud + the
instance's own iptables) and **ARM capacity**.

### A. 🧑 Account

- Sign up at cloud.oracle.com. A card is required for identity verification —
  **not charged** while you stay on Always Free shapes.
- **Home region is permanent** — pick one near you that has ARM (Ampere A1)
  capacity.
- **Recommended:** after signup, upgrade the account to **Pay As You Go**. It
  stays free within Always Free limits but **exempts you from idle-instance
  reclamation** (Oracle otherwise reclaims low-CPU free instances after ~7 days).

### B. 🧑 Create the instance

- **Image:** Canonical **Ubuntu 24.04** (matches this guide).
- **Shape:** **VM.Standard.A1.Flex** (ARM), e.g. **2 OCPU / 12 GB** — well within
  the Always Free cap of 4 OCPU / 24 GB. Node and better-sqlite3 build fine on ARM.
  - If you hit **"Out of host capacity"** (common for A1), either retry over a few
    hours / try another Availability Domain, or fall back to **VM.Standard.E2.1.Micro**
    (x86, 1 OCPU / 1 GB, always available) — but then **add swap** (step D) so the
    client build doesn't run out of memory.
- **SSH key:** upload the **public key of the machine running Claude Code**. The
  login user is **`ubuntu`** (so `ssh ubuntu@<IP>`, then `sudo -i`).
- **Public IP:** keep the assigned IPv4. Reserve it (Networking → reserved IPs,
  also free) so it survives stop/start and your DNS never breaks.

### C. 🧑 Open the ports — in BOTH firewalls

1. **Cloud firewall** (VCN → Security Lists, or an NSG): add ingress rules for
   `0.0.0.0/0` → `80/tcp` and `443/tcp` (22 is already open). Add the TURN ports
   from section 1 only if self-hosting coturn.
2. **Instance firewall** — Oracle's Ubuntu image *also* blocks everything but SSH
   with iptables. Over SSH:
   ```bash
   sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
   sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
   sudo netfilter-persistent save
   ```
   (Skip this and the site is unreachable even with the cloud rule in place.)

### D. 🤖 (E2.1.Micro only) add swap so the build doesn't OOM

```bash
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### E. Continue from section 2

Do DNS (section 2), then sections 3–9 as written — except SSH in as
`ssh ubuntu@<IP>` and run `sudo -i` first (the guide's commands assume root).
