-- Hearth Microservices Database Initialization Script
-- Initializes separate logical databases for each bounded-context service

CREATE DATABASE hearth_family;
CREATE DATABASE hearth_task;
CREATE DATABASE hearth_decision;
CREATE DATABASE hearth_care;
CREATE DATABASE hearth_notification;

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE hearth_family TO postgres;
GRANT ALL PRIVILEGES ON DATABASE hearth_task TO postgres;
GRANT ALL PRIVILEGES ON DATABASE hearth_decision TO postgres;
GRANT ALL PRIVILEGES ON DATABASE hearth_care TO postgres;
GRANT ALL PRIVILEGES ON DATABASE hearth_notification TO postgres;
