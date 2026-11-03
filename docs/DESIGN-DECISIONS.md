# Design decisions

Short records of the choices that shape Hearth: what was decided, why, and what it costs. Newest last.

---

## 1. Microservices with a database each

**Decision.** Seven services, split by business area (family, tasks, decisions, care, notifications,
audit, AI), each with its own PostgreSQL database and Flyway migrations. Services never read another
service's tables.

**Why.** Each area changes for different reasons and at a different pace. Separate databases keep the
boundaries honest: a service can change its schema without coordinating with the others, and a slow
query in one cannot lock another's tables.

**Cost.** Data that crosses areas has to travel by events or API calls, and there are no cross-service
transactions. One PostgreSQL server still hosts all seven databases to keep running costs down; they can
be moved apart later without code changes (only `DB_HOST`).

## 2. Transactional outbox, then Kafka

**Decision.** A service writes its change and the event describing it in the same database transaction
(an `outbox` table). A relay publishes outbox rows to Kafka and marks them sent.

**Why.** Writing to the database and then to Kafka separately loses events when the service stops
between the two. With the outbox, an event exists if and only if the change was committed.

**Cost.** Delivery is at least once, so every consumer must cope with duplicates (decision 3). Events
reach Kafka after a short delay (the relay polls). The `hearth_outbox_pending` gauge and the
`OutboxBacklog` alert watch for a relay that has stopped.

## 3. Idempotent consumers

**Decision.** Each consumer records the id of every event it has handled (`processed_events`) in the
same transaction as its own change, and skips ids it has seen.

**Why.** Turns at-least-once delivery into effectively-once processing. It also makes replaying events
safe (decision 4).

## 4. Retry, then a dead-letter topic

**Decision.** A failed event is retried three times, one second apart, then parked on `<topic>.DLT`
(same partition, with the error in its headers, kept 14 days). `tools/dlt.sh` lists, shows and replays
parked events.

**Why.** Without this, one bad event either blocks its partition forever (endless retries) or is lost
(skipped). Parking it keeps the topic moving and keeps the event. The counter
`hearth_events_dead_lettered_total` and the `EventsDeadLettered` alert make it visible.

**Cost.** Events for one family after a parked one are handled before it, so order is not guaranteed
across a failure. Every handler is written to tolerate that (they look at current state, not at the
previous event).

## 5. RS256 tokens with a JWKS endpoint

**Decision.** family-service signs short-lived access tokens with a private RSA key and publishes the
public key at `/.well-known/jwks.json`. The gateway and every service check tokens with the public key.
Refresh tokens rotate on each use, and reuse of an old one revokes the whole chain.

**Why.** Only one service can create tokens; the others can only check them. Nothing secret has to be
shared between services, and keys can be rotated by publishing a new one next to the old.

## 6. A graph database for the family map only

**Decision.** Neo4j holds a read model of who cares for whom, rebuilt from events. PostgreSQL stays the
source of truth.

**Why.** Questions such as "who else can take over someone's care" are path queries that are short in
Cypher and awkward in SQL. Keeping it a read model means losing Neo4j loses nothing: it is rebuilt, and
it is not in the backups.

## 7. The decision engine in two languages, held equal by tests

**Decision.** The scoring engine exists in TypeScript (the app uses it offline and in demo mode) and in
Java (decision-service). CI regenerates shared fixtures from the TypeScript engine and fails if the Java
engine answers differently.

**Why.** The app stays useful without a connection, and the server still has the final say. The parity
test removes the usual risk of keeping two copies.

## 8. AI behind a separate service, with consent, aliases and limits

**Decision.** All AI calls go through ai-service. It sends nothing until the person turns AI help on.
Names are replaced by aliases (m1, d1, t1) before a request leaves Hearth and put back in the answer, and
private task titles are never sent. The model must answer through a tool with a fixed JSON schema
(forced `tool_use`), and the answer is checked again on the server: references to unknown people or tasks and
dates that are out of range are dropped. "Plan my week" suggestions are run through the decision engine's simulation
before they are shown. Each person has a daily request limit and each family a monthly token budget.

**Why.** The app is about family health and care, so privacy comes first. Forcing a schema and checking
the result keeps the model's mistakes from becoming wrong data. Limits keep costs predictable. Hearth
works fully without a key; the frontend falls back to a rule-based parser for quick add.

**Cost.** The model sees less context (aliases instead of names), which slightly lowers quality.

## 9. Web Push and live updates without third-party services

**Decision.** Push notifications use the Web Push standard directly (VAPID, RFC 8292, and aes128gcm
encryption, RFC 8291), implemented with the JDK's own crypto and tested against the RFC's test vector.
Pushes go through their own outbox and relay. Live updates use server-sent events: each
notification-service instance reads Kafka with its own consumer group and forwards the events for each
family to its open streams.

**Why.** No vendor account, no SDK, no extra cost, and no user data sent to a messaging company. SSE is
plain HTTP, passes through proxies, and reconnects by itself; the app only needs server-to-browser
messages, so WebSockets would add complexity for nothing.

**Cost.** Each open tab holds one connection. The heartbeat (every 25 s) keeps proxies from closing it.

## 10. Calendar sync as a private iCal feed

**Decision.** Each person can create a private feed URL (`/feeds/<token>.ics`). Only a SHA-256 hash of
the token is stored; a new token replaces the old one. Responses carry an ETag.

**Why.** Every calendar app can subscribe to iCal, so one feature works with Google, Apple and Outlook
without OAuth or API keys for each. Hashing means a database leak does not expose working URLs.

## 11. Rate limiting in Redis, with a fallback

**Decision.** The sign-in and sign-up limits count in Redis (an atomic Lua script, fixed window) so
several family-service instances share one count. If Redis is not reachable, the limiter falls back to
counting in memory and logs it, rather than refusing everyone.

**Why.** Per-instance counting lets an attacker multiply the limit by the number of instances. Failing
open to a per-instance limit keeps sign-in working during a Redis outage while still limiting abuse.

## 12. Observability built in

**Decision.** Every service exposes Prometheus metrics (requests with percentile histograms, JVM,
Kafka consumer lag, plus Hearth's own: outbox backlog, dead letters, push results, live connections, AI
use). A provisioned Grafana dashboard and seven alert rules come with the repository. Metrics are only
reachable inside the network.

**Why.** Problems should be seen on a dashboard before a family notices them.

## 13. Quality gates in CI

**Decision.** CI fails when any test fails, when a service drops below 80% line coverage (JaCoCo),
when the frontend has a type, lint, format or unit-test error, when the deployment files are invalid,
when the end-to-end smoke test fails, or when a short load test exceeds 1% errors or 800 ms p95.

**Why.** Each gate catches a kind of mistake the others miss, and none of them depends on someone
remembering to run it.
