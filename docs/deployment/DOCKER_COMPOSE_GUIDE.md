# Docker Compose Stack & Deployment Guide (HEAR-464)

## Overview
This document describes the complete Docker Compose deployment topology for the Hearth collaborative family care platform. The entire stack — including backing databases, streaming pipelines, internal microservices, API gateway, and web client — can be launched with a single command:

```bash
docker compose up -d
```

## Service Port Map & Architecture

### 1. Backing Infrastructure Services
| Container Name | Service | Internal Port | Host Port | Role |
|---|---|---|---|---|
| `postgres` | PostgreSQL 16 | 5432 | 5432 | Primary relational store with schemas for all 6 microservices |
| `neo4j` | Neo4j 5 Community | 7474, 7687 | 7474, 7687 | CareGraph property graph read-model |
| `kafka` | Apache Kafka 3.9 (KRaft) | 9092, 9094 | 9094 | Event bus for the transactional outbox pipeline (KRaft mode, no ZooKeeper) |
| `mailpit` | Mailpit v1.27 | 1025, 8025 | 1025, 8025 | Local SMTP mock server & web inbox for family invites |

### 2. Application Microservices & Clients
| Container Name | Service | Internal Port | Host Port | Health Check Endpoint |
|---|---|---|---|---|
| `gateway` | Spring Cloud Gateway | 8080 | 8080 | `GET /actuator/health` |
| `family-service` | Accounts, Families, Members | 8081 | - | `GET /actuator/health` |
| `task-service` | Tasks, Schedules, Events | 8082 | - | `GET /actuator/health` |
| `decision-service` | Decision Engine, Handovers | 8083 | - | `GET /actuator/health` |
| `care-service` | Health Profiles, Groceries, CareGraph | 8084 | - | `GET /actuator/health` |
| `notification-service` | Push Notifications, Chat | 8085 | - | `GET /actuator/health` |
| `audit-service` | Compliance & Activity Log | 8086 | - | `GET /actuator/health` |
| `web` | React + TypeScript + Nginx | 80 | 8000 | `GET /` |

## Multi-stage Docker Builds

### Backend (`backend/Dockerfile`)
The backend microservices share a multi-stage `Dockerfile`:
1. **Builder Stage (`maven:3.9-eclipse-temurin-21`):** Builds parent POM, shared library (`hearth-common`), and compiles service JAR artifacts.
2. **Runtime Stage (`eclipse-temurin:21-jre-alpine`):** Creates a lightweight unprivileged container containing only the compiled Spring Boot executable JAR, optimizing startup latency and memory footprint.

### Frontend (`frontend/Dockerfile`)
The frontend client uses a two-stage build:
1. **Builder Stage (`node:20-alpine`):** Executes `npm run build` (`tsc -b && vite build`) to produce optimized static assets in `/dist`.
2. **Server Stage (`nginx:alpine`):** Serves static files with customized caching headers and handles client-side SPA routing via `nginx.conf`.

## Startup Sequence & Health Checks
Docker Compose coordinates container boot order using `depends_on` conditions:
1. `postgres`, `neo4j`, `kafka`, and `mailpit` start first and execute healthchecks.
2. Database initialization scripts (`infrastructure/init-db/01-init-databases.sql`) provision separate databases:
   - `hearth_family`
   - `hearth_task`
   - `hearth_decision`
   - `hearth_care`
   - `hearth_notification`
   - `hearth_audit`
3. Application microservices boot once backing stores are healthy (`service_healthy`).
4. API Gateway (`gateway`) boots once all 6 microservices report healthy.
5. Web client (`web`) boots once the gateway reports healthy.

## Verification
To verify the full stack health and port accessibility:
```bash
node tools/verify-stack.mjs
```
