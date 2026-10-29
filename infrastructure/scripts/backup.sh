#!/usr/bin/env bash
# Hearth Production PostgreSQL Backup Script
set -eo pipefail

BACKUP_DIR="${BACKUP_DIR:-/backups}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-hearth-postgres-prod}"
POSTGRES_USER="${POSTGRES_USER:-hearth}"

DATABASES=("hearth_family" "hearth_task" "hearth_decision" "hearth_care" "hearth_notification" "hearth_audit")

mkdir -p "${BACKUP_DIR}/${TIMESTAMP}"

echo "=== Starting Hearth Database Backups: ${TIMESTAMP} ==="

for DB in "${DATABASES[@]}"; do
    echo "[Backup] Dumping ${DB}..."
    docker exec "${POSTGRES_CONTAINER}" pg_dump -U "${POSTGRES_USER}" -d "${DB}" -F c -b -v -f "/tmp/${DB}_${TIMESTAMP}.dump"
    docker cp "${POSTGRES_CONTAINER}:/tmp/${DB}_${TIMESTAMP}.dump" "${BACKUP_DIR}/${TIMESTAMP}/${DB}.dump"
    docker exec "${POSTGRES_CONTAINER}" rm "/tmp/${DB}_${TIMESTAMP}.dump"
    echo "[OK] Backed up ${DB} -> ${BACKUP_DIR}/${TIMESTAMP}/${DB}.dump"
done

# Retention policy: delete backups older than 14 days
echo "Cleaning backups older than 14 days..."
find "${BACKUP_DIR}" -mindepth 1 -maxdepth 1 -type d -mtime +14 -exec rm -rf {} +

echo "=== Hearth Backup Completed Successfully ==="
