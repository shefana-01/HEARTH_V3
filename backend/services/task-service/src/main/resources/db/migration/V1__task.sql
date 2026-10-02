-- V1__task.sql
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY,
    family_id UUID NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    deadline TIMESTAMP WITH TIME ZONE NOT NULL,
    estimated_duration_minutes INT NOT NULL DEFAULT 30,
    priority VARCHAR(50) NOT NULL DEFAULT 'MEDIUM',
    care_criticality DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    status VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
    visibility VARCHAR(50) NOT NULL DEFAULT 'SHARED',
    assigned_member_id UUID,
    created_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS personal_events (
    id UUID PRIMARY KEY,
    family_id UUID NOT NULL,
    member_id UUID NOT NULL,
    title VARCHAR(255) NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    weekly_recurrence BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS unavailability (
    id UUID PRIMARY KEY,
    member_id UUID NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    reason VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS outbox_event (
    id UUID PRIMARY KEY,
    aggregate_type VARCHAR(255) NOT NULL,
    aggregate_id UUID NOT NULL,
    event_type VARCHAR(255) NOT NULL,
    payload TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
