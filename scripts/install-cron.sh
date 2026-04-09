#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_SCRIPT="$ROOT_DIR/scripts/backup.sh"
SSL_SCRIPT="$ROOT_DIR/scripts/ssl-renew.sh"

if [[ ! -x "$BACKUP_SCRIPT" ]]; then
  chmod +x "$BACKUP_SCRIPT"
fi

if [[ ! -x "$SSL_SCRIPT" ]]; then
  chmod +x "$SSL_SCRIPT"
fi

tmp_cron="$(mktemp)"
crontab -l 2>/dev/null | grep -vE "ecom-system backup|ecom-system ssl" > "$tmp_cron" || true
{
  echo "0 2 * * * $BACKUP_SCRIPT # ecom-system backup"
  echo "0 3 * * * $SSL_SCRIPT # ecom-system ssl"
} >> "$tmp_cron"
crontab "$tmp_cron"
rm -f "$tmp_cron"

echo "Installed cron jobs:"
echo " - 02:00 daily backup"
echo " - 03:00 daily SSL renewal"
