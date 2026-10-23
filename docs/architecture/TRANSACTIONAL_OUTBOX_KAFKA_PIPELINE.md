# Transactional Outbox Pattern & Kafka Event Pipeline (HEAR-460)

## Overview
Hearth implements the **Transactional Outbox Pattern** alongside an asynchronous **Apache Kafka** event pipeline to achieve reliable domain event distribution across all microservices without distributed transactions (2PC).

## Problem Statement
When a microservice writes state changes to PostgreSQL (e.g. updating a task, creating a family invitation, scheduling an appointment), directly publishing an event to Kafka in the same HTTP request lifecycle introduces two critical failure modes:
1. **Dual-write failure:** The database commit succeeds, but Kafka publishing fails (network partition, broker timeout), causing downstream listeners to miss updates permanently.
2. **Ghost events:** The Kafka event publishes successfully, but the database transaction subsequently rolls back, leaving downstream microservices in an inconsistent state.

## Architecture

### 1. The Outbox Table
Every state-mutating service maintains an `outbox_event` table in its dedicated PostgreSQL schema:

```sql
CREATE TABLE outbox_event (
    id UUID PRIMARY KEY,
    topic VARCHAR(100) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    family_id UUID NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    sent_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX idx_outbox_unsent ON outbox_event(created_at) WHERE sent_at IS NULL;
```

### 2. Atomic Persistence
Domain entities and the corresponding `DomainEvent` are written within the same local database transaction:
- In `hearth-common`, `EventPublisher` saves the JSON-serialized event into `outbox_event`.
- If the business transaction fails, the outbox record rolls back automatically.

### 3. Asynchronous Outbox Relay
A scheduled polling relay (`OutboxRelay` / `@Scheduled`) retrieves unsent events (`sent_at IS NULL`), transmits them to Kafka, and marks `sent_at = NOW()` upon successful broker acknowledgement.

### 4. Kafka Topics Topology
Events are partitioned by `family_id` to guarantee strict in-order processing within each family space:
- `hearth.family`: Family lifecycle, member joins/departures, role updates, and availability changes.
- `hearth.task`: Task creation, assignment, completion, reopening, and privacy changes.
- `hearth.care`: Appointment reminders, care graph updates, health profiles, grocery changes.
- `hearth.decision`: Handover requests, suitability recommendations, schedule plan updates.
- `hearth.notification`: User notifications, message threads, system announcements.
- `hearth.audit`: Activity history log and compliance audits.

### 5. Idempotent Consumers (`processed_event`)
To ensure exactly-once processing semantics at the application level against at-least-once Kafka delivery, consumers maintain a `processed_event` table:
- Before applying side effects, consumers check if `eventId` exists.
- The event handler executes and records `eventId` atomically. Duplicate redeliveries are ignored.

## Consumer Event Listeners
| Service | Listener | Handled Topics | Purpose |
|---|---|---|---|
| `care-service` | `CareEventListener` | `family`, `task`, `decision`, `care` | Member departure cleanup, care graph sync, appointment updates |
| `task-service` | `TaskEventListener` | `family`, `decision` | Reassigning tasks on member departure, applying approved handovers |
| `decision-service` | `DecisionEventListener` | `family`, `task`, `care` | Invalidating cached recommendations and plans |
| `notification-service` | `NotificationEventListener` | all topics | Dispatching in-app alerts and notifications to family members |
| `audit-service` | `AuditEventListener` | all topics | Appending immutable audit log entries |
