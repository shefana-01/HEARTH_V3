# Runbook

What to do when something needs attention. Commands assume the production compose stack; set this
once per shell:

```bash
export COMPOSE="docker compose -f docker-compose.yml -f docker-compose.prod.yml"
```

On Kubernetes, use `kubectl -n hearth logs deploy/<service>` and `kubectl -n hearth exec` instead.

---

## Where to look

| What | Where |
| --- | --- |
| Is everything up? | `$COMPOSE ps` (all `healthy`), or `curl https://<domain>/actuator/health` |
| Dashboard | Grafana → *Hearth overview* (http://localhost:3001 with the monitoring compose file; open it over an SSH tunnel in production) |
| Alerts | Prometheus → Alerts (http://localhost:9090/alerts) |
| Logs | `$COMPOSE logs -f --tail 200 <service>`; every line carries `[service,traceId]` |
| One request across services | Find its trace id in the gateway log, then `$COMPOSE logs \| grep <traceId>` |

---

## Alerts

### ServiceDown (critical)
A service has not answered Prometheus for two minutes.
1. `$COMPOSE ps` and `$COMPOSE logs --tail 200 <service>`.
2. Out of memory (`OutOfMemoryError`, exit code 137): raise its memory, or `JAVA_OPTS` `-Xmx`.
3. Cannot reach its database or Kafka: check `postgres` and `kafka` are healthy; the service retries by
   itself once they are.
4. Failed Flyway migration: the log names the script. Fix the database or the script; never edit a
   migration that has already run elsewhere, add a new one.

### HighErrorRate (warning)
More than 5% of a service's requests fail with 5xx.
1. Grafana → *Server errors (5xx) by service* shows which service; its log shows the exception.
2. A dependency down (database, Kafka, another service) shows as connection errors: fix that first.
3. Right after a deploy: roll back to the previous image tag (`docker compose up -d` with the old tag).

### SlowRequests (warning)
The 95th percentile is above one second for ten minutes.
1. Grafana → *95th percentile latency by service* and *JVM heap used*. A full heap means garbage collection pauses.
2. PostgreSQL: `$COMPOSE exec postgres psql -U hearth -c "select pid, now() - query_start as for, query
   from pg_stat_activity where state <> 'idle' order by 2 desc limit 10;"`
3. Kafka consumer lag rising at the same time means the services are overloaded: add instances
   (Kubernetes HPA does this for gateway, task and decision services).

### OutboxBacklog (critical)
More than 100 events are waiting to be sent to Kafka for five minutes. Changes are saved, but other
services (and live updates, notifications) do not hear about them.
1. Is Kafka healthy? `$COMPOSE ps kafka`, `$COMPOSE logs --tail 100 kafka`.
2. The service log shows `OutboxRelay` errors. Once Kafka is reachable the relay catches up by itself;
   nothing is lost.

### EventsDeadLettered (warning)
A consumer gave up on an event after retries and parked it on `<topic>.DLT`.
1. See what failed: `tools/dlt.sh list`, then `tools/dlt.sh show hearth.task.events`. The
   `kafka_dlt-exception-message` header holds the error; the service's log holds the stack trace
   (search for `Parking event`).
2. Fix the cause (a bug: deploy the fix; missing data: repair it).
3. Replay: `tools/dlt.sh replay hearth.task.events`. Safe to run more than once: services skip events
   they have already handled, and the script only sends events it has not replayed before.
4. Parked events are kept 14 days.

### ConsumerLag (warning)
A service is more than 1000 events behind for ten minutes.
1. Is it failing every event (see EventsDeadLettered) or just slow (see SlowRequests)?
2. `$COMPOSE exec kafka /opt/kafka/bin/kafka-consumer-groups.sh --bootstrap-server localhost:9092
   --describe --group <service>` shows the lag per partition.

### JvmMemoryHigh (warning)
A service uses more than 90% of its heap for ten minutes. Raise its memory limit (the heap is 75% of
it), or look for a leak with `jcmd 1 GC.heap_info` inside the container.

---

## Routine tasks

### Backups
```bash
COMPOSE="$COMPOSE" BACKUP_DIR=/srv/hearth-backups infrastructure/scripts/backup.sh
```
Dumps the seven databases and the care documents into a dated folder with checksums, and removes folders
older than 14 days (`RETENTION_DAYS`). Run it nightly from cron and copy the folder off the machine.
Neo4j is not backed up: it is rebuilt from the databases.

### Restore
```bash
$COMPOSE stop gateway family-service task-service decision-service care-service notification-service audit-service ai-service
COMPOSE="$COMPOSE" infrastructure/scripts/restore.sh /srv/hearth-backups/20261105T020000Z
$COMPOSE up -d
```
The script checks the checksums and asks you to type RESTORE first. Test a restore on a spare machine
every few months: a backup that has never been restored is a guess.

### Push notification keys (VAPID)
Create once with `node tools/vapid-keys.mjs` and keep them in `.env` (or the Kubernetes secret).
Changing them signs everyone out of push: browsers keep subscriptions tied to the old public key, so
people must turn push on again in Settings. Subscriptions that push services report as gone (404/410)
are deleted automatically.

### AI key and budget
- Turn AI help on or off: set or clear `AI_API_KEY`, then `$COMPOSE up -d ai-service`.
- Limits: `AI_DAILY_REQUESTS` (per person per day) and `AI_MONTHLY_TOKENS` (per family per month).
- Grafana → *AI requests and tokens* (`hearth_ai_requests_total`, `hearth_ai_tokens_total`).
- If the provider fails, people see "AI help is not available right now" and everything else works.

### Database passwords
Change the password in PostgreSQL (`ALTER USER hearth PASSWORD '...'`), then `DB_PASSWORD` in `.env`,
then `$COMPOSE up -d` to restart the services with it.

### Signing keys
family-service keeps its RSA signing key in its database and publishes it on the JWKS endpoint. Access
tokens last 15 minutes (`ACCESS_TOKEN_MINUTES`), refresh tokens 30 days (`REFRESH_TOKEN_DAYS`).

### Upgrades
1. Back up.
2. `git pull`, then `$COMPOSE up -d --build`. Flyway migrates each database on start-up.
3. Watch Grafana for ten minutes. To roll back, start the previous images; restore the backup only if a
   migration has to be undone.
