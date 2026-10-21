# Hearth backend

Six Spring Boot microservices behind a Spring Cloud Gateway, one PostgreSQL database each, Kafka between
them, Neo4j for the family map. Every screen of the frontend works against it with `VITE_USE_MOCKS=false`.

**Stack:** Java 21 · Spring Boot 3.5 · Spring Cloud Gateway 2025.0 · Spring Security (OAuth2 resource
server, RS256 JWT) · Spring Data JPA + Flyway · Spring Kafka · Neo4j Java driver · springdoc-openapi ·
JUnit 5 + Testcontainers.

```
browser ──► web (nginx :8000) ──/api──► api-gateway :8080 ──► family-service        :8081  hearth_family
                                              │               task-service          :8082  hearth_task
                                              │               decision-service      :8083  hearth_decision
                                              │               care-service          :8084  hearth_care  + Neo4j
                                              │               notification-service  :8085  hearth_notification
                                              └ CORS, routing  audit-service         :8086  hearth_audit
                                                               │ outbox ► Kafka ► consumers │
```

## Running it

The easiest way is the whole system in Docker, from the repository root (see the root README):

```bash
docker compose up --build          # first build ≈ 10 min, needs ~4 GB free memory for Docker
node tools/seed-demo.mjs           # optional: the sample family (sign in as afsara@example.com / Hearth#2026)
node tools/e2e-smoke.mjs           # optional: 36 end-to-end checks against the running system
```

### One service from the IDE

```bash
docker compose up -d postgres kafka neo4j mailpit     # infrastructure only, from the repository root
cd backend && mvn -q install -DskipTests              # builds hearth-common for the services
```

Then run `com.hearth.<name>.<Name>ServiceApplication` (or `mvn -pl services/task-service spring-boot:run`).
Every setting has a default for this setup (`localhost`, user/password `hearth`, Neo4j password
`hearth-graph`), so start family-service first (it issues the tokens), then the others, then
`api-gateway`. If your `.env` changes `DB_PASSWORD` / `NEO4J_PASSWORD`, set the same environment
variables in the IDE run configuration.

Each service serves its API description at `http://localhost:808x/swagger-ui.html` and its health at
`/actuator/health`.

## Tests

```bash
mvn verify               # everything: unit tests + integration tests (needs Docker for Testcontainers)
mvn verify -P unit       # only the tests that do not need Docker
```

| Module | Tests | What they prove |
| --- | --- | --- |
| family-service | `FamilyApiIT` (13) | sign-up → verify email → sign-in, refresh rotation and reuse detection, lockout, password reset, family + invites, roles, account changes |
| task-service | `TaskApiIT` (10) | task CRUD, private-task masking, completion, personal events, time away, events in the outbox |
| decision-service | `DecisionEngineParityTest` (100 families), `DecisionApiIT` (8) | the Java engine gives **exactly** the TypeScript engine's results; attention list, insights, handovers |
| care-service | `CareApiIT` (8) | appointments + prep, health-note privacy, food suggestions, shopping list, documents, the Neo4j family map |
| notification-service | `NotificationApiIT` (3) | notifications from events, recipients, chat |
| audit-service | `AuditApiIT` (1) | activity log from events, idempotency |
| api-gateway | `GatewayRoutingTest` (4) | routes, `/internal` blocked, CORS |

