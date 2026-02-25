#!/usr/bin/env bash
#
# Berry Claw — Auto Deploy Script for Ubuntu/Debian VPS
#
# Usage:
#   curl -fsSL <raw-url>/deploy.sh | bash
#   or:
#   chmod +x deploy.sh && ./deploy.sh
#
# Interactive prompts:
#   - Git repo URL (or local path)
#   - Domain name for Cloudflare Tunnel
#   - Cloudflare Tunnel token (from dashboard)
#   - OpenClaw Docker image source
#
set -euo pipefail

# ─── Colors ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

log()   { echo -e "${GREEN}[+]${NC} $*"; }
warn()  { echo -e "${YELLOW}[!]${NC} $*"; }
err()   { echo -e "${RED}[x]${NC} $*" >&2; }
info()  { echo -e "${CYAN}[i]${NC} $*"; }
header(){ echo -e "\n${BOLD}═══ $* ═══${NC}\n"; }

# ─── Pre-flight checks ───────────────────────────────────────────────────────
if [[ $EUID -eq 0 ]]; then
  err "Do not run this script as root. Run as a regular user with sudo access."
  exit 1
fi

if ! command -v sudo &>/dev/null; then
  err "sudo is required but not installed."
  exit 1
fi

# Detect OS
if [[ -f /etc/os-release ]]; then
  . /etc/os-release
  OS_ID="${ID:-unknown}"
  OS_VERSION="${VERSION_ID:-0}"
else
  err "Unsupported OS. This script requires Ubuntu 22.04+ or Debian 12+."
  exit 1
fi

if [[ "$OS_ID" != "ubuntu" && "$OS_ID" != "debian" ]]; then
  warn "Detected OS: $OS_ID. This script is tested on Ubuntu/Debian. Proceeding anyway..."
fi

# ─── Config ───────────────────────────────────────────────────────────────────
INSTALL_DIR="/opt/berry-claw"
DATA_DIR="/data/berry-claw"
CLAW_DATA_DIR="${DATA_DIR}/claws"
SERVICE_USER="$(whoami)"

header "Berry Claw — Auto Deploy"

echo -e "${BOLD}This script will:${NC}"
echo "  1. Install Docker, Node.js 20, cloudflared"
echo "  2. Clone Berry Claw & install dependencies"
echo "  3. Prepare OpenClaw Docker image"
echo "  4. Configure environment & generate JWT keys"
echo "  5. Create systemd services & start Convex backend"
echo "  6. Deploy Convex functions & build Next.js"
echo "  7. Configure Cloudflare Tunnel & firewall"
echo ""

# ─── Interactive prompts ──────────────────────────────────────────────────────

read -rp "$(echo -e "${CYAN}Git repo URL${NC} (HTTPS): ")" GIT_REPO_URL
if [[ -z "$GIT_REPO_URL" ]]; then
  err "Git repo URL is required."
  exit 1
fi

read -rp "$(echo -e "${CYAN}Domain for Berry Claw dashboard${NC} (e.g. claw.example.com): ")" DOMAIN
if [[ -z "$DOMAIN" ]]; then
  err "Domain is required."
  exit 1
fi

echo ""
echo -e "${YELLOW}Cloudflare Tunnel Setup:${NC}"
echo "  Option 1: Provide a tunnel token from Cloudflare Dashboard"
echo "            (Zero Trust > Networks > Tunnels > Create > copy token)"
echo "  Option 2: Leave empty to configure manually after deploy"
echo ""
read -rp "$(echo -e "${CYAN}Cloudflare Tunnel token${NC} (or Enter to skip): ")" CF_TUNNEL_TOKEN

echo ""
echo -e "${YELLOW}OpenClaw Docker Image:${NC}"
echo "  1) Pull from registry (enter full image name, e.g. ghcr.io/org/openclaw:latest)"
echo "  2) Build from Git repo (enter git URL)"
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
    if [[ -z "$OPENCLAW_PULL_IMAGE" ]]; then
      err "Image name required for option 1."
      exit 1
    fi
    ;;
  2)
    read -rp "$(echo -e "${CYAN}OpenClaw git repo URL${NC}: ")" OPENCLAW_BUILD_REPO
    if [[ -z "$OPENCLAW_BUILD_REPO" ]]; then
      err "Git repo URL required for option 2."
      exit 1
    fi
    ;;
  3)
    info "Will assume openclaw:local is already available."
    ;;
  *)
    err "Invalid choice."
    exit 1
    ;;
esac

