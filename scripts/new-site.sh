#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 <site-slug> <site-id>"
  exit 1
fi

SITE_SLUG="$1"
SITE_ID="$2"
TARGET_DIR="apps/site-${SITE_SLUG}"

if [[ -d "$TARGET_DIR" ]]; then
  echo "Site already exists: $TARGET_DIR"
  exit 1
fi

cp -R apps/site-demo "$TARGET_DIR"
cat > "$TARGET_DIR/.env.example" <<ENV
SITE_ID=${SITE_ID}
API_BASE=https://api.example.com
NEXT_PUBLIC_SITE_ID=${SITE_ID}
NEXT_PUBLIC_API_BASE=https://api.example.com
ENV

echo "Created $TARGET_DIR"
