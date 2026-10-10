create table notification (
    id                  uuid primary key,
    family_id           uuid         not null,
    type                varchar(30)  not null,
    message             varchar(500) not null,
    href                varchar(200),
    actor_member_id     uuid,
    recipient_member_id uuid,
    created_at          timestamptz  not null,
    event_id            uuid         not null unique
);
create index notification_family_idx on notification (family_id, created_at desc);

create table notification_state (
    id              uuid primary key,
    notification_id uuid    not null references notification (id) on delete cascade,
    member_id       uuid    not null,
    marked_read     boolean not null default false,
    dismissed       boolean not null default false,
    unique (notification_id, member_id)
);
create index notification_state_member_idx on notification_state (member_id);

-- Used by hearth-common ProcessedEvents so a repeated Kafka delivery is skipped.
create table processed_event (
    event_id     uuid primary key,
    processed_at timestamptz not null
);
