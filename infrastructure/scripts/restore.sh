#!/usr/bin/env bash
# Restore a backup made by backup.sh. Replaces the current data, so stop the Hearth services first:
#
#   docker compose stop gateway family-service task-service decision-service care-service \
#       notification-service audit-service ai-service
#   infrastructure/scripts/restore.sh backups/20261105T020000Z
#   docker compose up -d
#
# The Neo4j family map is rebuilt from these databases, so it is not part of the backup.
set -euo pipefail

COMPOSE="${COMPOSE:-docker compose}"
SOURCE="${1:?Usage: restore.sh <backup folder>}"
DATABASES=(hearth_family hearth_task hearth_decision hearth_care hearth_notification hearth_audit hearth_ai)

[ -d "${SOURCE}" ] || { echo "No such folder: ${SOURCE}" >&2; exit 1; }
if [ -f "${SOURCE}/SHA256SUMS" ]; then
  ( cd "${SOURCE}" && sha256sum --quiet -c SHA256SUMS ) || { echo "Checksums do not match: the backup is damaged." >&2; exit 1; }
fi

read -r -p "This replaces all Hearth data with ${SOURCE}. Type RESTORE to go on: " answer
[ "${answer}" = "RESTORE" ] || { echo "Stopped."; exit 1; }

for db in "${DATABASES[@]}"; do
  file="${SOURCE}/${db}.dump"
  if [ ! -f "${file}" ]; then echo "  ${db}: not in this backup, skipped"; continue; fi
  ${COMPOSE} exec -T postgres pg_restore -U hearth -d "${db}" --clean --if-exists --no-owner --exit-on-error < "${file}"
  echo "  ${db}: restored"
done

if [ -f "${SOURCE}/documents.tar.gz" ]; then
  ${COMPOSE} run --rm --no-deps -T --entrypoint sh care-service -c 'rm -rf /data/documents && tar -C /data -xzf -' < "${SOURCE}/documents.tar.gz"
  echo "  documents: restored"
fi
echo "Done. Start the services again: ${COMPOSE} up -d"
