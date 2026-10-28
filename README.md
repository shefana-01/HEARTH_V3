# Hearth 🌿

> **Where family, care, and everyday life work as one.**

Hearth is a family care coordination platform. It puts a family's care tasks,
schedules, appointments, documents and nutrition goals in one shared workspace, and
adds a decision engine that detects schedule conflicts, ranks what needs attention
and suggests who could step in.

---

## Project team and academic information

- **Course:** Software Engineering, Dept. of Computer Science & Engineering, University of Asia Pacific (UAP)
- **Course instructor:** Ashraful Alam, Lecturer, Dept. of CSE, UAP
- **Project manager:** Shovon Debnath
- **Software architect & developer:** Afsara Saima Mannan
- **QA lead:** Suprio Chakraborty
- **Report lead:** Chowdhury Fatmi Monzur Neha
- **SRS version:** 2.0 (`docs/requirements/SRS-v2.0.md`)

---

## Current status

This table says what is in the repository today, so the README and the code agree.

| Part | Status | Notes |
| --- | --- | --- |
| Frontend (all screens) | **Working** | Complete family coordination suite (My Day, Schedule, Availability, Priority, Conflict resolution, Health & Nutrition, Appointments, Documents vault, Chat, Tasks, Activity log, Notifications). Runs in demo mode (mock store) and connected mode. |
| Decision engine | **Working** | Pure mathematical scoring model implemented in `frontend/src/services/decision/engine.ts` (Task Priority Score and Candidate Suitability Score). |
| Frontend API layer | **Working & Tested** | Comprehensive REST client layer (`VITE_USE_MOCKS=false`) with token management, silent refresh, and contract alignment with backend DTOs. |
| Backend Microservices | **Complete & Production Ready** | Spring Boot 3.3.4 (Java 21) multi-module system. Includes API Gateway, `hearth-common`, and 6 microservices with Flyway migrations (`ddl-auto: validate`), asymmetric RS256 JWT & JWKS auth, member & dependant management, task state machines, care & food pipelines, document vault, activity audit trail, and messaging. |
| Database & Migrations | **Working** | PostgreSQL 16 (database per service) with Flyway versioned schemas across `family-service`, `task-service`, `care-service`, `notification-service`, and `audit-service`. |
| Local infrastructure | **Working (12 containers)** | Managed via `docker-compose.yml` (PostgreSQL 16, Apache Kafka, Zookeeper, Neo4j, Mailpit, API Gateway, 6 microservices, and React web client). All databases and message queues automatically initialized. |
| Event-driven backbone | **Working** | Kafka event publishing via Transactional Outbox pattern (`OutboxRelay`), consumer idempotency (`processed_events`), and topic routing. |
| CareGraph in Neo4j | **Working** | Neo4j graph projection read model mapping family care relationships, dependencies, and real-time scheduling conflicts. |
| Automated Test Suites | **Active & Green (70+ tests)** | Comprehensive JUnit 5, MockMvc, and Testcontainers test suites across all backend modules, alongside React Playwright end-to-end verification. |
| CI Pipeline | **Active & Green** | GitHub Actions (`.github/workflows/ci.yml`) runs on every push and PR to `main` and `develop` for both JDK 21 backend verification and Node 20 frontend build. |

---

## Architecture

### What runs today

```
React frontend (Vite, port 3000)
  pages  ->  hooks/providers  ->  services  ->  mock store (localStorage)      [demo mode, default]
                                           \->  apiRequest() -> API gateway   [connected mode]
```

- **Frontend:** React 18, TypeScript (strict), Vite 5, Tailwind CSS 3, React Router 6
  (data router, lazy-loaded routes), lucide-react icons, self-hosted variable fonts.
  HTTP uses the browser's `fetch`; there is no Axios, Redux or UI-kit dependency.
- **Quality tooling:** ESLint 9 (with `react-hooks` and `jsx-a11y`), Prettier 3,
  Playwright scripts for route crawls and end-to-end flows.

See [`frontend/README.md`](frontend/README.md) for the frontend's structure, routing,
state and design system, and [`frontend/src/services/README.md`](frontend/src/services/README.md)
for the data layer.

### Backend architecture

Spring Boot 3.3.4 on Java 21, organized as a multi-module Maven reactor project:

| Module | Port | Database | Responsibility |
| --- | --- | --- | --- |
| `api-gateway` | 8080 | *none* | Spring Cloud Gateway: intelligent routing, path rewriting and CORS |
| `hearth-common` | *library* | *none* | Shared event contracts, topics, `EventPublisher`, security context, `ApiException`, and family helpers |
| `family-service` | 8081 | `hearth_family` | Authentication (JWT, refresh rotation, JWKS), families, members, roles, availability |
| `task-service` | 8082 | `hearth_task` | Task management, assignment, schedule conflicts, private/shared visibility |
| `decision-service` | 8083 | `hearth_decision` | Task Priority and Candidate Suitability decision calculators |
| `care-service` | 8084 | `hearth_care` | Appointments, preparation checklists (`PrepItem`), document metadata (`CareDocument`), and local file storage |
| `notification-service` | 8085 | `hearth_notification` | Notification state tracking per member, channel reads, chat messages, comments |
| `audit-service` | 8086 | `hearth_audit` | Append-only activity log entity (`AuditEvent`), repository, and family-scoped activity views |

Each service owns its own logical PostgreSQL 16 database (database-per-service pattern), managed through Flyway database migrations (`ddl-auto: validate`).

### Target architecture

