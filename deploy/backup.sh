#!/usr/bin/env bash
# Nightly backup for the docker compose deployment: database dump + uploaded avatars.
# Schedule with cron, e.g.  15 2 * * *  /opt/qrcare/deploy/backup.sh >> /var/log/qrcare-backup.log 2>&1
#
# Backups contain personal data. Keep BACKUP_DIR on an encrypted disk, copy it off the server
# (see docs/operations.md), restrict access, and test a restore regularly.
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/qrcare}" # absolute path
KEEP_DAYS="${KEEP_DAYS:-14}"
STAMP="$(date +%Y%m%d-%H%M%S)"

umask 077 # backup files readable by the owner only
mkdir -p "$BACKUP_DIR"

cd "$(dirname "$0")" # deploy/, where compose.yml and production.env live
compose() { docker compose --env-file production.env -f compose.yml "$@"; }

# Write to *.partial and rename only on success, so a failed run never leaves a file that
# looks like a valid backup.
trap 'rm -f "${BACKUP_DIR:?}"/*.partial' EXIT

# Consistent logical dump in PostgreSQL's compressed custom format (restore with pg_restore).
compose exec -T db pg_dump -U qrcare -d qrcare --format=custom > "$BACKUP_DIR/db-$STAMP.dump.partial"
mv "$BACKUP_DIR/db-$STAMP.dump.partial" "$BACKUP_DIR/db-$STAMP.dump"

# Avatar files from the app's storage volume.
compose exec -T app tar -C /data -czf - storage > "$BACKUP_DIR/storage-$STAMP.tar.gz.partial"
mv "$BACKUP_DIR/storage-$STAMP.tar.gz.partial" "$BACKUP_DIR/storage-$STAMP.tar.gz"

# Drop backups older than KEEP_DAYS.
find "$BACKUP_DIR" -type f \( -name 'db-*.dump' -o -name 'storage-*.tar.gz' \) -mtime +"$KEEP_DAYS" -delete

echo "$(date -Is) backup ok: db-$STAMP.dump storage-$STAMP.tar.gz"
