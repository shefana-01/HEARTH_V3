# Hearth Backend Engineering Rules

## Stack
- Java 21 LTS
- Spring Boot 3.3.x
- Maven (multi-module monorepo)
- Spring Web, Spring Data JPA, Spring Security
- PostgreSQL 16 (service-isolated schemas)
- Apache Kafka (domain event bus for async workflows)
- Spring Cloud Gateway (API gateway routing)

## Service Architecture & Layering
Every service under `backend/services/<service-name>` must maintain clean architectural layering:
- `api/`: REST Controllers, Request/Response DTOs, Exception Handlers.
- `application/`: Application services, use cases, orchestration.
- `domain/`: Core business entities, value objects, domain logic, state machines.
- `infrastructure/`: Spring Data JPA repositories, Kafka event producers/consumers, external REST clients.

## Key Service Boundaries
1. `api-gateway`: Port 8080 (traffic routing, CORS, auth routing).
2. `family-service`: Port 8081 (`hearth_family`).
3. `task-service`: Port 8082 (`hearth_task`).
4. `decision-service`: Port 8083 (`hearth_decision`).
5. `care-service`: Port 8084 (`hearth_care`).
6. `notification-service`: Port 8085 (`hearth_notification`).

## Core Business Invariants
- Direct cross-service database access is prohibited; each service owns its database exclusively.
- Synchronous calls use REST through API Gateway / Feign/WebClient.
- Asynchronous state propagation (e.g. `TaskReassigned`, `AvailabilityChanged`) must use domain events.
- The Decision Engine formulas must remain deterministic, explainable, and testable without ML dependencies in V1.
- All recommendation outcomes require explicit human approval before state commit.
