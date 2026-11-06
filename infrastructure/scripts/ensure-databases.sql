-- Creates every Hearth service database that does not exist yet. Safe to run any number of times.
-- docker-compose.yml runs it (db-setup) before the services start, so a data volume created before a
-- service was added still gets that service's database. Each service then creates its tables with Flyway.

SELECT format('CREATE DATABASE %I', name)
FROM unnest(ARRAY[
    'hearth_family',
    'hearth_task',
    'hearth_decision',
    'hearth_care',
    'hearth_notification',
    'hearth_audit',
    'hearth_ai'
]) AS name
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = name)
\gexec
