#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 <site-slug> <port>"
  exit 1
fi

SITE_SLUG="$1"
PORT="$2"
APP_DIR="apps/site-${SITE_SLUG}"
PROCESS="site-${SITE_SLUG}"

cd "$APP_DIR"
npm run build
pm2 restart "$PROCESS" || pm2 start npm --name "$PROCESS" -- start -- -p "$PORT"
pm2 save

echo "Deployed $PROCESS on port $PORT"
