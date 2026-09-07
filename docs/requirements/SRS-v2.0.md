# Hearth — Software Requirements Specification (v2.0)
**Course:** Software Engineering, Dept. of CSE, University of Asia Pacific  
**Supervisor:** Ashraful Alam, Lecturer, Dept. of CSE, UAP  
**Authors:** Afsara Saima Mannan, Shovon Debnath, Suprio Chakraborty, Chowdhury Fatmi Monzur Neha  

---

## 1. Module 1: Core Productivity & Planning

### 1.1 Scope & Purpose
Covers family task engine, availability and scheduling, conflict detection, task-priority and candidate-suitability decision engine, intelligent task reassignment, and What-If scheduling.

### 1.2 Functional Requirements
- **FR-04 Availability Management**: Users SHALL specify available periods, unavailable periods, recurring availability, and temporary unavailability.
- **FR-05 Task Creation**: Users SHALL create tasks with title, description, deadline, estimated duration, priority, criticality, assignee, dependencies, location, and recurrence.
- **FR-06 Task Assignment**: Authorized users SHALL assign tasks to family members. The system SHALL verify conflicts against availability.
- **FR-07 Conflict Detection**: The system SHALL detect scheduling conflicts between tasks, appointments, member availability, existing commitments, and task dependencies with explainable reasons.
- **FR-08 Task Priority Calculation**: System SHALL calculate a task priority score using:
  $$P = w_D \cdot D + w_C \cdot C + w_I \cdot I + w_R \cdot R + w_S \cdot S$$
- **FR-09 Unavailability Reporting**: A family member SHALL report inability to complete a task; the system assesses downstream impact.
- **FR-10 Reassignment Recommendation**: The system SHALL rank eligible family members using candidate-suitability score:
  $$\text{Score}(m, t) = w_1 \cdot \text{Availability} + w_2 \cdot \text{WorkloadCapacity} + w_3 \cdot \text{SkillEligibility} - w_4 \cdot \text{ConflictCost}$$
- **FR-11 Reassignment Approval**: The system SHALL require explicit user approval before committing a reassignment.
- **FR-12 What-If Scheduling**: System SHALL simulate proposed schedule changes, evaluate constraints, and preview downstream effects.
- **FR-13 CareGraph**: System SHALL maintain relationships among Family, Member, Task, Appointment, Patient, Caregiver, Schedule, and Dependency entities.

---

## 2. Module 2: Collaboration & Group Management

### 2.1 Scope & Purpose
Covers user authentication, family workspace creation, member invitations, role management, notifications, and audit logging.

### 2.2 Functional Requirements
- **FR-01 User Registration & Authentication**: Secure sign up, login, password management, and token management.
- **FR-02 Family Creation**: Authenticated users SHALL create family workspaces.
- **FR-03 Family Member Management**: Invite members, accept/decline invites, remove members, and assign roles (`ADMIN`, `MEMBER`, `CAREGIVER`, `DEPENDENT`).
- **FR-19 Notifications**: Real-time delivery of notifications for tasks, reassignments, approaching deadlines, conflicts, and appointments.
- **FR-20 Audit Trail**: Immutable logging of security-sensitive and coordination-sensitive actions (who, what, when, before, after).

---

## 3. Module 3: Nutrition & Health Intelligence

### 3.1 Scope & Purpose
Covers healthcare appointments, limited health profiles, document storage, and informational nutrition/budget recommendations.

### 3.2 Functional Requirements
- **FR-14 Appointment Management**: Create and track appointments (date, time, location, patient, caregiver, status, linked tasks).
- **FR-15 Health Information**: Maintain limited, non-diagnostic profile information under strict role-based access.
- **FR-16 Document Management**: Controlled storage and retrieval of health/care documents with immutable metadata.
- **FR-17 Nutrition and Budget Support**: Provide informational nutritional alternatives based on verified datasets according to dietary goals and budget. Non-diagnostic phrasing strictly enforced.
- **FR-18 Grocery Integration**: Convert selected nutrition recommendations into grocery items and optional household tasks.

---

## 4. Platform-Wide Safety & Security Requirements
- **SR-A1**: Authentication mandatory for non-public endpoints.
- **SR-A2**: Role-Based Access Control (RBAC) enforced.
- **SR-A3**: Patient health data isolated to explicitly assigned caregivers and members.
- **SR-A4**: Time-bounded, revocable session tokens.
- **SR-I1**: Transactional consistency for scheduling updates.
- **SR-I2**: Immutable audit trail entries.
- **SR-I3**: Explicit user approval gate for all decision engine recommendations.
- **SR-P2**: Strict informational-only boundary for health/nutrition guidance.