echo ""
read -rp "$(echo -e "${BOLD}Proceed with deployment? [y/N]${NC} ")" CONFIRM
if [[ "${CONFIRM,,}" != "y" ]]; then
  echo "Aborted."
  exit 0
fi

# ─── Step 1: System packages ─────────────────────────────────────────────────
header "Step 1/7 — Installing system dependencies"

sudo apt update
sudo apt install -y curl git openssl ufw lsb-release ca-certificates gnupg

# Docker
if ! command -v docker &>/dev/null; then
  log "Installing Docker..."
  curl -fsSL https://get.docker.com | sh
  sudo usermod -aG docker "$SERVICE_USER"
  log "Docker installed. NOTE: You may need to log out/in for group changes."
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
  echo "deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/cloudflared.list
  sudo apt update && sudo apt install -y cloudflared
else
  log "cloudflared already installed: $(cloudflared --version)"
fi

# ─── Step 2: Clone & Install ─────────────────────────────────────────────────
header "Step 2/7 — Cloning Berry Claw"

if [[ -d "$INSTALL_DIR" ]]; then
  warn "$INSTALL_DIR already exists. Pulling latest changes..."
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

# ─── Step 3: OpenClaw Docker Image ───────────────────────────────────────────
header "Step 3/7 — Preparing OpenClaw Docker image"

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
      warn "Image $OPENCLAW_IMAGE_NAME NOT found. You must build or pull it before deploying claws."
    fi
    ;;
esac

# ─── Step 4: Data directories, .env.local & JWT keys ─────────────────────────
header "Step 4/7 — Configuring environment & JWT keys"

sudo mkdir -p "$CLAW_DATA_DIR"
sudo chown -R "$SERVICE_USER":"$SERVICE_USER" "$DATA_DIR"

sudo tee "$INSTALL_DIR/.env.local" > /dev/null << EOF
# Convex (local anonymous mode)
NEXT_PUBLIC_CONVEX_URL=http://127.0.0.1:3214
NEXT_PUBLIC_CONVEX_SITE_URL=http://127.0.0.1:3215
CONVEX_SITE_URL=http://127.0.0.1:3215
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

# We need Convex backend running to set env vars, so save them for later
JWT_PRIVATE_KEY_FILE=$(mktemp)
JWKS_FILE=$(mktemp)
echo "$JWT_PRIVATE_KEY" > "$JWT_PRIVATE_KEY_FILE"
echo "$JWKS" > "$JWKS_FILE"

log "JWT keys generated (will be set after Convex starts)"

# ─── Step 5: systemd services & start Convex ─────────────────────────────────
header "Step 5/7 — Creating systemd services & starting Convex"

NPX_PATH=$(which npx)
NPM_PATH=$(which npm)
NODE_PATH=$(which node)

# Convex backend service
sudo tee /etc/systemd/system/berry-claw-convex.service > /dev/null << EOF
[Unit]
Description=Berry Claw — Convex Backend
After=network.target docker.service
Requires=docker.service

[Service]
Type=simple
User=${SERVICE_USER}
WorkingDirectory=${INSTALL_DIR}
EnvironmentFile=${INSTALL_DIR}/.env.local
Environment=NODE_ENV=production
Environment=PATH=/usr/local/bin:/usr/bin:/bin
ExecStart=${NPX_PATH} convex backend --port 3214 --site-port 3215
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
Requires=berry-claw-convex.service

[Service]
Type=simple
User=${SERVICE_USER}
WorkingDirectory=${INSTALL_DIR}
EnvironmentFile=${INSTALL_DIR}/.env.local
Environment=NODE_ENV=production
Environment=PORT=3002
Environment=PATH=/usr/local/bin:/usr/bin:/bin
ExecStart=${NPM_PATH} run start
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload

# Start Convex first, wait for it, then set JWT keys
log "Starting Convex backend..."
sudo systemctl enable --now berry-claw-convex

info "Waiting for Convex backend to be ready..."
RETRIES=0
MAX_RETRIES=30
until curl -sf http://127.0.0.1:3214 >/dev/null 2>&1 || [[ $RETRIES -ge $MAX_RETRIES ]]; do
  sleep 2
  RETRIES=$((RETRIES + 1))
  echo -n "."
done
echo ""

if [[ $RETRIES -ge $MAX_RETRIES ]]; then
  warn "Convex backend may not be ready yet. Attempting to set JWT keys anyway..."
fi

