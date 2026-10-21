-- Runs once, when the PostgreSQL container starts with an empty data volume.
-- One database per service: each service owns its data and reaches the others only through their APIs and
-- events. Each service creates its own tables with Flyway when it starts.

CREATE DATABASE hearth_family;
CREATE DATABASE hearth_task;
CREATE DATABASE hearth_decision;
CREATE DATABASE hearth_care;
CREATE DATABASE hearth_notification;
CREATE DATABASE hearth_audit;
