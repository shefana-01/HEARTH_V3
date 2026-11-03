# Running Hearth in production

Two supported ways: Docker Compose on one server (simplest; fine for hundreds of families), or
Kubernetes (several machines, autoscaling). Both run the same images.

---

## Docker Compose on one server

**Server.** 4 vCPU and 8 GB of memory is comfortable (the load test in
[PERFORMANCE.md](../PERFORMANCE.md) ran on 2 vCPU / 8 GB). Docker with Compose 2.24 or newer. A domain
name whose DNS points at the server, with ports 80 and 443 open.

```bash
git clone <your repository> hearth && cd hearth
cp .env.example .env
node tools/vapid-keys.mjs >> .env       # push notification keys (Node 20); or run it elsewhere and paste
```

Then edit `.env`:

| Setting | Value |
| --- | --- |
| `DB_PASSWORD`, `NEO4J_PASSWORD` | Long random strings (`openssl rand -base64 32`) |
| `HEARTH_DOMAIN` | e.g. `hearth.example.com` |
| `ACME_EMAIL` | Your address, for certificate notices and as the push contact |
| `MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_FROM` | Your mail provider's SMTP settings |
| `AI_API_KEY` | Optional; turns on AI help |

Start:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps        # wait for all "healthy"
```

Compose refuses to start while a required setting is missing, and names it.

**What the production file changes.** Caddy terminates HTTPS with automatic Let's Encrypt certificates
and is the only container with published ports. PostgreSQL, Kafka, Neo4j, Redis, the gateway and the
web container are reachable only inside the Docker network. Mailpit is not started. Logs rotate at
20 MB × 5 files per container.

**Security headers** (Caddy, and the same in the web image's nginx): HSTS with preload, a strict
Content-Security-Policy (scripts only from Hearth itself plus one hashed inline script; no third-party
origins), `X-Frame-Options: DENY`, `nosniff`, a strict referrer policy, and a permissions policy that
allows only the microphone (voice typing). `/actuator/*` is closed to the internet except
`/actuator/health`.

**Monitoring** on the same server:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.monitoring.yml up -d
ssh -L 3001:localhost:3001 -L 9090:localhost:9090 <server>     # then open http://localhost:3001
```

Prometheus and Grafana bind to 127.0.0.1 only, so reach them over SSH.

**Backups.** Add to the server's crontab (02:30 every night):

```
30 2 * * * cd /srv/hearth && COMPOSE="docker compose -f docker-compose.yml -f docker-compose.prod.yml" BACKUP_DIR=/srv/hearth-backups infrastructure/scripts/backup.sh >> /var/log/hearth-backup.log 2>&1
```

and copy `/srv/hearth-backups` to other storage. Restoring: [RUNBOOK.md](../operations/RUNBOOK.md#restore).

---

## Kubernetes

See [k8s/README.md](../../k8s/README.md).

---

## Before going live

- [ ] Every password in `.env` changed from the example; `.env` readable only by the deploy user
- [ ] `https://<domain>` shows a valid certificate; `http://` redirects to it
- [ ] Sign-up email arrives (checks the mail settings)
- [ ] Push: Settings → Notifications → turn on, then "Send a test notification"
- [ ] Calendar: Settings → Calendar → create a feed and subscribe from a phone
- [ ] Backup cron has run once, and a restore was tested on another machine
- [ ] Grafana shows all services up; alerts page is empty
- [ ] Signed in on two devices, a task added on one appears on the other without reloading
