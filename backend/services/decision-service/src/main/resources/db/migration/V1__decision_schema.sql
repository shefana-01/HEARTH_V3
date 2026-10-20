-- decision-service schema: handover requests, the event outbox and consumer bookkeeping.
-- Everything the engine scores (tasks, events, visits, members) is read from the services that own it.

create table reassignment_request (
    id                 uuid primary key,
    family_id          uuid         not null,
    task_id            uuid         not null,
    -- Who is giving the task up (null if nobody had it).
    from_member_id     uuid,
    reason             varchar(200) not null,
    note               varchar(500) not null default '',
    created_at         timestamptz  not null,
    created_by_id      uuid         not null,
    status             varchar(20)  not null check (status in ('open', 'approved', 'cancelled')),
    approved_member_id uuid,
    resolved_at        timestamptz,
    version            bigint       not null default 0
);
create index reassignment_request_family_idx on reassignment_request (family_id, created_at desc);
-- At most one open request per task: asking again returns the one already open.
create unique index reassignment_request_open_idx on reassignment_request (family_id, task_id) where status = 'open';

create table outbox_event (
    id           uuid primary key,
    topic        varchar(100) not null,
    event_key    varchar(100) not null,
    event_type   varchar(100) not null,
    payload      text         not null,
    created_at   timestamptz  not null,
    published_at timestamptz
);
create index outbox_event_pending_idx on outbox_event (created_at) where published_at is null;

create table processed_event (
    event_id     uuid primary key,
    processed_at timestamptz not null
);
