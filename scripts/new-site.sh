#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 4 ]]; then
  echo "Usage: $0 <site-slug> <site-id> <domain> <site-name> [port]"
  exit 1
fi

SITE_SLUG="$1"
SITE_ID="$2"
SITE_DOMAIN="$3"
SITE_NAME="$4"
SITE_PORT="${5:-3005}"
TARGET_DIR="apps/site-${SITE_SLUG}"
BRIEF_DIR="briefs"

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

mkdir -p "$BRIEF_DIR"
cat > "$BRIEF_DIR/${SITE_SLUG}.md" <<EOF
Site name: ${SITE_NAME}
Domain: ${SITE_DOMAIN}
Niche:
Target customer:
USP:
Design aesthetic:
Primary color:
Top 5 keywords:
City/region targeting:
Physical store locations:
Payment gateway: razorpay / stripe
GA4 ID:
Meta Pixel ID:
Google Ads Customer ID:
GMB URL:
NAP (address, phone):
Social links:
EOF

cat > "$BRIEF_DIR/${SITE_SLUG}.sql" <<EOF
INSERT INTO sites (domain, name, slug, config, nginx_port, pm2_process_name)
VALUES ('${SITE_DOMAIN}', '${SITE_NAME}', '${SITE_SLUG}', '{}', ${SITE_PORT}, 'site-${SITE_SLUG}');
EOF

echo "Created site app: $TARGET_DIR"
echo "Created brief template: $BRIEF_DIR/${SITE_SLUG}.md"
echo "Created DB registration SQL: $BRIEF_DIR/${SITE_SLUG}.sql"
