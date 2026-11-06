#!/usr/bin/env bash
# Look at and replay events parked on the dead-letter topics (<topic>.DLT).
#
#   tools/dlt.sh list                         how many events each dead-letter topic holds
#   tools/dlt.sh show hearth.task.events      print the parked events with the error that parked them
#   tools/dlt.sh replay hearth.task.events    send parked events back to hearth.task.events
#
# Replaying is safe: every consumer records the events it has handled (processed_events) and skips
# repeats, so services that handled an event the first time ignore it. Only events not replayed before
# are sent (the consumer group hearth-dlt-replay remembers where it stopped). Fix the cause first, or the
# events fail again and come straight back.
#
# COMPOSE overrides how the stack is reached, e.g.
#   COMPOSE="docker compose -f docker-compose.yml -f docker-compose.prod.yml" tools/dlt.sh list
set -euo pipefail

COMPOSE="${COMPOSE:-docker compose}"
BIN=/opt/kafka/bin
BOOT=localhost:9092
TOPICS=(hearth.family.events hearth.task.events hearth.decision.events hearth.care.events)

kafka() { ${COMPOSE} exec -T kafka "$@"; }

check_topic() {
  for t in "${TOPICS[@]}"; do [ "$1" = "$t" ] && return 0; done
  echo "Unknown topic: $1 (one of: ${TOPICS[*]})" >&2
  exit 1
}

case "${1:-}" in
  list)
    for t in "${TOPICS[@]}"; do
      count=$(kafka "${BIN}/kafka-get-offsets.sh" --bootstrap-server "${BOOT}" --topic "${t}.DLT" 2>/dev/null \
        | awk -F: '{ s += $3 } END { print s + 0 }')
      printf '%-28s %s parked\n' "${t}.DLT" "${count}"
    done
    ;;
  show)
    topic="${2:?Usage: dlt.sh show <topic>}"; check_topic "${topic}"
    kafka "${BIN}/kafka-console-consumer.sh" --bootstrap-server "${BOOT}" --topic "${topic}.DLT" \
      --from-beginning --timeout-ms 5000 \
      --property print.key=true --property print.headers=true --property print.partition=true \
      --property print.timestamp=true 2>/dev/null || true
    ;;
  replay)
    topic="${2:?Usage: dlt.sh replay <topic>}"; check_topic "${topic}"
    # Key and value only, separated by a tab: the original event, without the error headers.
    kafka "${BIN}/kafka-console-consumer.sh" --bootstrap-server "${BOOT}" --topic "${topic}.DLT" \
      --group hearth-dlt-replay --consumer-property auto.offset.reset=earliest --timeout-ms 5000 \
      --property print.key=true --property key.separator=$'\t' 2>/dev/null > /tmp/hearth-dlt-replay.$$ || true
    n=$(wc -l < /tmp/hearth-dlt-replay.$$ | tr -d ' ')
    if [ "${n}" -gt 0 ]; then
      kafka "${BIN}/kafka-console-producer.sh" --bootstrap-server "${BOOT}" --topic "${topic}" \
        --property parse.key=true --property key.separator=$'\t' < /tmp/hearth-dlt-replay.$$
    fi
    rm -f /tmp/hearth-dlt-replay.$$
    echo "Replayed ${n} event(s) to ${topic}."
    ;;
  *)
    sed -n '2,15p' "$0" | sed 's/^# \{0,1\}//'
    exit 1
    ;;
esac
