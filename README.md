# Hearth 🌿

> **One place for a family's care, tasks, and week.**

Hearth is a full-stack, event-driven **microservices** family care coordination platform designed and built by **Afsara Saima Mannan**.

In multi-generational households, caring for children, older relatives, and daily home life is usually scattered across group chats, paper notes, and one person's memory. Hearth brings a family's care tasks, schedules, medical appointments, medicine regimens, emergency cards, health notes, meals, and important documents into one calm, shared workspace. On the backend, **7 independent Spring Boot microservices** (each owning its own isolated PostgreSQL database and communicating asynchronously via a Transactional Outbox and Apache Kafka) power a deterministic mathematical decision engine that ranks what needs attention first, detects schedule clashes before they happen, and recommends the fairest family member to step in—paired with an optional privacy-preserving AI microservice (and a complete offline rule-based engine when AI is switched off).

---

## What Hearth Does Today

| Area | Features |
| --- | --- |
| **Family & Roles** | Sign-up with email confirmation, invitations, role-based access (`lead`, `contributor`, `observer`), dependants (children, older relatives), skills, per-person weekly availability & time away |
| **Tasks** | Create, assign, reassign, complete; `family` (shared) or `private` visibility; discussion comments under each task |
| **Decision Engine** | Mathematical **Task Priority Score** and **Candidate Suitability Score** (formulas below); automatic overlap/overload conflict detection; what-if simulations; "who could step in" handover recommendations with transparent explanations |
| **Schedule & Calendar Sync** | Week, agenda, and day views for one person or the whole family; repeating weekly routines; "I can't make it" cover workflow; private per-person iCal feed (`/feeds/<token>.ics`) for Google, Apple, and Outlook calendars |
| **Care, Health & Food** | Medical appointments with preparation checklists, per-person health profiles, meal planning, nutrition goals, shared shopping list, and a secure document vault |
| **Medicines** | Per-person medication schedules (dosage, times, days), "taken / skipped" dose tracking, missed-dose alerts to carers, and today's doses on **My Day** |
| **Emergency Card** | Blood group, allergies, conditions, primary doctor, preferred hospital, emergency contacts, and active medicines—printable and available offline |
| **AI Help (Optional)** | **Quick add** (natural language in English or Bangla → task drafts), **Plan my week** (validated against the decision engine's what-if simulator before display), and **Message drafts** (handover requests, reminders, weekly summaries). Opt-in per person; family surnames and IDs are stripped into aliases (`m1`, `d1`) before leaving Hearth, private task titles are never sent, and a built-in offline rule-based assistant handles everything when no `AI_API_KEY` is configured |
| **Notifications & Live Updates** | In-app notifications, transactional email, RFC 8291/8292 Web Push to phones and desktops (even with Hearth closed), and real-time Server-Sent Events (SSE) across open tabs and devices |
| **Installable PWA & Accessibility** | Installable Progressive Web App (`vite-plugin-pwa` + Workbox offline shell), full English and বাংলা (Bangla) localization, voice typing, and light, dark, and high-contrast themes |
| **Audit Trail** | Append-only, family-scoped activity log recording every state change across services |

---

## Microservices Architecture

Hearth follows a strict **database-per-service microservices architecture** fronted by a single Spring Cloud API Gateway. Each microservice is an isolated bounded context with its own Flyway-managed PostgreSQL 16 schema, publishing domain events through a transactional outbox to Apache Kafka (KRaft) and consuming events idempotently with dead-letter topic (`<topic>.DLT`) fallback.

```text
Browser (React 18 PWA — English & বাংলা, Offline Shell, Web Push, SSE Live Updates)
   │  HTTPS  (Caddy in production, nginx in the web image)
   ▼
API Gateway (Spring Cloud Gateway :8080) ── RS256 JWT verified against family-service JWKS
   │
   ├── family-service       (:8081) ── PostgreSQL hearth_family ──────── Redis (shared auth rate limit)
   ├── task-service         (:8082) ── PostgreSQL hearth_task            (+ private iCal feeds)
   ├── decision-service     (:8083) ── PostgreSQL hearth_decision
   ├── care-service         (:8084) ── PostgreSQL hearth_care ────────── Neo4j (CareGraph) + document volume
   ├── notification-service (:8085) ── PostgreSQL hearth_notification    (+ Web Push RFC 8291/8292, SSE stream)
   ├── audit-service        (:8086) ── PostgreSQL hearth_audit
   └── ai-service           (:8087) ── PostgreSQL hearth_ai ──────────── External AI API (optional)

   All 7 microservices publish domain events through a transactional outbox to Apache Kafka (KRaft)
   and consume them idempotently; failed events route to <topic>.DLT. Metrics: Prometheus + Grafana.
```

| Microservice / Module | Port | Database | Bounded Context & Responsibility |
| --- | --- | --- | --- |
| `api-gateway` | `8080` | – | Routing, RS256 JWT validation, CORS, SSE streaming pass-through |
| `hearth-common` | *library* | – | Domain event contracts, transactional outbox, Kafka consumer + DLT config, security context, metrics |
| `family-service` | `8081` | `hearth_family` | Accounts, RS256 JWT + JWKS, refresh-token rotation, families, members, dependants, availability, rate limiting |
| `task-service` | `8082` | `hearth_task` | Tasks, assignment state machine, private/shared visibility, schedules, recurring routines, iCal feeds |
| `decision-service` | `8083` | `hearth_decision` | Task Priority Score, Candidate Suitability Score, conflict detection, what-if simulations |
| `care-service` | `8084` | `hearth_care` | Appointments, health profiles, food & shopping list, documents, medicine schedules, emergency card, Neo4j CareGraph |
| `notification-service` | `8085` | `hearth_notification` | In-app notifications, SMTP email, Web Push encryption & delivery, live SSE stream, family chat & task comments |
| `audit-service` | `8086` | `hearth_audit` | Append-only family activity log with actor, action, and subject filtering |
| `ai-service` | `8087` | `hearth_ai` | Quick add, weekly plan proposals, message drafts, per-member consent, PII aliasing, and daily/monthly token budgets |

**Stack:** Java 21, Spring Boot 3.5, Spring Cloud 2025.0, PostgreSQL 16 (Flyway), Apache Kafka 3.9, Neo4j 5, Redis 7, React 18, TypeScript 5.6 (strict), Vite 5, Tailwind CSS 3, Workbox 7, Docker, Kubernetes, Caddy, Prometheus, Grafana, k6.

Further documentation:
- [Design Decisions](docs/DESIGN-DECISIONS.md)
- [System Architecture](docs/architecture/ARCHITECTURE.md)
- [Transactional Outbox & Kafka Pipeline](docs/architecture/TRANSACTIONAL_OUTBOX_KAFKA_PIPELINE.md)
- [Database Design](docs/database/DATABASE_DESIGN.md)

---

## The Decision Engine

### 1. Task Priority Score

Determines **which task needs attention first**:

$$P = 100 \times (0.25D + 0.25C + 0.15I + 0.15R + 0.20S)$$

| Symbol | Factor | Weight |
| --- | --- | --- |
| $D$ | Deadline urgency | `0.25` |
| $C$ | Care criticality | `0.25` |
| $I$ | Dependency impact | `0.15` |
| $R$ | Reassignment difficulty | `0.15` |
| $S$ | Schedule conflict severity | `0.20` |

Each factor is normalized to $[0, 1]$ and the weights sum to `1.00`, yielding $P \in [0, 100]$.

### 2. Candidate Suitability Score

Determines **which family member is best suited to take a task**:

$$\text{Score}(m,t) = 100 \times \frac{0.35A + 0.20W + 0.25K - 0.30X}{0.80}$$

| Symbol | Factor | Weight |
| --- | --- | --- |
| $A$ | Availability match | `0.35` |
| $W$ | Workload capacity | `0.20` |
| $K$ | Skill eligibility | `0.25` |
| $X$ | Conflict cost penalty | `0.30` |

The score is clamped to $[0, 100]$. Dividing by $0.35 + 0.20 + 0.25 = 0.80$ ensures an ideal conflict-free candidate scores `100`.

The engine exists in both TypeScript (`frontend/src/services/decision/engine.ts`, used offline and in demo mode) and Java (`decision-service`). CI regenerates shared fixtures from the TypeScript engine and verifies that the Java implementation produces identical outputs (`DecisionEngineParityTest`).

---

## Vision & Future Roadmap

Hearth is an actively developed long-term project. Planned milestones on the roadmap:

1. **Offline-First Write Queue & Background Sync**
   - Extend the PWA service worker beyond read-caching to queue task completions, medicine dose logs, and shopping-list ticks while offline, replaying them automatically via Background Sync when connectivity returns.
2. **Two-Way Calendar & Wearable Integration**
   - Upgrade one-way iCal feeds to optional two-way CalDAV / Google Calendar sync so external work meetings automatically update member availability, alongside health-kit / wearable hooks for vitals and medication adherence.
3. **Voice-First Companion Mode for Older Relatives**
   - A simplified, large-type, voice-driven "Elder View" in Bangla and English where grandparents can hear today's schedule, confirm medicine doses by voice, or trigger a one-tap family check-in without navigating full menus.
4. **End-to-End Encrypted Document Vault & Prescription OCR**
   - Client-side WebCrypto encryption for sensitive medical records before upload, paired with on-device or opt-in AI prescription scanning that extracts medicine names, dosages, and frequencies directly into `care-service`.
5. **Multi-Household Care Circles & Shared Caregiver Burnout Insights**
   - Support extended families coordinating care across multiple homes (e.g., siblings living in different cities caring for ageing parents), plus longitudinal fairness and caregiver-fatigue trends in `decision-service`.

---

## Getting Started

### 1. Try in the Browser Only (Demo Mode — No Backend Needed)

Prerequisite: **Node.js 20+**.

```bash
cd frontend
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and click **Explore with sample data** to load a sample family workspace, or create an account to start fresh. In demo mode, all data persists locally in `localStorage` and the built-in offline assistant handles Quick Add, Plan My Week, and Drafts.

### 2. Run the Full System (Docker Compose)

Prerequisite: **Docker Desktop** (with Compose v2.24+ and ~4 GB RAM allocated).

```bash
cp .env.example .env                        # optional: every setting has a safe local default
node tools/vapid-keys.mjs >> .env           # optional: generates VAPID keys for Web Push
docker compose up --build                   # builds and starts all services
```

Once the stack is healthy:

| URL | Service |
| --- | --- |
| [http://localhost:8000](http://localhost:8000) | **Hearth Web App** (nginx + PWA) |
| [http://localhost:8080/api/v1](http://localhost:8080/api/v1) | **API Gateway** |
| [http://localhost:8025](http://localhost:8025) | **Mailpit** (captures confirmation, invitation, and password-reset emails) |
| [http://localhost:7474](http://localhost:7474) | **Neo4j Browser** (`neo4j` / password from `NEO4J_PASSWORD`) |

#### Optional: Turning on Cloud AI Help
Hearth works out of the box without any API key using its offline assistant. To enable cloud AI help, add a free API key from [Google AI Studio](https://aistudio.google.com/apikey) (or any compatible `/chat/completions` endpoint) to `.env`:

```env
AI_API_KEY=your_api_key_here
AI_MODEL=gemini-2.5-flash
```

### 3. Monitoring Stack (Prometheus + Grafana)

```bash
docker compose -f docker-compose.yml -f docker-compose.monitoring.yml up -d
```

- **Prometheus:** [http://localhost:9090](http://localhost:9090)
- **Grafana:** [http://localhost:3001](http://localhost:3001) (pre-provisioned with the Hearth service & JVM dashboard)

### 4. Production & Kubernetes Deployment

- **Docker Compose + Caddy (automatic HTTPS):** [`docs/deployment/PRODUCTION.md`](docs/deployment/PRODUCTION.md)
- **Kubernetes Manifests:** [`k8s/README.md`](k8s/README.md)
- **Operations & Incident Runbook:** [`docs/operations/RUNBOOK.md`](docs/operations/RUNBOOK.md)

---

## Quality & Verification

| Check | Command / Location | What It Verifies |
| --- | --- | --- |
| **Backend Tests** | `cd backend && mvn clean verify` | JUnit 5 unit tests, MockMvc controller tests, and Testcontainers integration tests against real PostgreSQL 16, Kafka, Neo4j, and Redis |
| **Coverage Gate** | JaCoCo (`backend/pom.xml`) | Enforces $\ge 80\%$ line coverage on every service; aggregate report generated in `backend/coverage` |
| **Frontend Checks** | `cd frontend && npm run check` | TypeScript strict type-checking, ESLint (`react-hooks`, `jsx-a11y`), Prettier formatting, 27 Vitest unit tests (including CSP script-hash verification), and production PWA build |
| **End-to-End Suites** | `tools/e2e-smoke.mjs` & `frontend/tools/verify/` | Full-stack API smoke tests (49 checks), Playwright demo flows (26 flows), and `connected/real-account.mjs` (14-step multi-browser real-account journey across desktop and mobile viewports) |
| **Load Testing** | `tools/load/hearth-load.js` (k6) | Throughput and p95 latency benchmarks ([`docs/PERFORMANCE.md`](docs/PERFORMANCE.md)) |
| **CI Pipeline** | `.github/workflows/ci.yml` | Runs backend verification, frontend checks, engine parity, and deployment manifest validation (`kubeconform`, Compose, Caddy, Prometheus) on every push and PR |

Release history is tracked in [`CHANGELOG.md`](CHANGELOG.md).

---

## Repository Structure

```text
Hearth/
├── backend/
│   ├── pom.xml                        # Parent Maven reactor POM (Java 21, Spring Boot 3.5, JaCoCo 80% gate)
│   ├── Dockerfile                     # Multi-stage container build for all backend modules
│   ├── api-gateway/                   # Spring Cloud Gateway (:8080)
│   ├── hearth-common/                 # Shared events, transactional outbox, security, HTTP client, test utilities
│   ├── coverage/                      # Aggregate JaCoCo coverage report module
│   └── services/
│       ├── family-service/            # Auth, RS256 JWT/JWKS, families, members, dependants, availability (:8081)
│       ├── task-service/              # Tasks, assignments, routines, conflicts, iCal feeds (:8082)
│       ├── decision-service/          # Priority & suitability scoring engine, simulations (:8083)
│       ├── care-service/              # Appointments, health, meals, shopping, medicines, emergency card, Neo4j (:8084)
│       ├── notification-service/      # Notifications, email, Web Push, live SSE stream, chat & comments (:8085)
│       ├── audit-service/             # Append-only family activity log (:8086)
│       └── ai-service/                # Quick add, weekly planner, message drafts, consent & token guard (:8087)
├── frontend/
│   ├── src/                           # React 18 app: app, components, constants, features, hooks, i18n, lib, mocks, services, styles, types
│   ├── src-sw/                        # Workbox service worker (offline shell + Web Push notification handler)
│   ├── tools/verify/                  # Playwright verification suites (demo flows, route crawl, real-account E2E)
│   ├── nginx.conf                     # Production SPA + API/SSE reverse proxy config
│   └── security-headers.conf          # Strict CSP, HSTS, Permissions-Policy, and frame headers
├── infrastructure/
│   ├── init-db/                       # PostgreSQL database initialization & migration scripts
│   ├── caddy/                         # Production Caddyfile for automatic TLS
│   ├── monitoring/                    # Prometheus scrape/alert rules and Grafana provisioning + dashboards
│   └── ops/                           # Automated backup and checksum-verified restore scripts
├── k8s/                               # Kubernetes namespace, config, secrets, statefulsets, deployments, ingress, HPA, PDB, network policies
├── tools/                             # Full-stack E2E smoke test, k6 load test, VAPID key generator, engine parity fixtures
├── docs/                              # Architecture, database design, design decisions, performance, production & runbook guides
├── .github/workflows/ci.yml           # GitHub Actions CI pipeline
├── docker-compose.yml                 # Complete local stack (PostgreSQL, Kafka, Neo4j, Redis, Mailpit, 7 services, gateway, web)
├── docker-compose.monitoring.yml      # Prometheus + Grafana overlay
├── docker-compose.prod.yml            # Production Caddy HTTPS overlay
├── .env.example                       # Documented environment variable template
├── CHANGELOG.md                       # Release changelog
└── README.md
```
