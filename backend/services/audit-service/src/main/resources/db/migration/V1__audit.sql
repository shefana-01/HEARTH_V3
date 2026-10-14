-- audit-service schema: an append-only activity log. Rows are never updated or deleted by the application.

create table audit_event (
    id           uuid primary key,
    family_id    uuid         not null,
    actor_id     uuid,
    category     varchar(20)  not null,
    action       varchar(120) not null,
    subject      varchar(300) not null,
    before_value varchar(500),
    after_value  varchar(500),
    occurred_at  timestamptz  not null,
    event_type   varchar(100) not null,
    -- The Kafka event this came from. Unique, so a redelivered event cannot be logged twice.
    event_id     uuid         not null unique
);
create index audit_event_family_idx on audit_event (family_id, occurred_at desc);
