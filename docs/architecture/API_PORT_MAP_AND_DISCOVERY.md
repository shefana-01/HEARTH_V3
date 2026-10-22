# Hearth Architecture: API Table, Port Map & Service Discovery

**Ticket:** HEAR-469  
**Author:** Neha (FN)  
**Status:** Approved & Documented  

---

## 1. Port Allocation Map

Every Hearth microservice and infrastructure container is allocated a dedicated, static port in local development and Docker Compose to prevent port collision:

| Service / Container | Internal Port | Host / Exposed Port | Database / Backing Store |
|---------------------|---------------|---------------------|--------------------------|
| **Frontend (Vite/React)** | 80 | `5173` (dev) / `3000` (prod) | N/A |
| **API Gateway** | 8080 | `8080` | N/A |
| **family-service** | 8081 | `8081` | PostgreSQL (`hearth_family` on 5432) |
| **task-service** | 8082 | `8082` | PostgreSQL (`hearth_task` on 5432) |
| **decision-service**| 8083 | `8083` | PostgreSQL (`hearth_decision` on 5432) |
| **care-service** | 8084 | `8084` | PostgreSQL (`hearth_care` on 5432) |
| **notification-service** | 8085 | `8085` | PostgreSQL (`hearth_notification` on 5432) |
| **audit-service** | 8086 | `8086` | PostgreSQL (`hearth_audit` on 5432) |
| **PostgreSQL 16** | 5432 | `5432` | 6 isolated service databases |
| **Neo4j 5.22 (CareGraph)** | 7687 (Bolt) / 7474 (HTTP) | `7687` / `7474` | Graph database for family care knowledge |
| **Apache Kafka** | 9092 | `9092` | KRaft-mode event bus for domain events |

---

## 2. API Routing Table

Client traffic accesses all services through the Spring Cloud API Gateway on `http://localhost:8080`.

| Path Prefix | Target Microservice | Target URI | Purpose |
|-------------|---------------------|------------|---------|
| `/api/auth/**` | `family-service` | `http://localhost:8081` | Authentication, registration, JWT refresh rotation, JWKS public keys |
| `/api/family/**` | `family-service` | `http://localhost:8081` | Family profile, settings, member listing & invitation tokens |
| `/api/v1/tasks/**` | `task-service` | `http://localhost:8082` | Tasks CRUD, priority, deadlines, and visibility controls |
| `/api/v1/events/**` | `task-service` | `http://localhost:8082` | Personal calendar events per member |
| `/api/v1/unavailability/**` | `task-service` | `http://localhost:8082` | Time-away windows and unavailability reporting |
| `/api/v1/plan/**` | `task-service` | `http://localhost:8082` | Unified family schedule & agenda view |
| `/api/decisions/**` | `decision-service` | `http://localhost:8083` | Decision engine ranking, fairness scoring, reassignment approval |
| `/api/schedule/**` | `decision-service` | `http://localhost:8083` | Automatic weekly plan generation & conflict resolution |
| `/api/v1/care/**` | `care-service` | `http://localhost:8084` | Medical appointments, preparation checklists, care documents |
| `/api/care/graph/**` | `care-service` | `http://localhost:8084` | Neo4j CareGraph queries, relationships, and health profiles |
| `/api/v1/notifications/**`| `notification-service` | `http://localhost:8085` | In-app alerts, badge counters, mark-read, and dismissal |
| `/api/v1/messages/**` | `notification-service` | `http://localhost:8085` | Real-time family chat and per-task discussion threads |
| `/api/v1/audit-events/**` | `audit-service` | `http://localhost:8086` | Activity history stream, filtered by actor and category with paging |

---

## 3. Service Discovery Decision & Architecture Evaluation

### Options Considered:
1. **Dynamic Service Registry (Netflix Eureka / HashiCorp Consul)**
   - *Pros:* Automatically registers ephemeral container IPs; elastic horizontal scaling.
   - *Cons:* Adds high operational complexity, additional infrastructure failure domain, memory overhead (~500MB RAM for registry server), and registration heartbeat lag.
2. **DNS & Gateway-Based Static Routing (Selected Architecture)**
   - *Pros:*
     - In **Docker Compose / Kubernetes**, service names resolve directly via native DNS (e.g. `http://family-service:8081`).
     - In **local developer environments**, predictable static port allocations map 1:1 with localhost ports.
     - **Spring Cloud Gateway** acts as the single entrypoint for CORS, routing, rate limiting, and SSL termination.
     - Inter-service REST calls use Spring's high-performance `RestClient` and declarative interfaces with HTTP token relay (`CurrentUser.bearer()`), avoiding heavy Eureka dependencies.
   - *Decision:* **Gateway Routing + Docker DNS** is chosen as the optimal, lightweight, and robust architecture for Hearth.
