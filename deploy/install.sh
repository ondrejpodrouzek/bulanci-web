#!/usr/bin/env bash
# Installs or updates the game on Debian or Ubuntu. Run as root:
#   sudo bash deploy/install.sh hra.example.cz
# Safe to run again: it updates the code and restarts the service. No game data goes on the server.
set -euo pipefail

DOMAIN=${1:-}
DIR=/opt/bulanci-web
REPO=https://github.com/ondrejpodrouzek/bulanci-web
NODE_MIN=20

[ "$(id -u)" = 0 ] || { echo "Run as root." >&2; exit 1; }
[ -n "$DOMAIN" ] || { echo "Usage: install.sh <domain>" >&2; exit 1; }

export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq git curl ca-certificates gnupg debian-keyring debian-archive-keyring apt-transport-https

node_ok() { command -v node >/dev/null && [ "$(node -p 'process.versions.node.split(".")[0]')" -ge "$NODE_MIN" ]; }
if ! node_ok; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y -qq nodejs
fi

if ! command -v caddy >/dev/null; then
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/gpg.key | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -qq
  apt-get install -y -qq caddy
fi

if [ -d "$DIR/.git" ]; then
  git -C "$DIR" pull --ff-only
else
  git clone "$REPO" "$DIR"
fi

id bulanci >/dev/null 2>&1 || useradd --system --no-create-home --shell /usr/sbin/nologin bulanci

sed "s#/usr/bin/node#$(command -v node)#" "$DIR/deploy/bulanci.service" > /etc/systemd/system/bulanci.service
systemctl daemon-reload
systemctl enable bulanci
systemctl restart bulanci

if ! grep -qF "$DOMAIN {" /etc/caddy/Caddyfile; then
  [ -f /etc/caddy/Caddyfile.original ] || cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.original
  # The packaged file only serves a placeholder page on port 80. Any other content stays in place.
  if grep -q '^:80' /etc/caddy/Caddyfile; then : > /etc/caddy/Caddyfile; fi
  sed "s/hra.example.cz/$DOMAIN/" "$DIR/deploy/Caddyfile" >> /etc/caddy/Caddyfile
fi
caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
systemctl reload caddy

sleep 2
curl -fsS -o /dev/null http://127.0.0.1:4173/ && echo "The game runs: https://$DOMAIN/"
