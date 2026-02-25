#!/usr/bin/env bash
#
# Berry Claw — Production Deploy Script for Ubuntu/Debian VPS
#
# Usage:
#   chmod +x deploy.sh && ./deploy.sh
#
# What this does (6 steps):
#   1. Install Docker, Node.js 20, cloudflared
#   2. Clone Berry Claw & install dependencies + OpenClaw image
#   3. Configure environment (.env.local) & generate JWT keys
#   4. Start Convex via systemd (npx convex dev) & set JWT keys
#   5. Build Next.js & start web service
#   6. Configure Cloudflare Tunnel & firewall
#
# IMPORTANT: Convex self-hosted works via `npx convex dev` which manages
# the local backend binary internally. There is NO `convex backend` command
# and `convex deploy` rejects anonymous deployments.
#
set -euo pipefail

# ─── Colors ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

log()    { echo -e "${GREEN}[+]${NC} $*"; }
warn()   { echo -e "${YELLOW}[!]${NC} $*"; }
err()    { echo -e "${RED}[x]${NC} $*" >&2; }
info()   { echo -e "${CYAN}[i]${NC} $*"; }
header() { echo -e "\n${BOLD}═══ $* ═══${NC}\n"; }

die() { err "$*"; exit 1; }

# ─── Pre-flight checks ───────────────────────────────────────────────────────
[[ $EUID -eq 0 ]] && die "Do not run as root. Run as a regular user with sudo access."
command -v sudo &>/dev/null || die "sudo is required but not installed."

if [[ -f /etc/os-release ]]; then
  . /etc/os-release
  OS_ID="${ID:-unknown}"
else
  die "Unsupported OS. Requires Ubuntu 22.04+ or Debian 12+."
fi

if [[ "$OS_ID" != "ubuntu" && "$OS_ID" != "debian" ]]; then
  warn "Detected OS: $OS_ID. Tested on Ubuntu/Debian only. Proceeding..."
fi

# ─── Config ───────────────────────────────────────────────────────────────────
INSTALL_DIR="/opt/berry-claw"
DATA_DIR="/data/berry-claw"
CLAW_DATA_DIR="${DATA_DIR}/claws"
SERVICE_USER="$(whoami)"
CONVEX_PORT=3214
CONVEX_SITE_PORT=3215
WEB_PORT=3002

# ─── Interactive prompts ──────────────────────────────────────────────────────
header "Berry Claw — Production Deploy"

echo -e "${BOLD}This script will:${NC}"
echo "  1. Install Docker, Node.js 20, cloudflared"
echo "  2. Clone Berry Claw & prepare OpenClaw image"
echo "  3. Configure environment & generate JWT keys"
echo "  4. Start Convex backend (via npx convex dev)"
echo "  5. Build & start Next.js dashboard"
echo "  6. Configure Cloudflare Tunnel & firewall"
echo ""

read -rp "$(echo -e "${CYAN}Git repo URL${NC} (HTTPS): ")" GIT_REPO_URL
[[ -z "$GIT_REPO_URL" ]] && die "Git repo URL is required."

read -rp "$(echo -e "${CYAN}Domain for Berry Claw dashboard${NC} (e.g. claw.example.com): ")" DOMAIN
[[ -z "$DOMAIN" ]] && die "Domain is required."

echo ""
echo -e "${YELLOW}Cloudflare Tunnel Setup:${NC}"
echo "  Provide a tunnel token from Cloudflare Dashboard"
echo "  (Zero Trust > Networks > Tunnels > Create > copy token)"
echo "  Or press Enter to configure manually later."
echo ""
read -rp "$(echo -e "${CYAN}Cloudflare Tunnel token${NC} (or Enter to skip): ")" CF_TUNNEL_TOKEN

echo ""
echo -e "${YELLOW}OpenClaw Docker Image:${NC}"
echo "  1) Pull from registry (enter full image name)"
echo "  2) Build from Git repo"
echo "  3) Already available locally as openclaw:local (skip)"
echo ""
read -rp "$(echo -e "${CYAN}OpenClaw image source${NC} [1/2/3] (default: 3): ")" OPENCLAW_CHOICE
OPENCLAW_CHOICE="${OPENCLAW_CHOICE:-3}"

OPENCLAW_IMAGE_NAME="openclaw:local"
OPENCLAW_PULL_IMAGE=""
OPENCLAW_BUILD_REPO=""

