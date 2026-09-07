# Hearth 🌿
> **Where family, care, and everyday life work as one.**  
> A distributed, event-driven family care & life coordination platform integrating intelligent task scheduling, conflict resolution, CareGraph relationship model, healthcare coordination, and nutrition-aware household planning.

---

## 👥 Project Team & Academic Information
- **Course**: Software Engineering, Dept. of Computer Science & Engineering, University of Asia Pacific (UAP)
- **Course Instructor**: Ashraful Alam, Lecturer, Dept. of CSE, UAP
- **Project Manager**: Shovon Debnath
- **Software Architect & Developer**: Afsara Saima Mannan
- **QA Lead**: Suprio Chakraborty
- **Report Lead**: Chowdhury Fatmi Monzur Neha
- **Document Version**: 2.0 (Hybrid Event-Driven Bounded-Context Architecture)

---

## 🏛️ System Architecture

Hearth implements a **Hybrid Event-Driven Distributed Architecture** organized around explicit bounded contexts.
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Lucide Icons, Axios, React Router v6.
- **API Gateway**: Spring Cloud Gateway routing incoming client traffic and managing cross-cutting concerns (CORS, Rate Limiting, Auth routing).
- **Core Microservices**:
  1. `family-service` (Port: 8081) — Identity, family workspaces, members, roles, availability windows.
  2. `task-service` (Port: 8082) — Task CRUD, assignment, scheduling, conflict detection.
  3. `decision-service` (Port: 8083) — Decision Engine (Task Priority formula & Candidate Suitability scoring).
  4. `care-service` (Port: 8084) — Health profiles, appointments, documents, nutrition goals & grocery conversion.
  5. `notification-service` (Port: 8085) — Real-time in-app notifications and comprehensive audit logging.
- **Event Backbone**: Apache Kafka (domain event decoupling for state mutations).
- **Data Persistence**: PostgreSQL 16 (service-isolated schemas), Redis (engine cache).

---

## 📐 The Two Core Decision Engine Formulas

### 1. Task Priority Score ($P$)
Determines **which task needs attention first**:
$$P = w_D \cdot D + w_C \cdot C + w_I \cdot I + w_R \cdot R + w_S \cdot S$$
- $D$ = Deadline urgency
- $C$ = Care criticality
- $I$ = Dependency impact
- $R$ = Reassignment difficulty
- $S$ = Schedule conflict severity

### 2. Candidate Suitability Score ($\text{Score}(m, t)$)
Determines **which family member should receive the task**:
$$\text{Score}(m, t) = w_1 \cdot \text{Availability} + w_2 \cdot \text{WorkloadCapacity} + w_3 \cdot \text{SkillEligibility} - w_4 \cdot \text{ConflictCost}$$

---

## 📁 Repository Structure

```
hearth/
├── backend/
│   ├── pom.xml                        # Parent multi-module Maven POM
│   ├── api-gateway/                   # Spring Cloud Gateway (Port 8080)
│   └── services/
│       ├── family-service/            # Port 8081 (DB: hearth_family)
│       ├── task-service/              # Port 8082 (DB: hearth_task)
│       ├── decision-service/          # Port 8083 (DB: hearth_decision)
│       ├── care-service/              # Port 8084 (DB: hearth_care)
│       └── notification-service/      # Port 8085 (DB: hearth_notification)
├── frontend/                          # React + TypeScript + Vite + Tailwind CSS (Port 5173 / 3000)
├── infrastructure/
│   ├── init-db/                       # 01-init-databases.sql
│   └── docker/                        # Dockerfiles and deployment configs
├── design-reference/
│   ├── figma/                         # Approved Figma UI/UX screens & jam files
│   └── stitch/                        # Stitch HTML/CSS reference exports
├── docs/
│   ├── requirements/                  # Module SRS specifications (v2.0)
│   ├── architecture/                  # Hybrid event-driven architectural specification
│   ├── database/                      # Schemas & ERD models
│   └── diagrams/                      # System UML & DFD diagrams
├── .agents/
│   └── rules/                         # Engineering standards & constraints
├── .github/
│   └── workflows/ci.yml               # GitHub Actions CI build & verification
├── docker-compose.yml                 # Local dev orchestration (PostgreSQL, Redis)
├── .gitignore
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites
- Java 21 JDK
- Node.js (v18+) & npm
- Docker Desktop & Docker Compose
- Maven 3.9+

### 1. Database & Infrastructure
Start the isolated PostgreSQL databases:
```bash
docker-compose up -d postgres redis
```

### 2. Backend Services
Build all services using the root Maven parent POM:
```bash
cd backend
mvn clean install -DskipTests
```
Run individual services or launch through your IDE (`com.hearth.*Application`).

### 3. Frontend Web Application
Run the React + Vite frontend:
```bash
cd frontend
npm install
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.
