# Berry Claw — VPS Deployment Guide

Deploy Berry Claw on a VPS with Cloudflare Tunnel for custom domain + HTTPS.

---

## Quick Start (Auto Deploy Script)

SSH vao VPS roi chay:

```bash
# 1. Clone repo
git clone git@github.com:nhqd99/berry-deploy.git /opt/berry-claw
cd /opt/berry-claw

# 2. Chay script auto deploy
chmod +x deploy.sh
./deploy.sh
```

Script se hoi:
- **Git repo URL**: `git@github.com:nhqd99/berry-deploy.git`
- **Domain**: domain cua ban (vd: `claw.example.com`)
- **Cloudflare Tunnel token**: lay tu Cloudflare Dashboard (hoac Enter de setup sau)
- **OpenClaw image**: chon 1 trong 3 option (pull/build/skip)

### Lay Cloudflare Tunnel Token

1. Dang nhap [Cloudflare Zero Trust Dashboard](https://one.dash.cloudflare.com)
2. Vao **Networks** > **Tunnels** > **Create a tunnel**
3. Chon **Cloudflared** connector
4. Copy token (chuoi dai bat dau `eyJ...`)
5. Sau khi script chay xong, quay lai Dashboard:
   - Tab **Public Hostname** > **Add a public hostname**
   - Subdomain: `claw` (hoac ten ban muon)
   - Domain: chon domain cua ban
   - Service Type: `HTTP`
   - URL: `localhost:3002`
   - Save

### Script lam gi?

| Buoc | Mo ta |
|------|-------|
| 1 | Cai Docker, Node.js 20, cloudflared |
| 2 | Clone repo & `npm install` |
| 3 | Pull/build OpenClaw Docker image |
| 4 | Tao `.env.local` + thu muc data |
| 5 | Generate JWT keys cho Convex Auth |
| 6 | `npm run build` Next.js |
| 7 | Tao 2 systemd services + start |
| 8 | Setup Cloudflare Tunnel + UFW firewall |

### Kiem tra sau khi deploy

```bash
# Kiem tra services
sudo systemctl status berry-claw-convex berry-claw-web cloudflared

# Xem logs
journalctl -u berry-claw-convex -f   # Convex backend
journalctl -u berry-claw-web -f      # Next.js
journalctl -u cloudflared -f         # Tunnel

# Test local
curl http://localhost:3002

# Test qua domain
curl https://claw.example.com
```

### Cap nhat Berry Claw

```bash
cd /opt/berry-claw
git pull origin main
npm install

# Restart Convex — convex dev will re-push functions & regenerate types
sudo systemctl restart berry-claw-convex

# Wait for generated types, then rebuild Next.js
until [ -f convex/_generated/api.d.ts ]; do sleep 2; echo -n "."; done
npm run build
sudo systemctl restart berry-claw-web
```

---

## Manual Deployment (Step-by-Step)

Neu muon deploy thu cong tung buoc, doc tiep ben duoi.

---

## Architecture Overview

```
Internet
  │
  ├── Cloudflare Tunnel (HTTPS) ──▶ Next.js (:3002)
  │                                    │
  │                                    ├── Convex Backend (local anonymous)
  │                                    │     ├── :3214 (HTTP API)
  │                                    │     └── :3215 (Site URL)
  │                                    │
  │                                    ├── API Routes
  │                                    │     ├── /api/logs/:containerId (SSE)
  │                                    │     └── /api/terminal/:containerId (SSE + POST)
  │                                    │
  │                                    └── Docker Engine
  │                                          └── OpenClaw containers (:20000-29999)
  │
  └── Cloudflare Tunnel (optional) ──▶ OpenClaw gateway ports (per-claw domains)
```

---

## Prerequisites

- **VPS**: Ubuntu 22.04+ (or Debian 12+), 2+ CPU cores, 4GB+ RAM
- **Domain**: Managed via Cloudflare DNS (free plan OK)
- **Cloudflare account**: For Tunnel (free tier)

---

## Step 1 — Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# Log out and back in for group change to take effect

# Install Node.js 20+ (via NodeSource)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify
docker --version   # Docker 24+
node --version     # v20+
npm --version      # 10+
```

---

## Step 2 — Clone & Install

```bash
cd /opt
sudo mkdir berry-claw && sudo chown $USER:$USER berry-claw
git clone <your-repo-url> berry-claw
cd berry-claw

npm install
```

---

## Step 3 — Build the OpenClaw Image

Berry Claw deploys OpenClaw containers via Docker. You need the image available locally:

```bash
# Option A: Pull from registry (if published)
docker pull ghcr.io/your-org/openclaw:latest
docker tag ghcr.io/your-org/openclaw:latest openclaw:local

# Option B: Build from source
git clone <openclaw-repo> /tmp/openclaw
cd /tmp/openclaw
docker build -t openclaw:local .
cd /opt/berry-claw
```

---

## Step 4 — Configure Environment

```bash
# Create data directory for claw volumes
sudo mkdir -p /data/berry-claw/claws
sudo chown $USER:$USER /data/berry-claw/claws

# Create .env.local (use sudo tee, not cat >)
sudo tee .env.local > /dev/null << 'EOF'
# Convex (local anonymous mode)
NEXT_PUBLIC_CONVEX_URL=http://127.0.0.1:3214
NEXT_PUBLIC_CONVEX_SITE_URL=http://127.0.0.1:3215
CONVEX_DEPLOYMENT=anonymous:anonymous-berry-claw

# Docker / OpenClaw
OPENCLAW_IMAGE=openclaw:local
OPENCLAW_DATA_DIR=/data/berry-claw/claws

# Port range for Claw instances (each claw uses 2 ports: gateway + bridge)
PORT_RANGE_START=20000
PORT_RANGE_END=29999
EOF
```

---

## Step 5 — Generate JWT Keys for Convex Auth

Convex Auth requires RSA keys for JWT signing. Generate them once:

```bash
# Generate RSA-256 private key (PEM)
openssl genpkey -algorithm RSA -out /tmp/convex_jwt.pem -pkeyopt rsa_keygen_bits:2048

# Extract private key as single-line for env var
JWT_PRIVATE_KEY=$(cat /tmp/convex_jwt.pem)

# Generate JWKS (JSON Web Key Set) from the private key
# Install jose-util if needed: npm install -g jose-cli
# Or use this Node.js one-liner:
JWKS=$(node -e "
const crypto = require('crypto');
const pem = require('fs').readFileSync('/tmp/convex_jwt.pem', 'utf-8');
const key = crypto.createPublicKey(pem);
const jwk = key.export({ format: 'jwk' });
jwk.alg = 'RS256';
jwk.use = 'sig';
jwk.kid = crypto.randomUUID();
console.log(JSON.stringify({ keys: [jwk] }));
")

# Save keys for later (need running Convex backend to set them)
cat /tmp/convex_jwt.pem > /tmp/jwt_private.txt
echo "$JWKS" > /tmp/jwks.txt

# Clean up
rm /tmp/convex_jwt.pem

# NOTE: JWT keys will be set AFTER starting the Convex service (Step 7)
```

---

## Step 6 — Build Next.js for Production

> **Important:** `npm run build` requires `convex/_generated/api.d.ts` which is generated by `npx convex dev`. You must start the Convex service (Step 7) first, then come back to build.

```bash
# Only run this AFTER Step 7 (Convex service started and types generated)
# Wait for generated types
until [ -f convex/_generated/api.d.ts ]; do sleep 2; echo -n "."; done

# Build the Next.js app
npm run build
```

---

## Step 7 — Create systemd Services

### 7a. Convex Backend

> **Important:** The correct command is `npx convex dev`. There is NO `convex backend` subcommand.

```bash
sudo tee /etc/systemd/system/berry-claw-convex.service << EOF
[Unit]
Description=Berry Claw — Convex Backend (via npx convex dev)
After=network.target docker.service
Wants=docker.service

[Service]
Type=simple
User=$USER
WorkingDirectory=/opt/berry-claw
EnvironmentFile=/opt/berry-claw/.env.local
Environment=NODE_ENV=production
ExecStart=/usr/bin/npx convex dev
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
```

### 7b. Next.js Frontend

```bash
sudo tee /etc/systemd/system/berry-claw-web.service << EOF
[Unit]
Description=Berry Claw — Next.js Web
After=network.target berry-claw-convex.service
Requires=berry-claw-convex.service

[Service]
Type=simple
User=$USER
WorkingDirectory=/opt/berry-claw
Environment=NODE_ENV=production
Environment=PORT=3002
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
```

### Start services

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

# Set JWT keys (from Step 5)
cd /opt/berry-claw
npx convex env set JWT_PRIVATE_KEY -- "$(cat /tmp/jwt_private.txt)"
npx convex env set JWKS -- "$(cat /tmp/jwks.txt)"
rm -f /tmp/jwt_private.txt /tmp/jwks.txt

# Wait for generated types
until [ -f convex/_generated/api.d.ts ]; do sleep 2; echo -n "."; done

# Now build Next.js (Step 6)
npm run build

# Start web service
sudo systemctl enable --now berry-claw-web

# Verify both are running
sudo systemctl status berry-claw-convex
sudo systemctl status berry-claw-web

# Check logs
journalctl -u berry-claw-convex -f
journalctl -u berry-claw-web -f
```

---

## Step 8 — Install Cloudflare Tunnel (cloudflared)

```bash
# Install cloudflared
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
echo "deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/cloudflared.list
sudo apt update && sudo apt install -y cloudflared

# Authenticate with Cloudflare
cloudflared tunnel login
# This opens a browser — select the domain you want to use
```

---

## Step 9 — Create Cloudflare Tunnel

```bash
# Create tunnel
cloudflared tunnel create berry-claw
# Note the tunnel UUID printed — e.g., a1b2c3d4-e5f6-...

# The credentials file is saved at:
# ~/.cloudflared/<TUNNEL_UUID>.json

# Create tunnel config
mkdir -p ~/.cloudflared

cat > ~/.cloudflared/config.yml << 'EOF'
tunnel: <TUNNEL_UUID>
credentials-file: /home/<YOUR_USER>/.cloudflared/<TUNNEL_UUID>.json

ingress:
  # Main Berry Claw dashboard
  - hostname: claw.yourdomain.com
    service: http://localhost:3002

  # Catch-all (required by cloudflared)
  - service: http_status:404
EOF
```

Replace:
- `<TUNNEL_UUID>` with the UUID from `cloudflared tunnel create`
- `<YOUR_USER>` with your Linux username
- `claw.yourdomain.com` with your actual subdomain

---

## Step 10 — Configure DNS in Cloudflare

```bash
# Create DNS CNAME record pointing to the tunnel
cloudflared tunnel route dns berry-claw claw.yourdomain.com
```

This creates a CNAME record: `claw.yourdomain.com` → `<TUNNEL_UUID>.cfargotunnel.com`

Cloudflare handles HTTPS termination automatically — no SSL cert needed on the VPS.

---

## Step 11 — Run Tunnel as systemd Service

```bash
# Install as a system service
sudo cloudflared service install

# Start the tunnel
sudo systemctl enable --now cloudflared

# Verify
sudo systemctl status cloudflared
cloudflared tunnel info berry-claw
```

---

## Step 12 — Verify Deployment

```bash
# 1. Check services are running
sudo systemctl status berry-claw-convex berry-claw-web cloudflared

# 2. Test locally
curl -s http://localhost:3002 | head -5

# 3. Test via Cloudflare Tunnel
curl -s https://claw.yourdomain.com | head -5

# 4. Open in browser
# https://claw.yourdomain.com
# Sign up → Deploy a new Claw → verify container starts
```

---

## Custom Domains for Individual Claws (Optional)

If you want each Claw instance to have its own domain (e.g., `alice.yourdomain.com` → OpenClaw gateway), add more ingress rules to the Cloudflare Tunnel config:

### Option A: Wildcard Subdomain (Recommended)

```yaml
# ~/.cloudflared/config.yml
ingress:
  # Main dashboard
  - hostname: claw.yourdomain.com
    service: http://localhost:3002

  # Wildcard: route *.claw.yourdomain.com to Caddy reverse proxy
  - hostname: "*.claw.yourdomain.com"
    service: http://localhost:8080

  - service: http_status:404
```

Then run a Caddy container as reverse proxy for claw subdomains:

```bash
# Create Caddy data directory
sudo mkdir -p /data/berry-claw/caddy

# Caddy container (auto-managed by Berry Claw's proxy.ts)
docker run -d \
  --name caddy-proxy \
  --restart unless-stopped \
  -p 8080:80 \
  -v /data/berry-claw/Caddyfile:/etc/caddy/Caddyfile:ro \
  -v /data/berry-claw/caddy:/data \
  caddy:2-alpine

# Create initial empty Caddyfile
echo "# Auto-generated by Berry Claw" > /data/berry-claw/Caddyfile
```

Set environment variables for the proxy module:

```bash
npx convex env set CADDY_CONTAINER caddy-proxy
npx convex env set CADDYFILE_PATH /data/berry-claw/Caddyfile
npx convex env set SERVER_IP 127.0.0.1
```

Now when you set a custom domain in Berry Claw's UI, it writes a Caddyfile entry and reloads Caddy automatically.

In Cloudflare DNS, add a wildcard CNAME:
```
*.claw.yourdomain.com → <TUNNEL_UUID>.cfargotunnel.com (proxied)
```

### Option B: Individual Tunnel Ingress Rules

For non-wildcard setups, manually add each domain to `~/.cloudflared/config.yml`:

```yaml
ingress:
  - hostname: claw.yourdomain.com
    service: http://localhost:3002
  - hostname: alice-claw.yourdomain.com
    service: http://localhost:20000
  - hostname: bob-claw.yourdomain.com
    service: http://localhost:20002
  - service: http_status:404
```

Then restart the tunnel: `sudo systemctl restart cloudflared`

---

## Firewall Configuration

The VPS only needs to expose SSH. All HTTP traffic goes through Cloudflare Tunnel:

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw enable

# DO NOT open ports 3002, 3214, 3215, or 20000-29999
# Cloudflare Tunnel handles all inbound traffic
```

---

## Updating Berry Claw

```bash
cd /opt/berry-claw
git pull origin main
npm install

# Restart Convex — convex dev will re-push functions & regenerate types
sudo systemctl restart berry-claw-convex

# Wait for generated types, then rebuild Next.js
until [ -f convex/_generated/api.d.ts ]; do sleep 2; echo -n "."; done
npm run build

# Restart web service
sudo systemctl restart berry-claw-web
```

---

## Troubleshooting

### Services won't start

```bash
# Check logs
journalctl -u berry-claw-convex -n 50 --no-pager
journalctl -u berry-claw-web -n 50 --no-pager
journalctl -u cloudflared -n 50 --no-pager
```

### Convex Auth fails ("Invalid token")

JWT keys are missing or invalid:
```bash
npx convex env list
# Must show JWT_PRIVATE_KEY and JWKS
# Re-run Step 5 if missing
```

### Docker permission denied

```bash
# Ensure user is in docker group
groups $USER  # should show "docker"
# If not:
sudo usermod -aG docker $USER
# Then log out and back in
```

### Claw containers not starting

```bash
# Check the OpenClaw image exists
docker images | grep openclaw

# Check Docker socket is accessible
docker ps

# Check data directory permissions
ls -la /data/berry-claw/claws/
```

### Cloudflare Tunnel not connecting

```bash
# Check tunnel status
cloudflared tunnel list
cloudflared tunnel info berry-claw

# Check credentials file exists
ls ~/.cloudflared/*.json

# Test config
cloudflared tunnel --config ~/.cloudflared/config.yml run berry-claw
```

### Port conflicts

Berry Claw allocates ports from 20000-29999 in pairs. If a port is busy:
```bash
# Check what's using a port
sudo lsof -i :20000
# Or check all allocated ports
sudo ss -tlnp | grep '2[0-9]\{4\}'
```

---

## Production Checklist

- [ ] UFW firewall enabled (only SSH open)
- [ ] systemd services enabled and running
- [ ] Cloudflare Tunnel active and DNS configured
- [ ] JWT keys set in Convex environment
- [ ] OpenClaw Docker image available locally
- [ ] `/data/berry-claw/claws` writable by service user
- [ ] Test sign-up + deploy a Claw end-to-end
- [ ] Set up log rotation: `journalctl --vacuum-time=30d`
