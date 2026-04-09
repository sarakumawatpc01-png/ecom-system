#!/usr/bin/env bash
set -euo pipefail

LOG_DIR="${1:-/projects/logs}"
TARGET_FILE="${2:-/etc/logrotate.d/projects-ecom-system}"

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  echo "Run as root to install logrotate config at $TARGET_FILE"
  exit 1
fi

cat > "$TARGET_FILE" <<EOF
$LOG_DIR/*.log {
    daily
    rotate 30
    size 50M
    compress
    delaycompress
    missingok
    notifempty
    copytruncate
    create 0640 root root
}
EOF

echo "Installed logrotate policy: $TARGET_FILE"
