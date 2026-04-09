#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR=${BACKUP_DIR:-"/projects/backups"}
KEEP_DAILY=${KEEP_DAILY:-30}
KEEP_WEEKLY=${KEEP_WEEKLY:-12}
KEEP_MONTHLY=${KEEP_MONTHLY:-3}
DB_DUMP_PREFIX=${DB_DUMP_PREFIX:-"db"}
TIMESTAMP=$(date +"%Y%m%d-%H%M%S")
mkdir -p "$BACKUP_DIR"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required"
  exit 1
fi

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "pg_dump is required"
  exit 1
fi

BACKUP_FILE="$BACKUP_DIR/${DB_DUMP_PREFIX}-${TIMESTAMP}.sql.gz"
pg_dump "$DATABASE_URL" | gzip > "$BACKUP_FILE"
echo "Backup created: $BACKUP_FILE"

if [[ -n "${BACKUP_SYNC_CMD:-}" ]]; then
  # Example: BACKUP_SYNC_CMD='rclone copy /projects/backups b2:ecom-backups'
  bash -lc "$BACKUP_SYNC_CMD"
fi

list_backups_sorted() {
  find "$BACKUP_DIR" -maxdepth 1 -type f -name "${DB_DUMP_PREFIX}-*.sql.gz" -printf "%f\n" | sort -r
}

line_number=0
while IFS= read -r backup_name; do
  ((line_number+=1))
  backup_path="$BACKUP_DIR/$backup_name"
  date_part=$(echo "$backup_name" | sed -E "s/^${DB_DUMP_PREFIX}-([0-9]{8})-[0-9]{6}\.sql\.gz$/\1/")
  if [[ ! "$date_part" =~ ^[0-9]{8}$ ]]; then
    continue
  fi
  day_of_month="${date_part:6:2}"
  day_of_week=$(date -u -d "$date_part" +"%u" 2>/dev/null || echo "")

  keep=false
  if (( line_number <= KEEP_DAILY )); then
    keep=true
  elif [[ "$day_of_week" == "7" ]] && (( line_number <= KEEP_DAILY + KEEP_WEEKLY * 7 )); then
    keep=true
  elif [[ "$day_of_month" == "01" ]]; then
    month_rank=$(( (line_number - KEEP_DAILY) / 30 + 1 ))
    if (( month_rank <= KEEP_MONTHLY )); then
      keep=true
    fi
  fi

  if [[ "$keep" == false ]]; then
    rm -f "$backup_path"
  fi
done < <(list_backups_sorted)