Integration tests start real PostgreSQL (and Neo4j) containers. Other services are replaced by
`FakeFamilyDirectory` (in `hearth-common`'s test jar), and Kafka by reading the outbox table, so each
service is tested on its own.

**Engine parity.** The decision engine exists twice: `frontend/src/services/decision/engine.ts` (used in
demo mode) and `decision-service/.../engine/DecisionEngine.java`. `node tools/engine-fixtures.mjs` runs
the TypeScript engine on 100 random families and saves inputs + outputs; the Java test replays them and
must match every score, candidate and sentence. CI regenerates the fixtures first, so changing one engine
without the other fails the build.

## How a request works

1. **Sign-in** (family-service). Password checked with BCrypt (cost 12). Returns an **access token**
   (JWT, RS256, 15 min, `sub` = account id) and a **refresh token** (random, stored only as a SHA-256
   hash, rotated on every use; using an old one again revokes all of that account's sessions).
   Five wrong passwords lock the account for 15 minutes; sign-in/sign-up are rate-limited per IP.
2. **Every other call** carries `Authorization: Bearer <jwt>`. Each service validates it itself with the
   public key from family-service's `/.well-known/jwks.json` (`hearth-common` `SecurityConfig`), so no
   service trusts the gateway blindly.
3. The service asks family-service **who the caller is in their family** (`/api/v1/internal/context`:
   member id, role, family, time zone) through `ServiceClient`, which forwards the caller's token and the
   `X-Request-Id`. The gateway refuses `/internal/**` from outside.
4. Permissions are checked in the service layer (`FamilyContext.requireLead()` for organiser-only actions, `requireContributor()` so observers only read, owner checks,
   private tasks masked for others, health notes visible only as the person chose).
5. Errors are always `application/problem+json` (`GlobalExceptionHandler`): 400 validation, 401, 403,
   404, 409 conflicts, 503 when another service is down.

## Events (Kafka)

A service never calls Kafka inside a request. It writes the event to its own `outbox_event` table **in
the same database transaction** as the change (`EventPublisher`), and `OutboxRelay` sends waiting
events every second. So an event is never lost and never sent for a change that was rolled back.
Consumers record each event id in `processed_event` (`ProcessedEvents`) because Kafka may deliver twice.

| Topic (producer) | Consumed by | Why |
| --- | --- | --- |
| `hearth.family.events` (family) | task, care, notification, audit | member/dependant removed → their tasks, health notes, documents are cleaned up; family map refresh |
| `hearth.task.events` (task) | decision, care, notification, audit | task cancelled/made private → open handovers closed; time away → handover requests |
| `hearth.decision.events` (decision) | care, notification, audit | handover approved → family map, notifications, chat line |
| `hearth.care.events` (care) | task, notification, audit | appointment moved/escort changed → linked task follows; appointment removed → link cleared |

Every event (`DomainEvent`) can carry an **audit** line (activity log), a **notification** (to the
family or one person) and a **chat** line, so notification-service and audit-service need no knowledge
of other services' rules.

## The services

| Service | Owns | Notes |
| --- | --- | --- |
| **family-service** | accounts, sessions, families, members, dependants, roles, availability, invites, emails | identity provider (JWT + JWKS); emails go through an outbox to SMTP (Mailpit locally); joining needs a verified email |
| **task-service** | tasks, personal events (classes, shifts), time away | private tasks are visible to their owner only; reminders checked every minute |
| **decision-service** | handover (reassignment) requests | Java port of the decision engine; reads tasks/events/appointments live from the other services and computes; nothing to keep in sync |
| **care-service** | appointments + preparation lists, health notes, shopping list, documents (files on a volume), family map | food suggestions from health notes; the family map is a Neo4j projection rebuilt when events mark it stale, computed directly from the services if Neo4j is down |
| **notification-service** | notifications, chat messages, read state | fed only by events |
| **audit-service** | activity log | append-only, fed only by events |

Each service has the same layout: `api/` (controllers, no logic) → `application/` (rules, transactions)
→ `domain/` + `repository/` (JPA) and `dto/` (records), `events/` (Kafka listener). Database changes are
Flyway files in `src/main/resources/db/migration` (`V2__....sql` for the next change; never edit an
applied one). Hibernate only validates the schema (`ddl-auto: validate`).

## Configuration

All settings are environment variables with local defaults (see each `application.yml`). The ones you
will touch are in the root `.env.example`: `DB_PASSWORD`, `NEO4J_PASSWORD`, `APP_URL`,
`CORS_ALLOWED_ORIGINS`, `NOTIFY_OWN_ACTIONS`. For a real mail server set `MAIL_HOST`, `MAIL_PORT`,
`MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_AUTH=true`, `MAIL_STARTTLS=true` on family-service.

## Troubleshooting

- **A service stays "unhealthy"** on a slow machine: the first start runs all Flyway migrations and
  Kafka may need a minute. `docker compose ps` and `docker compose logs -f <service>`.
- **"Port is already allocated"**: something else uses 5432/8080/8000; stop it or change the left side
  of the port mapping in `docker-compose.yml`.
- **Sign-up email never arrives**: open Mailpit at http://localhost:8025.
- **Start from an empty database**: `docker compose down -v` (deletes all Hearth data).