case "$OPENCLAW_CHOICE" in
  1)
    read -rp "$(echo -e "${CYAN}Image name${NC}: ")" OPENCLAW_PULL_IMAGE
    [[ -z "$OPENCLAW_PULL_IMAGE" ]] && die "Image name required for option 1."
    ;;
  2)
    read -rp "$(echo -e "${CYAN}OpenClaw git repo URL${NC}: ")" OPENCLAW_BUILD_REPO
    [[ -z "$OPENCLAW_BUILD_REPO" ]] && die "Git repo URL required for option 2."
    ;;
  3)
    info "Will assume openclaw:local is already available."
    ;;
  *)
    die "Invalid choice: $OPENCLAW_CHOICE"
    ;;
esac

echo ""
read -rp "$(echo -e "${BOLD}Proceed with deployment? [y/N]${NC} ")" CONFIRM
[[ "${CONFIRM,,}" != "y" ]] && { echo "Aborted."; exit 0; }

# ─── Helper: wait for Convex backend via /instance_name ───────────────────────
wait_for_convex() {
  local url="http://127.0.0.1:${CONVEX_PORT}/instance_name"
  local max_wait=120
  local elapsed=0

  info "Waiting for Convex backend at ${url} (max ${max_wait}s)..."
  while ! curl -sf "$url" >/dev/null 2>&1; do
    sleep 2
    elapsed=$((elapsed + 2))
    if [[ $elapsed -ge $max_wait ]]; then
      err "Convex backend did not respond after ${max_wait}s."
      err "Check logs: sudo journalctl -u berry-claw-convex -n 30 --no-pager"
      exit 1
    fi
    echo -n "."
  done
  echo ""
  log "Convex backend is ready (responded in ~${elapsed}s)."
}

# ─── Helper: wait for _generated/api.d.ts ─────────────────────────────────────
wait_for_generated() {
  local target="${INSTALL_DIR}/convex/_generated/api.d.ts"
  local max_wait=60
  local elapsed=0

  info "Waiting for ${target} (max ${max_wait}s)..."
  while [[ ! -f "$target" ]]; do
    sleep 2
    elapsed=$((elapsed + 2))
    if [[ $elapsed -ge $max_wait ]]; then
      err "convex/_generated/api.d.ts was not created after ${max_wait}s."
      err "The Convex dev process may have failed to push functions."
      err "Check logs: sudo journalctl -u berry-claw-convex -n 30 --no-pager"
      exit 1
    fi
    echo -n "."
  done
  echo ""
  log "convex/_generated/api.d.ts exists."
}

# ═══════════════════════════════════════════════════════════════════════════════
# Step 1/6 — System Dependencies
# ═══════════════════════════════════════════════════════════════════════════════
header "Step 1/6 — Installing system dependencies"

sudo apt update
sudo apt install -y curl git openssl ufw lsb-release ca-certificates gnupg

# Docker
if ! command -v docker &>/dev/null; then
  log "Installing Docker..."
  curl -fsSL https://get.docker.com | sh
  sudo usermod -aG docker "$SERVICE_USER"
  warn "Docker installed. You may need to log out/in for group changes."
else
  log "Docker already installed: $(docker --version)"
fi

# Node.js 20
if ! command -v node &>/dev/null || [[ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]]; then
  log "Installing Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt install -y nodejs
else
  log "Node.js already installed: $(node --version)"
fi

# cloudflared
if ! command -v cloudflared &>/dev/null; then
  log "Installing cloudflared..."
  sudo mkdir -p --mode=0755 /usr/share/keyrings
  curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
  echo "deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared $(lsb_release -cs) main" \
    | sudo tee /etc/apt/sources.list.d/cloudflared.list
  sudo apt update && sudo apt install -y cloudflared
else
  log "cloudflared already installed: $(cloudflared --version)"
fi

# ═══════════════════════════════════════════════════════════════════════════════
# Step 2/6 — Clone & Install + OpenClaw Image
# ═══════════════════════════════════════════════════════════════════════════════
header "Step 2/6 — Cloning Berry Claw & preparing OpenClaw"

if [[ -d "$INSTALL_DIR" ]]; then
  warn "$INSTALL_DIR already exists. Pulling latest..."
  cd "$INSTALL_DIR"
  git pull origin main || true
else
  sudo mkdir -p "$INSTALL_DIR"
  sudo chown "$SERVICE_USER":"$SERVICE_USER" "$INSTALL_DIR"
  git clone "$GIT_REPO_URL" "$INSTALL_DIR"
  cd "$INSTALL_DIR"
fi

log "Installing npm dependencies..."
npm install

