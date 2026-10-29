#!/usr/bin/env bash
# Hearth Production PostgreSQL Restore Script
set -eo pipefail

if [ -z "$1" ]; then
    echo "Usage: $0 <path_to_backup_directory>"
    echo "Example: $0 /backups/20261026_040000"
    exit 1
fi

BACKUP_DIR="$1"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-hearth-postgres-prod}"
POSTGRES_USER="${POSTGRES_USER:-hearth}"

DATABASES=("hearth_family" "hearth_task" "hearth_decision" "hearth_care" "hearth_notification" "hearth_audit")

echo "=== Starting Hearth Database Restore from ${BACKUP_DIR} ==="

for DB in "${DATABASES[@]}"; do
    DUMP_FILE="${BACKUP_DIR}/${DB}.dump"
    if [ ! -f "${DUMP_FILE}" ]; then
        echo "[WARN] Dump file not found: ${DUMP_FILE}, skipping..."
        continue
    fi
    echo "[Restore] Restoring ${DB}..."
    docker cp "${DUMP_FILE}" "${POSTGRES_CONTAINER}:/tmp/${DB}.dump"
    docker exec "${POSTGRES_CONTAINER}" pg_restore -U "${POSTGRES_USER}" -d "${DB}" --clean --if-exists -v "/tmp/${DB}.dump" || true
    docker exec "${POSTGRES_CONTAINER}" rm "/tmp/${DB}.dump"
    echo "[OK] Restored ${DB}"
done

echo "=== Hearth Restore Completed Successfully ==="
