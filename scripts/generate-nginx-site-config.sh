#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 <domain> <port> [output-file]"
  exit 1
fi

DOMAIN="$1"
PORT="$2"
OUTPUT_FILE="${3:-}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEMPLATE="$ROOT_DIR/scripts/templates/nginx-site.conf.template"

if [[ ! -f "$TEMPLATE" ]]; then
  echo "Template not found: $TEMPLATE"
  exit 1
fi

if [[ -z "$OUTPUT_FILE" ]]; then
  mkdir -p "$ROOT_DIR/deploy/nginx"
  OUTPUT_FILE="$ROOT_DIR/deploy/nginx/${DOMAIN}.conf"
fi

mkdir -p "$(dirname "$OUTPUT_FILE")"
sed -e "s/__DOMAIN__/$DOMAIN/g" -e "s/__PORT__/$PORT/g" "$TEMPLATE" > "$OUTPUT_FILE"

echo "Generated Nginx config at: $OUTPUT_FILE"
echo "Next steps:"
echo "  sudo cp \"$OUTPUT_FILE\" /etc/nginx/sites-available/${DOMAIN}.conf"
echo "  sudo ln -sf /etc/nginx/sites-available/${DOMAIN}.conf /etc/nginx/sites-enabled/${DOMAIN}.conf"
echo "  sudo nginx -t && sudo systemctl reload nginx"
