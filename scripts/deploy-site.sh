#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 <site-slug> <port> [domain]"
  exit 1
fi

SITE_SLUG="$1"
PORT="$2"
DOMAIN="${3:-}"
APP_DIR="apps/site-${SITE_SLUG}"
PROCESS="site-${SITE_SLUG}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$ROOT_DIR/$APP_DIR"
npm run build
pm2 restart "$PROCESS" || pm2 start npm --name "$PROCESS" -- start -- -p "$PORT"
pm2 save

if [[ -n "$DOMAIN" ]]; then
  "$ROOT_DIR/scripts/generate-nginx-site-config.sh" "$DOMAIN" "$PORT"
  echo "Run certbot after enabling config:"
  echo "  sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN"
fi

echo "Deployed $PROCESS on port $PORT"
