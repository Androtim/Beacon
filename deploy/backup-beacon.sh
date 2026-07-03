#!/usr/bin/env bash
# Nightly SQLite backup for Beacon. Uses the online .backup API (safe while the
# server is writing), keeps 14 days, and prunes older copies.
#
# Install (as root on the VM):
#   cp /opt/beacon/deploy/backup-beacon.sh /usr/local/bin/backup-beacon.sh
#   chmod +x /usr/local/bin/backup-beacon.sh
#   # run at 04:15 daily:
#   ( crontab -l 2>/dev/null; echo '15 4 * * * /usr/local/bin/backup-beacon.sh' ) | crontab -
set -euo pipefail

DB=/opt/beacon/data/beacon.db
DEST=/opt/beacon/data/backups
KEEP_DAYS=14

mkdir -p "$DEST"
stamp=$(date +%F)
sqlite3 "$DB" ".backup '$DEST/beacon-$stamp.db'"
find "$DEST" -name 'beacon-*.db' -mtime +"$KEEP_DAYS" -delete