# Set JWT keys in Convex
log "Setting JWT keys in Convex..."
cd "$INSTALL_DIR"
npx convex env set JWT_PRIVATE_KEY -- "$(cat "$JWT_PRIVATE_KEY_FILE")" || {
  err "Failed to set JWT_PRIVATE_KEY. Convex backend may not be running."
  err "Check: sudo journalctl -u berry-claw-convex -n 20"
  exit 1
}
npx convex env set JWKS -- "$(cat "$JWKS_FILE")" || {
  err "Failed to set JWKS."
  exit 1
}

rm -f "$JWT_PRIVATE_KEY_FILE" "$JWKS_FILE"
log "JWT keys set"

# ─── Step 6: Deploy Convex functions & build Next.js ─────────────────────────
header "Step 6/7 — Deploying Convex functions & building Next.js"

# Deploy Convex functions and schema (this also generates _generated/ files)
log "Pushing Convex functions and schema..."
npx convex deploy || {
  err "Failed to deploy Convex functions."
  err "Check: sudo journalctl -u berry-claw-convex -n 20"
  exit 1
}
log "Convex functions deployed"

# Now build Next.js (requires _generated/ from convex deploy)
log "Building Next.js app..."
npm run build || {
  err "Next.js build failed."
  exit 1
}
log "Next.js build complete"

# Start Next.js
log "Starting Next.js web server..."
sudo systemctl enable --now berry-claw-web

# Verify services
sleep 3
if systemctl is-active --quiet berry-claw-convex; then
  log "berry-claw-convex: ${GREEN}running${NC}"
else
  err "berry-claw-convex: ${RED}failed${NC}"
  journalctl -u berry-claw-convex -n 10 --no-pager
fi

if systemctl is-active --quiet berry-claw-web; then
  log "berry-claw-web: ${GREEN}running${NC}"
else
  err "berry-claw-web: ${RED}failed${NC}"
  journalctl -u berry-claw-web -n 10 --no-pager
fi

# ─── Step 7: Cloudflare Tunnel & Firewall ────────────────────────────────────
header "Step 7/7 — Cloudflare Tunnel & Firewall"

if [[ -n "$CF_TUNNEL_TOKEN" ]]; then
  log "Installing Cloudflare Tunnel as service with provided token..."

  # Stop any existing cloudflared service
  sudo systemctl stop cloudflared 2>/dev/null || true

  # Install using the connector token from Cloudflare Dashboard
  sudo cloudflared service install "$CF_TUNNEL_TOKEN" 2>/dev/null || true

  sudo systemctl enable --now cloudflared

  if systemctl is-active --quiet cloudflared; then
    log "cloudflared: ${GREEN}running${NC}"
  else
    warn "cloudflared may need a moment to connect. Check: sudo systemctl status cloudflared"
  fi

  echo ""
  info "Next steps for Cloudflare Tunnel:"
  echo "  1. Go to Cloudflare Dashboard > Zero Trust > Networks > Tunnels"
  echo "  2. Find your tunnel and add a Public Hostname:"
  echo "     - Subdomain: $(echo "$DOMAIN" | cut -d. -f1)"
  echo "     - Domain: $(echo "$DOMAIN" | cut -d. -f2-)"
  echo "     - Service: http://localhost:3002"
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
  echo "    5. Add Public Hostname: ${DOMAIN} -> http://localhost:3002"
  echo ""
  echo "  Option B: CLI login"
  echo "    1. cloudflared tunnel login"
  echo "    2. cloudflared tunnel create berry-claw"
  echo "    3. Create ~/.cloudflared/config.yml with:"
  echo "       tunnel: <UUID>"
  echo "       credentials-file: ~/.cloudflared/<UUID>.json"
  echo "       ingress:"
  echo "         - hostname: ${DOMAIN}"
  echo "           service: http://localhost:3002"
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
log "UFW enabled — only SSH is open. All HTTP via Cloudflare Tunnel."

# ─── Done ─────────────────────────────────────────────────────────────────────
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
echo "  Local test:   curl http://localhost:3002"

if [[ -n "$CF_TUNNEL_TOKEN" ]]; then
  echo "  Public URL:   https://${DOMAIN}"
else
  echo "  Public URL:   https://${DOMAIN} (after tunnel setup)"
fi

echo ""
echo "  Update:"
echo "    cd ${INSTALL_DIR} && git pull && npm install"
echo "    npx convex deploy && npm run build"
echo "    sudo systemctl restart berry-claw-convex berry-claw-web"
echo ""
echo -e "${YELLOW}Remember:${NC} If this is a fresh Docker install, log out and back in"
echo "for docker group permissions to take effect."
echo ""