# OpenClaw Docker image
case "$OPENCLAW_CHOICE" in
  1)
    log "Pulling image: $OPENCLAW_PULL_IMAGE"
    sudo docker pull "$OPENCLAW_PULL_IMAGE"
    sudo docker tag "$OPENCLAW_PULL_IMAGE" "$OPENCLAW_IMAGE_NAME"
    log "Tagged as $OPENCLAW_IMAGE_NAME"
    ;;
  2)
    log "Building OpenClaw from $OPENCLAW_BUILD_REPO"
    TMPDIR=$(mktemp -d)
    git clone "$OPENCLAW_BUILD_REPO" "$TMPDIR/openclaw"
    sudo docker build -t "$OPENCLAW_IMAGE_NAME" "$TMPDIR/openclaw"
    rm -rf "$TMPDIR"
    log "Built and tagged as $OPENCLAW_IMAGE_NAME"
    ;;
  3)
    if sudo docker image inspect "$OPENCLAW_IMAGE_NAME" &>/dev/null; then
      log "Image $OPENCLAW_IMAGE_NAME found locally."
    else
      warn "Image $OPENCLAW_IMAGE_NAME NOT found. Build or pull it before deploying claws."
    fi
    ;;
esac

# ═══════════════════════════════════════════════════════════════════════════════
# Step 3/6 — Environment & JWT Keys
# ═══════════════════════════════════════════════════════════════════════════════
header "Step 3/6 — Configuring environment & JWT keys"

sudo mkdir -p "$CLAW_DATA_DIR"
sudo chown -R "$SERVICE_USER":"$SERVICE_USER" "$DATA_DIR"

# Write .env.local via sudo tee (never cat >)
sudo tee "$INSTALL_DIR/.env.local" > /dev/null << EOF
# Convex (local anonymous mode — managed by npx convex dev)
NEXT_PUBLIC_CONVEX_URL=http://127.0.0.1:${CONVEX_PORT}
NEXT_PUBLIC_CONVEX_SITE_URL=http://127.0.0.1:${CONVEX_SITE_PORT}
CONVEX_SITE_URL=http://127.0.0.1:${CONVEX_SITE_PORT}
CONVEX_DEPLOYMENT=anonymous:anonymous-berry-claw

# Docker / OpenClaw
OPENCLAW_IMAGE=${OPENCLAW_IMAGE_NAME}
OPENCLAW_DATA_DIR=${CLAW_DATA_DIR}
CADDYFILE_PATH=${DATA_DIR}/Caddyfile

# Port range for Claw instances
PORT_RANGE_START=20000
PORT_RANGE_END=29999
EOF
sudo chown "$SERVICE_USER":"$SERVICE_USER" "$INSTALL_DIR/.env.local"
log "Created $INSTALL_DIR/.env.local"

# Generate RSA 2048 JWT key pair
log "Generating JWT keys for Convex Auth..."
JWT_PEM=$(mktemp)
openssl genpkey -algorithm RSA -out "$JWT_PEM" -pkeyopt rsa_keygen_bits:2048 2>/dev/null

JWT_PRIVATE_KEY=$(cat "$JWT_PEM")

