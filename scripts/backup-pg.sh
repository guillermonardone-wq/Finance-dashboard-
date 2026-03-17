#!/usr/bin/env bash
# ============================================================
# PostgreSQL Backup Script — pg_dump with 30-day retention
# Usage: ./scripts/backup-pg.sh
# Cron:  0 2 * * * /path/to/scripts/backup-pg.sh
# ============================================================

set -euo pipefail

# Load environment
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$SCRIPT_DIR/../.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "$SCRIPT_DIR/../.env"
  set +a
fi

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-signal_forge}"
DB_USER="${DB_USER:-signal_forge}"
BACKUP_DIR="${BACKUP_DIR:-$SCRIPT_DIR/../backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/${DB_NAME}_${TIMESTAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

echo "[Backup] Starting pg_dump of $DB_NAME at $(date -Iseconds)"

PGPASSWORD="${DB_PASSWORD:-signal_forge}" pg_dump \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  --no-owner \
  --no-acl \
  --format=plain \
  | gzip > "$BACKUP_FILE"

FILESIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "[Backup] Created $BACKUP_FILE ($FILESIZE)"

# Prune backups older than retention period
PRUNED=$(find "$BACKUP_DIR" -name "${DB_NAME}_*.sql.gz" -mtime +"$RETENTION_DAYS" -print -delete | wc -l)
if [ "$PRUNED" -gt 0 ]; then
  echo "[Backup] Pruned $PRUNED backup(s) older than $RETENTION_DAYS days"
fi

echo "[Backup] Done."
