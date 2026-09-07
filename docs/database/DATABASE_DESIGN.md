# Hearth Database Design & Schemas

## 1. Multi-Database Architecture
In alignment with bounded-context microservice principles, each service has its own dedicated schema/database. For local development, all databases reside within the single PostgreSQL 16 instance.

### Logical Databases:
1. `hearth_family`
2. `hearth_task`
3. `hearth_decision`
4. `hearth_care`
5. `hearth_notification`

---

## 2. Service Schemas

### 2.1 `hearth_family`
- **`users`**: `id` (UUID PK), `email` (VARCHAR UNIQUE), `password_hash`, `first_name`, `last_name`, `created_at`
- **`families`**: `id` (UUID PK), `name` (VARCHAR), `created_by` (UUID FK to users), `created_at`
- **`family_members`**: `id` (UUID PK), `family_id` (UUID FK), `user_id` (UUID FK), `role` (`ADMIN`, `MEMBER`, `CAREGIVER`, `DEPENDENT`), `status` (`ACTIVE`, `PENDING_INVITE`, `INACTIVE`), `joined_at`
- **`availabilities`**: `id` (UUID PK), `member_id` (UUID FK), `day_of_week` (INT), `start_time` (TIME), `end_time` (TIME), `is_recurring` (BOOLEAN), `specific_date` (DATE NULLABLE), `is_available` (BOOLEAN)

### 2.2 `hearth_task`
- **`tasks`**: `id` (UUID PK), `family_id` (UUID), `title`, `description`, `deadline` (TIMESTAMPTZ), `estimated_duration_minutes` (INT), `priority` (`LOW`, `MEDIUM`, `HIGH`, `URGENT`), `care_criticality` (DOUBLE), `status` (`DRAFT`, `ASSIGNED`, `CONFLICT_FLAGGED`, `ACTIVE`, `IN_PROGRESS`, `COMPLETED`, `UNAVAILABLE`), `created_by` (UUID), `created_at`
- **`task_assignments`**: `id` (UUID PK), `task_id` (UUID FK), `member_id` (UUID), `assigned_at`, `status` (`ASSIGNED`, `ACCEPTED`, `DECLINED`, `REPORTED_UNAVAILABLE`)
- **`task_dependencies`**: `id` (UUID PK), `task_id` (UUID FK), `depends_on_task_id` (UUID FK)
- **`conflicts`**: `id` (UUID PK), `task_id` (UUID FK), `member_id` (UUID), `conflict_type`, `explanation` (TEXT), `resolved` (BOOLEAN), `detected_at`

### 2.3 `hearth_decision`
- **`decision_configurations`**: `id` (UUID PK), `family_id` (UUID), `weights_json` (JSONB), `updated_at`
- **`recommendation_logs`**: `id` (UUID PK), `task_id` (UUID), `candidate_member_id` (UUID), `suitability_score` (DOUBLE), `factors_breakdown` (JSONB), `explanation` (TEXT), `status` (`PENDING_APPROVAL`, `APPROVED`, `REJECTED`), `evaluated_at`

### 2.4 `hearth_care`
- **`patients`**: `id` (UUID PK), `family_id` (UUID), `first_name`, `last_name`, `date_of_birth`, `primary_caregiver_id` (UUID)
- **`health_profiles`**: `id` (UUID PK), `patient_id` (UUID FK UNIQUE), `blood_type`, `allergies_summary`, `dietary_restrictions`, `emergency_notes`, `updated_at`
- **`appointments`**: `id` (UUID PK), `patient_id` (UUID FK), `caregiver_id` (UUID), `title`, `location`, `scheduled_time` (TIMESTAMPTZ), `duration_minutes` (INT), `status`, `notes`
- **`care_documents`**: `id` (UUID PK), `patient_id` (UUID FK), `title`, `document_type`, `storage_path`, `uploaded_by` (UUID), `uploaded_at`
- **`nutrition_goals`**: `id` (UUID PK), `family_id` (UUID), `target_dietary_category`, `budget_limit`, `preferences_json`
- **`grocery_items`**: `id` (UUID PK), `nutrition_goal_id` (UUID FK), `item_name`, `quantity`, `estimated_cost`, `converted_to_task_id` (UUID NULLABLE)

### 2.5 `hearth_notification`
- **`notifications`**: `id` (UUID PK), `user_id` (UUID), `family_id` (UUID), `title`, `message`, `type` (`TASK_ASSIGNED`, `REASSIGNMENT_REQUEST`, `CONFLICT_DETECTED`, `APPOINTMENT_REMINDER`), `is_read` (BOOLEAN), `created_at`
- **`audit_logs`**: `id` (UUID PK), `family_id` (UUID), `actor_user_id` (UUID), `action`, `resource_type`, `resource_id`, `before_state_json` (JSONB), `after_state_json` (JSONB), `timestamp`