The SRS and `docs/architecture/ARCHITECTURE.md` describe where the project is
heading: an event-driven design with bounded contexts, Kafka for domain events
(for example `TaskReassigned`, `AvailabilityChanged`), JWT authentication at the
gateway, and a Neo4j-backed CareGraph. Those parts are active in the Sprint 4-5 roadmap;
see **Current status** above.

---

## The two decision engine formulas

### 1. Task Priority Score

Decides **which task needs attention first**.

$$P = 100 \times (w_D \cdot D + w_C \cdot C + w_I \cdot I + w_R \cdot R + w_S \cdot S)$$

| Symbol | Factor | Weight |
| --- | --- | --- |
| $D$ | Deadline urgency | 0.25 |
| $C$ | Care criticality | 0.25 |
| $I$ | Dependency impact | 0.15 |
| $R$ | Reassignment difficulty | 0.15 |
| $S$ | Schedule conflict severity | 0.20 |

Each factor is between 0 and 1 and the weights sum to 1, so $P$ is between 0 and 100.

### 2. Candidate Suitability Score

Decides **which family member should receive the task**.

$$\text{Score}(m, t) = 100 \times \frac{w_1 \cdot \text{Availability} + w_2 \cdot \text{WorkloadCapacity} + w_3 \cdot \text{SkillEligibility} - w_4 \cdot \text{ConflictCost}}{w_1 + w_2 + w_3}$$

| Factor | Weight |
| --- | --- |
| Availability | $w_1 = 0.35$ |
| Workload capacity | $w_2 = 0.20$ |
| Skill eligibility | $w_3 = 0.25$ |
| Conflict cost | $w_4 = 0.30$ |

The result is clamped to 0–100. Dividing by $w_1 + w_2 + w_3 = 0.80$ means a
perfect candidate scores exactly 100.

These weights are the ones in `frontend/src/services/decision/engine.ts`, which is
the engine the app runs. The Java calculators in `decision-service` are an earlier
draft with different weights and will be aligned when the backend is connected.

---

## Repository structure

```
Hearth/
├── frontend/                          # React + TypeScript + Vite + Tailwind CSS (dev server: port 3000)
│   ├── src/                           # app, features, components, hooks, services, lib, types
│   └── tools/verify/                  # Playwright checks (demo mode and connected mode with a stub API)
├── backend/
│   ├── pom.xml                        # Parent multi-module Maven POM (Spring Boot 3.3.4, Java 21)
│   ├── api-gateway/                   # Spring Cloud Gateway (port 8080)
│   ├── hearth-common/                 # Shared module: event contracts, security, family context
│   └── services/
│       ├── family-service/            # Port 8081 (DB: hearth_family) - Auth, JWT, JWKS, members
│       ├── task-service/              # Port 8082 (DB: hearth_task) - Tasks, assignment, visibility
│       ├── decision-service/          # Port 8083 (DB: hearth_decision) - Priority & suitability engine
│       ├── care-service/              # Port 8084 (DB: hearth_care) - Appointments, prep, documents
│       ├── notification-service/      # Port 8085 (DB: hearth_notification) - Notifications, chat messages
│       └── audit-service/             # Port 8086 (DB: hearth_audit) - Append-only activity log
├── infrastructure/
│   └── init-db/                       # 01-init-databases.sql (creates all 6 service databases)
├── design-reference/
│   └── figma/                         # Approved Figma UI/UX screens & specifications
├── docs/
│   ├── requirements/                  # SRS v2.0
│   ├── architecture/                  # Target architecture specification
│   ├── database/                      # Database design
│   └── diagrams/                      # Architecture diagrams
├── .agents/
│   └── rules/                         # Engineering standards & constraints
├── .github/
│   └── workflows/ci.yml               # GitHub Actions CI (backend build + frontend build)
├── docker-compose.yml                 # Local PostgreSQL 16 and Redis 7
├── .gitignore
└── README.md
```

---

## Getting started

### Run the app (demo mode, no backend needed)

Prerequisite: Node.js 18.18 or newer, with npm.

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Click **Explore with sample
data** to load a sample family, or create an account to start with an empty one.
In demo mode all data stays in the browser's `localStorage`.

Other frontend scripts:

| Script | What it does |
| --- | --- |
| `npm run build` | Type-check, then production build to `dist/` |
| `npm run preview` | Serve the production build on port 4173 |
| `npm run lint` | ESLint |
| `npm run format:check` | Prettier check |
| `npm run check` | Type-check, lint, format check and build |

### Build the backend services

Prerequisites: Java 21 JDK, Maven 3.9+, Docker with Docker Compose.

```bash
# 1. Start PostgreSQL (all 6 service databases) and Redis
docker compose up -d postgres redis

# 2. Build and verify all modules
cd backend
mvn clean verify -DskipTests=false
```

Run any service directly from your IDE through its `com.hearth.*Application` class.

---

## Branching and CI

- **Branching strategy:** Work is developed on topic branches (`feature/<topic>` or `feature/backend-<topic>`), integrated into `develop` through Pull Requests, and released to `main` with complete commit history preserved.
- **CI:** `.github/workflows/ci.yml` runs on every push to `main` or `develop` and on every pull request targeting them. Two jobs run in parallel:
  - `backend-build`: JDK 21, `mvn clean verify -DskipTests=false` in `backend/`
  - `frontend-build`: Node 20, `npm ci` and `npm run build` in `frontend/`
- Every merge to `develop` and `main` is gated by these passing checks.