JWKS=$(node -e "
const crypto = require('crypto');
const pem = require('fs').readFileSync('$JWT_PEM', 'utf-8');
const key = crypto.createPublicKey(pem);
const jwk = key.export({ format: 'jwk' });
jwk.alg = 'RS256';
jwk.use = 'sig';
jwk.kid = crypto.randomUUID();
console.log(JSON.stringify({ keys: [jwk] }));
")

rm -f "$JWT_PEM"

# Save keys to temp files — we need a running Convex backend to set them
JWT_PRIVATE_KEY_FILE=$(mktemp)
JWKS_FILE=$(mktemp)
echo "$JWT_PRIVATE_KEY" > "$JWT_PRIVATE_KEY_FILE"
echo "$JWKS" > "$JWKS_FILE"

log "JWT keys generated (will set after Convex starts)."

# ═══════════════════════════════════════════════════════════════════════════════
# Step 4/6 — Start Convex Backend & Set JWT Keys
# ═══════════════════════════════════════════════════════════════════════════════
header "Step 4/6 — Starting Convex backend & setting JWT keys"

NPX_PATH=$(which npx)
NPM_PATH=$(which npm)
NODE_PATH=$(which node)

# ─── IMPORTANT ────────────────────────────────────────────────────────────────
# `npx convex dev` is the ONLY correct way to run a self-hosted Convex backend.
# It downloads the convex-local-backend binary, spawns it, pushes functions,
# generates convex/_generated/ files, and watches for changes.
#
# There is NO `convex backend` subcommand.
# `convex deploy` REJECTS anonymous (self-hosted) deployments.
# ──────────────────────────────────────────────────────────────────────────────

# Stop existing services if re-running
sudo systemctl stop berry-claw-web 2>/dev/null || true
sudo systemctl stop berry-claw-convex 2>/dev/null || true

# Convex service — runs `npx convex dev` which manages the backend binary
sudo tee /etc/systemd/system/berry-claw-convex.service > /dev/null << EOF
[Unit]
Description=Berry Claw — Convex Backend (via npx convex dev)
After=network.target docker.service
Wants=docker.service

[Service]
Type=simple
User=${SERVICE_USER}
WorkingDirectory=${INSTALL_DIR}
EnvironmentFile=${INSTALL_DIR}/.env.local
Environment=NODE_ENV=production
Environment=PATH=${NODE_PATH%/*}:/usr/local/bin:/usr/bin:/bin
ExecStart=${NPX_PATH} convex dev
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# Next.js web service
sudo tee /etc/systemd/system/berry-claw-web.service > /dev/null << EOF
[Unit]
Description=Berry Claw — Next.js Web
After=network.target berry-claw-convex.service
Wants=berry-claw-convex.service

[Service]
Type=simple
User=${SERVICE_USER}
WorkingDirectory=${INSTALL_DIR}
EnvironmentFile=${INSTALL_DIR}/.env.local
Environment=NODE_ENV=production
Environment=PORT=${WEB_PORT}
Environment=PATH=${NODE_PATH%/*}:/usr/local/bin:/usr/bin:/bin
ExecStart=${NPM_PATH} run start
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload

# Start Convex backend
log "Starting Convex backend (npx convex dev)..."
sudo systemctl enable --now berry-claw-convex

# Wait for backend to respond on /instance_name endpoint
wait_for_convex

# Set JWT keys now that backend is running
log "Setting JWT keys in Convex..."
cd "$INSTALL_DIR"

npx convex env set JWT_PRIVATE_KEY -- "$(cat "$JWT_PRIVATE_KEY_FILE")" || {
  err "Failed to set JWT_PRIVATE_KEY."
  err "Check: sudo journalctl -u berry-claw-convex -n 30 --no-pager"
  exit 1
}

npx convex env set JWKS -- "$(cat "$JWKS_FILE")" || {
  err "Failed to set JWKS."
  err "Check: sudo journalctl -u berry-claw-convex -n 30 --no-pager"
  exit 1
}

rm -f "$JWT_PRIVATE_KEY_FILE" "$JWKS_FILE"
log "JWT keys set successfully."

# Wait for convex dev to generate _generated/ files (it does this automatically)
wait_for_generated

# ═══════════════════════════════════════════════════════════════════════════════
# Step 5/6 — Build & Start Next.js
# ═══════════════════════════════════════════════════════════════════════════════
header "Step 5/6 — Building & starting Next.js"

# Double-check _generated exists before building
if [[ ! -f "${INSTALL_DIR}/convex/_generated/api.d.ts" ]]; then
  die "convex/_generated/api.d.ts not found. Cannot build Next.js without generated Convex types."
fi

log "Building Next.js app..."
cd "$INSTALL_DIR"
npm run build || die "Next.js build failed. Check output above."

log "Starting Next.js web server..."
sudo systemctl enable --now berry-claw-web

# Verify both services
sleep 3

if systemctl is-active --quiet berry-claw-convex; then
  log "berry-claw-convex: ${GREEN}running${NC}"
else
  err "berry-claw-convex: ${RED}failed${NC}"
  sudo journalctl -u berry-claw-convex -n 10 --no-pager
fi

if systemctl is-active --quiet berry-claw-web; then
  log "berry-claw-web: ${GREEN}running${NC}"
else
  err "berry-claw-web: ${RED}failed${NC}"
  sudo journalctl -u berry-claw-web -n 10 --no-pager
fi

# Verify web server responds
info "Checking web server at http://localhost:${WEB_PORT}..."
if curl -sf "http://localhost:${WEB_PORT}" >/dev/null 2>&1; then
  log "Web server is responding."
else
  warn "Web server not responding yet. It may need a few more seconds to start."
  warn "Check: sudo journalctl -u berry-claw-web -n 20 --no-pager"
fi

# ═══════════════════════════════════════════════════════════════════════════════
# Step 6/6 — Cloudflare Tunnel & Firewall
# ═══════════════════════════════════════════════════════════════════════════════
header "Step 6/6 — Cloudflare Tunnel & Firewall"

if [[ -n "$CF_TUNNEL_TOKEN" ]]; then
  log "Installing Cloudflare Tunnel as service..."

  sudo systemctl stop cloudflared 2>/dev/null || true
  sudo cloudflared service install "$CF_TUNNEL_TOKEN" 2>/dev/null || true
  sudo systemctl enable --now cloudflared

  if systemctl is-active --quiet cloudflared; then
    log "cloudflared: ${GREEN}running${NC}"
  else
    warn "cloudflared may need a moment to connect."
    warn "Check: sudo systemctl status cloudflared"
  fi

  echo ""
  info "Next steps for Cloudflare Tunnel:"
  echo "  1. Go to Cloudflare Dashboard > Zero Trust > Networks > Tunnels"
  echo "  2. Find your tunnel and add a Public Hostname:"
  echo "     - Subdomain: $(echo "$DOMAIN" | cut -d. -f1)"
  echo "     - Domain: $(echo "$DOMAIN" | cut -d. -f2-)"
  echo "     - Service: http://localhost:${WEB_PORT}"
  echo ""
else
  warn "No Cloudflare Tunnel token provided."
  echo ""
  info "To set up Cloudflare Tunnel manually:"
  echo ""
  echo "  Option A: Token from Dashboard (recommended)"
  echo "    1. Go to Cloudflare Dashboard > Zero Trust > Networks > Tunnels"
  echo "    2. Create a tunnel > choose Cloudflared connector"
  echo "    3. Copy the install command token"
  echo "    4. Run: sudo cloudflared service install <TOKEN>"
  echo "    5. Add Public Hostname: ${DOMAIN} -> http://localhost:${WEB_PORT}"
  echo ""
  echo "  Option B: CLI login"
  echo "    1. cloudflared tunnel login"
  echo "    2. cloudflared tunnel create berry-claw"
  echo "    3. Create ~/.cloudflared/config.yml:"
  echo "       tunnel: <UUID>"
  echo "       credentials-file: ~/.cloudflared/<UUID>.json"
  echo "       ingress:"
  echo "         - hostname: ${DOMAIN}"
  echo "           service: http://localhost:${WEB_PORT}"
  echo "         - service: http_status:404"
  echo "    4. cloudflared tunnel route dns berry-claw ${DOMAIN}"
  echo "    5. sudo cloudflared service install"
  echo "    6. sudo systemctl enable --now cloudflared"
  echo ""
fi

# Firewall
log "Configuring UFW..."
sudo ufw default deny incoming 2>/dev/null || true
sudo ufw default allow outgoing 2>/dev/null || true
sudo ufw allow ssh 2>/dev/null || true
echo "y" | sudo ufw enable 2>/dev/null || true
log "UFW enabled — only SSH is open. All HTTP traffic goes via Cloudflare Tunnel."

# ═══════════════════════════════════════════════════════════════════════════════
# Done
# ═══════════════════════════════════════════════════════════════════════════════
header "Deployment Complete!"

echo -e "${GREEN}Berry Claw has been deployed successfully.${NC}"
echo ""
echo "  Services:"
echo "    Convex:     sudo systemctl status berry-claw-convex"
echo "    Next.js:    sudo systemctl status berry-claw-web"
echo "    Tunnel:     sudo systemctl status cloudflared"
echo ""
echo "  Logs:"
echo "    journalctl -u berry-claw-convex -f"
echo "    journalctl -u berry-claw-web -f"
echo "    journalctl -u cloudflared -f"
echo ""
echo "  Local test:   curl http://localhost:${WEB_PORT}"
if [[ -n "$CF_TUNNEL_TOKEN" ]]; then
  echo "  Public URL:   https://${DOMAIN}"
else
  echo "  Public URL:   https://${DOMAIN} (after tunnel setup)"
fi
echo ""
echo "  Update:"
echo "    cd ${INSTALL_DIR} && git pull && npm install"
echo "    sudo systemctl restart berry-claw-convex"
echo "    # Wait for convex dev to push functions & regenerate types"
echo "    sleep 30 && npm run build"
echo "    sudo systemctl restart berry-claw-web"
echo ""
echo -e "${YELLOW}Remember:${NC} If this is a fresh Docker install, log out and back in"
echo "for docker group permissions to take effect."
echo ""
