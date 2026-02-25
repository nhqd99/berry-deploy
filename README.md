# Berry Claw

SaaS platform to deploy & manage OpenClaw AI assistant instances via Docker.

**Tech Stack:** Next.js 16 (App Router) + Convex DB (self-hosted) + Convex Auth + Docker

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Prerequisites](#prerequisites)
- [Deploy on VPS (Production)](#deploy-on-vps-production)
- [Local Development](#local-development)
- [Project Structure](#project-structure)
- [Environment Variables](#environment-variables)
- [Services & Ports](#services--ports)
- [Operations & Maintenance](#operations--maintenance)
- [Troubleshooting](#troubleshooting)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│  Cloudflare Tunnel (HTTPS)                              │
│  claw.example.com → localhost:3002                      │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│  Next.js 16 (port 3002)                                │
│  Dashboard UI — App Router                              │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│  Convex Backend (self-hosted, anonymous mode)           │
│  Managed by: npx convex dev                             │
│  API: port 3214  |  Site: port 3215                     │
│  Auth: Password + JWT (RS256)                           │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│  Docker Engine                                          │
│  OpenClaw containers (ports 20000-29999)                │
│  Each claw = 1 container (gateway + bridge)             │
└─────────────────────────────────────────────────────────┘
```

### How Convex Self-Hosted Works

> **Important:** There is no `convex backend` CLI command, and `convex deploy` rejects anonymous (self-hosted) deployments.

The self-hosted Convex stack is managed entirely by `npx convex dev`:

1. Downloads the `convex-local-backend` binary (cached in `~/.cache/convex/binaries/`)
2. Spawns the backend as a child process (ports 3214/3215)
3. Pushes all functions from `convex/` to the running backend
4. Generates `convex/_generated/` type files
5. Watches for file changes and re-pushes automatically

The `CONVEX_DEPLOYMENT=anonymous:anonymous-berry-claw` env var tells `convex dev` to use local (anonymous) mode instead of connecting to Convex Cloud.

---

## Prerequisites

| Requirement | Version |
|---|---|
| OS | Ubuntu 22.04+ / Debian 12+ |
| Node.js | 20+ |
| Docker | 24+ |
| RAM | 2GB+ (4GB recommended) |
| Disk | 20GB+ |

You also need:
- A **Git repo** containing Berry Claw source code (HTTPS URL)
- A **domain name** pointed to Cloudflare (for Cloudflare Tunnel)
- An **OpenClaw Docker image** (pre-built or from registry)

---

## Deploy on VPS (Production)

### Quick Deploy (Automated Script)

SSH into your VPS as a **non-root user with sudo access**, then:

```bash
# 1. Clone the repo
git clone https://github.com/your-org/berry-claw.git ~/berry-deploy
cd ~/berry-deploy

# 2. Make the script executable and run
chmod +x deploy.sh
./deploy.sh
```

The script will ask for 4 things:

| Prompt | Description | Example |
|---|---|---|
| Git repo URL | HTTPS URL of Berry Claw repo | `https://github.com/org/berry-claw.git` |
| Domain | Domain for the dashboard | `claw.example.com` |
| Cloudflare Tunnel token | Token from CF Dashboard (or Enter to skip) | `eyJh...` |
| OpenClaw image source | 1=Pull from registry, 2=Build from git, 3=Already local | `3` |

### Script runs 6 steps

```
Step 1/6 — Install Docker, Node.js 20, cloudflared
Step 2/6 — Clone repo & npm install + OpenClaw image
Step 3/6 — Create .env.local + generate JWT keys (RS256)
Step 4/6 — Start Convex (npx convex dev) + set JWT keys
Step 5/6 — Build Next.js + start web service
Step 6/6 — Configure Cloudflare Tunnel + UFW firewall
```

### Manual Deploy (Step by Step)

If you prefer not to use the script:

#### Step 1: Install dependencies

```bash
sudo apt update
sudo apt install -y curl git openssl ufw

# Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $(whoami)
# Log out/in for docker group to take effect

# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# cloudflared
sudo mkdir -p --mode=0755 /usr/share/keyrings
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg \
  | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
echo "deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared $(lsb_release -cs) main" \
  | sudo tee /etc/apt/sources.list.d/cloudflared.list
sudo apt update && sudo apt install -y cloudflared
```

#### Step 2: Clone & install

```bash
sudo mkdir -p /opt/berry-claw
sudo chown $(whoami):$(whoami) /opt/berry-claw
git clone <YOUR_REPO_URL> /opt/berry-claw
cd /opt/berry-claw
npm install
```

#### Step 3: OpenClaw Docker image

```bash
# Option A: Pull from registry
sudo docker pull ghcr.io/your-org/openclaw:latest
sudo docker tag ghcr.io/your-org/openclaw:latest openclaw:local

# Option B: Build from source
git clone <OPENCLAW_REPO> /tmp/openclaw
sudo docker build -t openclaw:local /tmp/openclaw
rm -rf /tmp/openclaw

# Option C: Already have openclaw:local → skip
sudo docker image inspect openclaw:local  # verify it exists
```

#### Step 4: Create .env.local

```bash
sudo tee /opt/berry-claw/.env.local > /dev/null << 'EOF'
# Convex (local anonymous mode — managed by npx convex dev)
NEXT_PUBLIC_CONVEX_URL=http://127.0.0.1:3214
NEXT_PUBLIC_CONVEX_SITE_URL=http://127.0.0.1:3215
CONVEX_SITE_URL=http://127.0.0.1:3215
CONVEX_DEPLOYMENT=anonymous:anonymous-berry-claw

# Docker / OpenClaw
OPENCLAW_IMAGE=openclaw:local
OPENCLAW_DATA_DIR=/data/berry-claw/claws
CADDYFILE_PATH=/data/berry-claw/Caddyfile

# Port range for Claw instances
PORT_RANGE_START=20000
PORT_RANGE_END=29999
EOF

sudo chown $(whoami):$(whoami) /opt/berry-claw/.env.local
```

#### Step 5: Create data directories

```bash
sudo mkdir -p /data/berry-claw/claws
sudo chown -R $(whoami):$(whoami) /data/berry-claw
```

#### Step 6: Generate JWT keys

```bash
cd /opt/berry-claw

# Generate RSA 2048-bit key
openssl genpkey -algorithm RSA -out /tmp/jwt.pem -pkeyopt rsa_keygen_bits:2048

# Create JWKS from public key
JWKS=$(node -e "
const crypto = require('crypto');
const pem = require('fs').readFileSync('/tmp/jwt.pem', 'utf-8');
const key = crypto.createPublicKey(pem);
const jwk = key.export({ format: 'jwk' });
jwk.alg = 'RS256';
jwk.use = 'sig';
jwk.kid = crypto.randomUUID();
console.log(JSON.stringify({ keys: [jwk] }));
")

# Save for later (need running backend to set them)
cat /tmp/jwt.pem > /tmp/jwt_private.txt
echo "$JWKS" > /tmp/jwks.txt
rm -f /tmp/jwt.pem
```

#### Step 7: Create systemd services

**Convex Backend** (uses `npx convex dev` — the only correct command):

```bash
NPX_PATH=$(which npx)
NPM_PATH=$(which npm)

sudo tee /etc/systemd/system/berry-claw-convex.service > /dev/null << EOF
[Unit]
Description=Berry Claw — Convex Backend (via npx convex dev)
After=network.target docker.service
Wants=docker.service

[Service]
Type=simple
User=$(whoami)
WorkingDirectory=/opt/berry-claw
EnvironmentFile=/opt/berry-claw/.env.local
Environment=NODE_ENV=production
Environment=PATH=/usr/local/bin:/usr/bin:/bin
ExecStart=${NPX_PATH} convex dev
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
```

**Next.js Web:**

```bash
sudo tee /etc/systemd/system/berry-claw-web.service > /dev/null << EOF
[Unit]
Description=Berry Claw — Next.js Web
After=network.target berry-claw-convex.service
Wants=berry-claw-convex.service

[Service]
Type=simple
User=$(whoami)
WorkingDirectory=/opt/berry-claw
EnvironmentFile=/opt/berry-claw/.env.local
Environment=NODE_ENV=production
Environment=PORT=3002
Environment=PATH=/usr/local/bin:/usr/bin:/bin
ExecStart=${NPM_PATH} run start
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
```

#### Step 8: Start Convex + set JWT keys

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now berry-claw-convex

# Wait for Convex backend via /instance_name health endpoint
echo "Waiting for Convex..."
until curl -sf http://127.0.0.1:3214/instance_name >/dev/null 2>&1; do
  sleep 2
  echo -n "."
done
echo " Ready!"

# Set JWT keys
cd /opt/berry-claw
npx convex env set JWT_PRIVATE_KEY -- "$(cat /tmp/jwt_private.txt)"
npx convex env set JWKS -- "$(cat /tmp/jwks.txt)"
rm -f /tmp/jwt_private.txt /tmp/jwks.txt
```

#### Step 9: Build Next.js & start web

```bash
cd /opt/berry-claw

# Wait for convex dev to generate types (it does this automatically)
echo "Waiting for convex/_generated/api.d.ts..."
until [ -f convex/_generated/api.d.ts ]; do sleep 2; echo -n "."; done
echo " Found!"

# Build Next.js (requires _generated/ types from convex dev)
npm run build

# Start web service
sudo systemctl enable --now berry-claw-web

# Verify
sleep 3
sudo systemctl status berry-claw-convex
sudo systemctl status berry-claw-web
curl http://localhost:3002
```

> **Important:** `npm run build` can only succeed after `convex/_generated/api.d.ts` exists. This file is created by `npx convex dev` when it pushes functions to the backend.

#### Step 10: Cloudflare Tunnel

```bash
# Option A: Token from CF Dashboard (recommended)
sudo cloudflared service install <TUNNEL_TOKEN>
sudo systemctl enable --now cloudflared

# Then go to CF Dashboard > Zero Trust > Tunnels
# Add Public Hostname: claw.example.com → http://localhost:3002
```

```bash
# Option B: CLI login
cloudflared tunnel login
cloudflared tunnel create berry-claw

# Create ~/.cloudflared/config.yml:
# tunnel: <UUID>
# credentials-file: ~/.cloudflared/<UUID>.json
# ingress:
#   - hostname: claw.example.com
#     service: http://localhost:3002
#   - service: http_status:404

cloudflared tunnel route dns berry-claw claw.example.com
sudo cloudflared service install
sudo systemctl enable --now cloudflared
```

#### Step 11: Firewall

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw enable
```

> UFW only opens SSH. All HTTP traffic goes through Cloudflare Tunnel (port 3002 is NOT exposed).

### After Deploy

1. Visit `https://claw.example.com`
2. **Register the first account** — the first user is automatically assigned **admin** role
3. Go to Dashboard > Deploy New to create your first OpenClaw instance
4. Enter your SoloBiz API Key + Telegram Bot Token when creating a claw

---

## Local Development

### Setup

```bash
# 1. Clone
git clone <REPO_URL>
cd berry-claw

# 2. Install
npm install

# 3. Create .env.local
cp .env.example .env.local  # or create manually (see Environment Variables)

# 4. Generate JWT keys
openssl genpkey -algorithm RSA -out /tmp/jwt.pem -pkeyopt rsa_keygen_bits:2048

JWKS=$(node -e "
const crypto = require('crypto');
const pem = require('fs').readFileSync('/tmp/jwt.pem', 'utf-8');
const key = crypto.createPublicKey(pem);
const jwk = key.export({ format: 'jwk' });
jwk.alg = 'RS256'; jwk.use = 'sig'; jwk.kid = crypto.randomUUID();
console.log(JSON.stringify({ keys: [jwk] }));
")

# 5. Start Convex dev (terminal 1)
npx convex dev

# 6. Set JWT keys (terminal 2, after convex dev is running)
npx convex env set JWT_PRIVATE_KEY -- "$(cat /tmp/jwt.pem)"
npx convex env set JWKS -- "$JWKS"
rm -f /tmp/jwt.pem

# 7. Start Next.js dev (terminal 2)
npm run dev
```

Dashboard runs at `http://localhost:3000` (dev) or `http://localhost:3002` (production).

### tmux Session (recommended)

```bash
tmux new-session -s berry-claw -n convex -d
tmux send-keys -t berry-claw:convex 'npx convex dev' Enter
tmux new-window -t berry-claw -n nextjs
tmux send-keys -t berry-claw:nextjs 'npm run dev' Enter
tmux attach -t berry-claw
```

---

## Project Structure

```
berry-claw/
├── convex/                        # Convex backend functions
│   ├── schema.ts                  # Database schema
│   ├── auth.ts                    # Auth setup (Password + JWT)
│   ├── auth.config.ts             # Auth provider config
│   ├── claws.ts                   # Claw CRUD + port allocation
│   ├── docker.ts                  # Docker container management
│   ├── configs.ts                 # Config file management
│   ├── configVersions.ts          # Config version history
│   ├── skills.ts                  # Skills/extensions
│   ├── logs.ts                    # Activity logs
│   ├── monitoring.ts              # Resource monitoring
│   ├── admin.ts                   # Admin operations
│   ├── users.ts                   # User profile
│   ├── quotas.ts                  # Usage quotas
│   ├── notifications.ts           # Notification channels
│   ├── apiKeys.ts                 # API key management
│   ├── proxy.ts                   # Caddy reverse proxy
│   ├── streaming.ts               # Log streaming
│   ├── crons.ts                   # Health check cron (30s)
│   └── http.ts                    # HTTP endpoints
│
├── src/app/
│   ├── layout.tsx                 # Root layout
│   ├── login/page.tsx             # Login/Register page
│   └── dashboard/
│       ├── layout.tsx             # Dashboard layout (sidebar)
│       ├── page.tsx               # Overview (claw list)
│       ├── settings/page.tsx      # User settings
│       ├── admin/                 # Admin panel
│       │   ├── page.tsx           # System stats
│       │   ├── users/page.tsx     # User management
│       │   └── claws/page.tsx     # All claws management
│       └── claw/
│           ├── new/page.tsx       # Deploy new claw
│           └── [clawId]/
│               ├── page.tsx       # Claw detail & actions
│               ├── config/        # Config editor (soul/memory/agents)
│               ├── logs/          # Container & activity logs
│               ├── skills/        # Skills management
│               ├── monitoring/    # CPU/RAM/Disk monitoring
│               ├── terminal/      # Web terminal (xterm.js)
│               └── domain/        # Domain/network settings
│
├── src/components/                # Reusable UI components
├── deploy.sh                      # VPS auto-deploy script
└── .env.local                     # Environment variables (not committed)
```

---

## Environment Variables

File: `.env.local` (not committed to git)

| Variable | Description | Default |
|---|---|---|
| `NEXT_PUBLIC_CONVEX_URL` | Convex API endpoint | `http://127.0.0.1:3214` |
| `NEXT_PUBLIC_CONVEX_SITE_URL` | Convex site endpoint | `http://127.0.0.1:3215` |
| `CONVEX_SITE_URL` | Convex site URL (server-side) | `http://127.0.0.1:3215` |
| `CONVEX_DEPLOYMENT` | Convex deployment identifier | `anonymous:anonymous-berry-claw` |
| `OPENCLAW_IMAGE` | Docker image for OpenClaw | `openclaw:local` |
| `OPENCLAW_DATA_DIR` | Data directory for claw instances | `/data/berry-claw/claws` |
| `CADDYFILE_PATH` | Path to Caddyfile (reverse proxy) | `/data/berry-claw/Caddyfile` |
| `PORT_RANGE_START` | Start port for claw instances | `20000` |
| `PORT_RANGE_END` | End port for claw instances | `29999` |

**Convex env vars** (set via `npx convex env set` while backend is running):

| Variable | Description |
|---|---|
| `JWT_PRIVATE_KEY` | RSA private key (PEM format) for auth |
| `JWKS` | JSON Web Key Set (public key) for auth |

---

## Services & Ports

| Service | Port | Description |
|---|---|---|
| Next.js | 3002 | Web dashboard |
| Convex API | 3214 | Backend API (managed by `npx convex dev`) |
| Convex Site | 3215 | Auth & HTTP actions |
| OpenClaw Gateway | 20000, 20002, 20004... | Claw API (each instance +2) |
| OpenClaw Bridge | 20001, 20003, 20005... | Claw bridge (each instance +2) |

Port allocation: each claw uses a consecutive pair (gateway=even, bridge=odd) in range 20000-29999. Max ~5000 claw instances.

---

## Operations & Maintenance

### View logs

```bash
# Convex backend
journalctl -u berry-claw-convex -f

# Next.js web
journalctl -u berry-claw-web -f

# Cloudflare Tunnel
journalctl -u cloudflared -f
```

### Restart services

```bash
sudo systemctl restart berry-claw-convex
sudo systemctl restart berry-claw-web
```

### Update code

```bash
cd /opt/berry-claw
git pull origin main
npm install

# Restart Convex — convex dev will re-push functions & regenerate types
sudo systemctl restart berry-claw-convex

# Wait for generated types to be ready, then rebuild Next.js
echo "Waiting for convex/_generated/api.d.ts..."
until [ -f convex/_generated/api.d.ts ]; do sleep 2; echo -n "."; done
echo " Ready!"

npm run build
sudo systemctl restart berry-claw-web
```

> **Important:** Restarting `berry-claw-convex` triggers `npx convex dev` which automatically pushes functions and generates types. Wait for `convex/_generated/api.d.ts` before building Next.js.

### Manage Docker containers

```bash
# List all claw containers
sudo docker ps --filter "name=berry-claw-"

# View logs for a specific container
sudo docker logs -f berry-claw-<container-name>

# Restart a container
sudo docker restart berry-claw-<container-name>
```

### Backup data

```bash
# Backup claw configs & data
tar -czf berry-claw-backup-$(date +%Y%m%d).tar.gz /data/berry-claw/

# Backup Convex DB (local mode stores in working directory)
tar -czf convex-data-$(date +%Y%m%d).tar.gz /opt/berry-claw/convex_local_storage/
```

---

## Troubleshooting

### "Permission denied" when running deploy.sh

```bash
# Ensure you're not running as root
whoami  # should be a regular user, not root

# Ensure sudo access
sudo -v
```

### "Could not find public function for 'admin:isAdmin'"

Convex functions haven't been pushed yet. Restart the Convex service:

```bash
sudo systemctl restart berry-claw-convex

# Check if it's running and functions are pushed:
journalctl -u berry-claw-convex -n 20 --no-pager
```

### Next.js build fail — "Cannot find module '@convex/_generated/api'"

The `convex/_generated/` directory doesn't exist yet. This is generated by `npx convex dev` when it pushes functions:

```bash
# Ensure Convex is running
sudo systemctl status berry-claw-convex

# Wait for generated types
until [ -f convex/_generated/api.d.ts ]; do sleep 2; echo -n "."; done

# Then build
npm run build
```

### Convex backend won't start

```bash
# Check logs
journalctl -u berry-claw-convex -n 50 --no-pager

# Check if ports are already in use
ss -tlnp | grep -E '3214|3215'

# Test the health endpoint directly
curl http://127.0.0.1:3214/instance_name
```

### Container crash loop — "models: Unrecognized key"

OpenClaw config has wrong format. Correct format:

```json
{
  "agents": {
    "defaults": {
      "model": {
        "primary": "solobiz/claude-sonnet-4.6"
      }
    }
  }
}
```

The model key uses `provider/model` format (slash, not colon).

### Bot not responding — "No API key found for provider"

Check that the SoloBiz API key was set when creating the claw. Go to Dashboard > Claw Detail to update the API key.

### Docker permission denied

If you just installed Docker, log out and back in:

```bash
# Or use newgrp (no logout needed)
newgrp docker
```

### First user doesn't have admin role

The first user to register is automatically assigned admin. If not:

```bash
cd /opt/berry-claw
npx convex dashboard
```
