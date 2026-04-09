#!/usr/bin/env bash
set -euo pipefail

if ! command -v certbot >/dev/null 2>&1; then
  echo "certbot is required"
  exit 1
fi

if ! command -v nginx >/dev/null 2>&1; then
  echo "nginx is required"
  exit 1
fi

certbot renew --quiet
nginx -s reload
echo "SSL renewal check complete"
