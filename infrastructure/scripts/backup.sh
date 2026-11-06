#!/usr/bin/env bash
# Back up every Hearth database (pg_dump custom format, one file per database) and the care documents.
#
#   infrastructure/scripts/backup.sh                    # development stack
#   COMPOSE="docker compose -f docker-compose.yml -f docker-compose.prod.yml" infrastructure/scripts/backup.sh
#
# BACKUP_DIR (default ./backups) gets one folder per run; folders older than RETENTION_DAYS (default 14)
# are removed. Run it from cron, then copy BACKUP_DIR somewhere off the machine.
set -euo pipefail

COMPOSE="${COMPOSE:-docker compose}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
DATABASES=(hearth_family hearth_task hearth_decision hearth_care hearth_notification hearth_audit hearth_ai)
TARGET="${BACKUP_DIR}/$(date -u +%Y%m%dT%H%M%SZ)"

mkdir -p "${TARGET}"
echo "Backing up to ${TARGET}"

for db in "${DATABASES[@]}"; do
  # Streams straight out of the container: nothing is left behind inside it.
  ${COMPOSE} exec -T postgres pg_dump -U hearth -d "${db}" --format=custom --no-owner > "${TARGET}/${db}.dump"
  echo "  ${db}: $(du -h "${TARGET}/${db}.dump" | cut -f1)"
done

# Uploaded care documents (files; their details are in hearth_care).
${COMPOSE} exec -T care-service tar -C /data -czf - documents > "${TARGET}/documents.tar.gz" 2>/dev/null \
  && echo "  documents: $(du -h "${TARGET}/documents.tar.gz" | cut -f1)" \
  || { rm -f "${TARGET}/documents.tar.gz"; echo "  documents: none yet"; }

( cd "${TARGET}" && sha256sum -- * > SHA256SUMS )

find "${BACKUP_DIR}" -mindepth 1 -maxdepth 1 -type d -mtime "+${RETENTION_DAYS}" -exec rm -rf {} +
echo "Done."
