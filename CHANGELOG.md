# Changelog

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow
[Semantic Versioning](https://semver.org/).

## [2.0.0] – 2026-11-05

### Added
- **AI help** (new `ai-service`, optional): quick add from a sentence, "Plan my week" with every
  suggestion checked by the decision engine, and drafts for messages and reminders. Per-person consent,
  names replaced by placeholders before sending, daily and monthly limits. Offline rule-based quick add
  in English and Bangla when AI is off.
- **Installable app (PWA)** with an offline shell, update prompt and app icons.
- **Push notifications** (Web Push with VAPID; no third-party service), per-device settings and a test
  button.
- **Live updates** across tabs and devices (server-sent events fed from Kafka).
- **Calendar sync**: a private iCal feed per person for Google, Apple and Outlook calendars.
- **Medicines**: schedules per person, taken / skipped per dose, missed-dose alerts, today's doses on
  My day.
- **Emergency card**: blood group, allergies, doctor, hospital and current medicines; printable.
- **Dead-letter topics** (`<topic>.DLT`) after three retries, and `tools/dlt.sh` to list, show and
  replay parked events.
- **Shared rate limiting** in Redis, with an in-memory fallback.
- **Monitoring**: Prometheus metrics in every service, a Grafana dashboard (16 panels), seven alert
  rules, `docker-compose.monitoring.yml`.
- **Load test** (k6) and published results (`docs/PERFORMANCE.md`).
- **Coverage gate**: JaCoCo, 80% line coverage per service, aggregate report.
- **Frontend unit tests** (Vitest and Testing Library), including a check that the Content-Security-Policy
  hash matches the inline script.
- Docs: design decisions, runbook, production guide, Kubernetes guide.

### Fixed
- Joining a family from an invitation: My day showed "We couldn't load your family" until the page was
  reloaded. The family now reloads as soon as the account joins.
- The invitation link from the email showed "Sign in first" as an error to people without an account.
  It now explains the invitation and offers "Create my account" or "I already have an account".
- A brand-new account (no family yet) no longer asks the server for family members.
- The "You'll join as a member or follower" line on the invitation broke into columns.

### Changed
- Kubernetes manifests rewritten: correct settings for every service, Neo4j, Redis, ai-service, the
  database setup Job, startup/liveness/readiness probes, resource limits, non-root security context,
  autoscaling and a disruption budget.
- `docker-compose.prod.yml` is now an override of `docker-compose.yml`: Caddy with automatic HTTPS is the
  only published port, and required secrets have no defaults.
- Backup and restore scripts cover all seven databases and the care documents, write checksums, and
  ask before restoring.
- Content-Security-Policy tightened (no third-party origins) and served by both nginx and Caddy.
- Service images run as a fixed numeric non-root user.
- CI: frontend unit tests, coverage report and summary, deployment-file validation, short load test.

## [1.0.0] – 2026-10-26

First complete release: family workspace, tasks, decision engine, schedule, care, documents, chat,
notifications, activity log, seven-container microservice backend with Kafka outbox, Neo4j family map,
English and Bangla.
