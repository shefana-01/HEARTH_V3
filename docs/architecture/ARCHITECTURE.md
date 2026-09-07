# Hearth System Architecture Specification (v2.0)

## 1. Architectural Style: Hybrid Event-Driven Distributed Architecture
Hearth is built around explicit bounded contexts, combining direct REST APIs for client operations with asynchronous domain event publishing via Kafka for decoupled workflows (notifications, audit logs, decision caching).

```
                      HEARTH FRONTEND
                 (React + TypeScript + Vite)
                             │
                             │ HTTPS / REST
                             ▼
                    ┌─────────────────┐
                    │   API Gateway   │ (Port 8080)
                    └────────┬────────┘
                             │
       ┌─────────────┬───────┼─────────────┬─────────────┐
       ▼             ▼       ▼             ▼             ▼
    Family         Task   Decision       Care       Notification
    Service       Service  Service      Service       Service
   (Port 8081)  (Port 8082) (Port 8083) (Port 8084)  (Port 8085)
       │             │       │             │             │
       ▼             ▼       ▼             ▼             ▼
   hearth_family hearth_task hearth_dec  hearth_care  hearth_notif
                             ▲             ▲
                             │             │
                             └──────┬──────┘
                                    │
                               Kafka Bus
                   (TaskReassigned, AvailabilityChanged)
```

## 2. Service Boundaries & Responsibilities

| Service | Port | Database | Primary Responsibility |
|---|---|---|---|
| **api-gateway** | 8080 | None | Route dispatch, auth token verification, CORS headers, rate limiting |
| **family-service** | 8081 | `hearth_family` | Users, auth, family groups, members, roles, availability windows |
| **task-service** | 8082 | `hearth_task` | Task CRUD, assignment, scheduling, conflict detection logic |
| **decision-service**| 8083 | `hearth_decision` | Deterministic Priority Engine & Reassignment Suitability Engine |
| **care-service** | 8084 | `hearth_care` | Health profiles, appointments, documents, nutrition goals to grocery |
| **notification-service**| 8085 | `hearth_notification`| User notifications, event listeners, system audit log |

## 3. Decision Engine Technical Specification

### 3.1 Task Priority Calculation
$$P = w_D \cdot D + w_C \cdot C + w_I \cdot I + w_R \cdot R + w_S \cdot S$$
- $D \in [0, 1]$: Deadline Urgency (e.g. $\max(0, 1 - \frac{\text{hours to deadline}}{48})$)
- $C \in [0, 1]$: Care Criticality (standard task: 0.2, eldercare/medication: 0.9–1.0)
- $I \in [0, 1]$: Dependency Impact (number of blocking tasks / total family schedule impact)
- $R \in [0, 1]$: Reassignment Difficulty (rarity of qualified family members)
- $S \in [0, 1]$: Conflict Severity (direct clash with doctor appointment vs. minor overlap)

Default weights: $w_D = 0.25, w_C = 0.30, w_I = 0.20, w_R = 0.10, w_S = 0.15$.

### 3.2 Candidate Suitability Scoring
$$\text{Score}(m, t) = w_1 \cdot \text{Availability} + w_2 \cdot \text{WorkloadCapacity} + w_3 \cdot \text{SkillEligibility} - w_4 \cdot \text{ConflictCost}$$
- $\text{Availability} \in [0, 1]$: Free window match without overlap
- $\text{WorkloadCapacity} \in [0, 1]$: $1 - \frac{\text{assigned active tasks}}{\text{max capacity}}$
- $\text{SkillEligibility} \in \{0, 1\}$ or $[0, 1]$: Verified role requirement (e.g. caregiver for medical tasks)
- $\text{ConflictCost} \in [0, 1]$: Downstream schedule perturbation penalty

Default weights: $w_1 = 0.35, w_2 = 0.25, w_3 = 0.25, w_4 = 0.15$.
Each recommendation output contains a human-readable justification string explaining the score breakdown.
