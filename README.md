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
| Frontend (all screens) | **Working** | Runs fully in demo mode with an in-browser data layer. No backend needed. |
| Decision engine | **Working** | TypeScript reference implementation in `frontend/src/services/decision/engine.ts`. |
| Frontend API layer | **Written, not connected** | Every service has a REST branch (`VITE_USE_MOCKS=false`) with token handling and silent refresh. It is tested against a stub API in `frontend/tools/verify/connected`. |
| Backend | **Scaffold** | Spring Boot gateway and five services with entities, repositories, DTOs and controllers. It compiles in CI. It does not yet provide authentication or the `/api/v1` endpoints the frontend API layer calls. |
| PostgreSQL, Redis | **Local infrastructure** | Started by `docker-compose.yml`. Redis is provisioned but not used by any service yet. |
| Kafka event backbone | **Planned** | Described in `docs/architecture`. Not in the code or in Docker Compose. |
| CareGraph in Neo4j | **Planned** | Today the graph is derived in the browser from the family's records. |
| Deployment (CD) | **Not set up** | CI builds both halves; nothing is deployed. |

---

## Architecture

### What runs today

```
React frontend (Vite, port 3000)
  pages  ->  hooks/providers  ->  services  ->  mock store (localStorage)      [demo mode, default]
                                           \->  apiRequest() -> API gateway   [written, backend pending]
```

- **Frontend:** React 18, TypeScript (strict), Vite 5, Tailwind CSS 3, React Router 6
  (data router, lazy-loaded routes), lucide-react icons, self-hosted variable fonts.
  HTTP uses the browser's `fetch`; there is no Axios, Redux or UI-kit dependency.
- **Quality tooling:** ESLint 9 (with `react-hooks` and `jsx-a11y`), Prettier 3,
  Playwright scripts for route crawls and end-to-end flows.

See [`frontend/README.md`](frontend/README.md) for the frontend's structure, routing,
state and design system, and [`frontend/src/services/README.md`](frontend/src/services/README.md)
for the data layer.

### Backend scaffold

Spring Boot 3.3.4 on Java 21, as a multi-module Maven project.

| Module | Port | Database | Responsibility |
| --- | --- | --- | --- |
| `api-gateway` | 8080 | none | Spring Cloud Gateway: routing and CORS |
| `family-service` | 8081 | `hearth_family` | Families, members, roles, availability |
| `task-service` | 8082 | `hearth_task` | Tasks, assignment, conflicts |
| `decision-service` | 8083 | `hearth_decision` | Priority and suitability calculators |
| `care-service` | 8084 | `hearth_care` | Patients, appointments, nutrition goals, groceries |
| `notification-service` | 8085 | `hearth_notification` | Notifications and audit log |

Each service owns its own PostgreSQL 16 database (database per service).

### Target architecture

The SRS and `docs/architecture/ARCHITECTURE.md` describe where the project is
heading: an event-driven design with bounded contexts, Kafka for domain events
(for example `TaskReassigned`, `AvailabilityChanged`), JWT authentication at the
gateway, and a Neo4j-backed CareGraph. Those parts are not implemented yet; see
**Current status** above.

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
│   ├── pom.xml                        # Parent multi-module Maven POM
│   ├── api-gateway/                   # Spring Cloud Gateway (port 8080)
│   └── services/
│       ├── family-service/            # Port 8081 (DB: hearth_family)
│       ├── task-service/              # Port 8082 (DB: hearth_task)
│       ├── decision-service/          # Port 8083 (DB: hearth_decision)
│       ├── care-service/              # Port 8084 (DB: hearth_care)
│       └── notification-service/      # Port 8085 (DB: hearth_notification)
├── infrastructure/
│   └── init-db/                       # 01-init-databases.sql (creates the five databases)
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

### Build the backend scaffold (optional)

Prerequisites: Java 21 JDK, Maven 3.9+, Docker with Docker Compose.

```bash
# 1. Start PostgreSQL and Redis
docker compose up -d postgres redis

# 2. Build all modules
cd backend
mvn clean install -DskipTests
```

Run a service from your IDE through its `com.hearth.*Application` class. The
frontend does not need these services, and is not yet connected to them.

---

## Branching and CI

- **Branches:** work is committed to `feature/frontend`, merged into `develop` by
  pull request, then merged from `develop` into `main` by a second pull request.
- **CI:** `.github/workflows/ci.yml` runs on every push to `main` or `develop` and on
  every pull request targeting them. Two jobs run in parallel:
  - `backend-build`: JDK 21, `mvn clean verify` in `backend/`
  - `frontend-build`: Node 20, `npm ci` and `npm run build` in `frontend/`
- CI checks that both halves build. It does not run the linters or the Playwright
  scripts, and it does not deploy.
