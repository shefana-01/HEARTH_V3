-- task-service schema: tasks, personal events, time away, the event outbox and consumer bookkeeping.
-- Members, dependants and appointments live in other services, so their ids have no foreign keys here.

create table task (
    id                    uuid primary key,
    family_id             uuid          not null,
    title                 varchar(120)  not null,
    notes                 varchar(2000) not null default '',
    category              varchar(20)   not null check (category in (
        'medication', 'health', 'meals', 'errands', 'household', 'childcare', 'transport', 'study', 'work', 'exercise', 'family', 'other')),
    priority              varchar(20)   not null check (priority in ('routine', 'important', 'urgent')),
    status                varchar(20)   not null check (status in ('scheduled', 'completed', 'cancelled')),
    start_at              timestamptz   not null,
    duration_min          integer       not null check (duration_min between 5 and 1440),
    assignee_id           uuid,
    -- Who it is for (a member or someone the family looks after), if anyone in particular.
    for_id                uuid,
    visibility            varchar(10)   not null check (visibility in ('family', 'private')),
    created_by_id         uuid          not null,
    created_at            timestamptz   not null,
    appointment_id        uuid,
    completed_at          timestamptz,
    completed_by_id       uuid,
    reminder              boolean       not null default false,
    -- When the "starts in 15 minutes" reminder went out; cleared when the task is moved.
    reminder_sent_at      timestamptz,
    -- The owner chose to keep the plan despite this kind of clash.
    acknowledged_conflict varchar(30),
    -- The family's time zone when the task was saved, so reminders can say "5:00 PM".
    timezone              varchar(60)   not null default 'UTC',
    version               bigint        not null default 0
);
create index task_family_idx on task (family_id, start_at);
create index task_assignee_idx on task (family_id, assignee_id);
create index task_reminder_idx on task (start_at) where reminder and reminder_sent_at is null and status = 'scheduled';

-- Classes, work shifts and anything else on one person's own calendar. Weekly ones are stored once.
create table personal_event (
    id           uuid primary key,
    family_id    uuid         not null,
    member_id    uuid         not null,
    title        varchar(120) not null,
    kind         varchar(20)  not null check (kind in ('class', 'work', 'personal', 'travel', 'other')),
    start_at     timestamptz  not null,
    duration_min integer      not null check (duration_min between 5 and 1440),
    repeat       varchar(10)  not null check (repeat in ('none', 'weekly')),
    -- Monday to Sunday, for weekly events.
    days         jsonb        not null,
    until_at     timestamptz,
    location     varchar(200) not null default '',
    visibility   varchar(10)  not null check (visibility in ('details', 'busy')),
    created_at   timestamptz  not null
);
create index personal_event_member_idx on personal_event (family_id, member_id);

-- Time someone told the family they cannot cover.
create table unavailability (
    id         uuid primary key,
    family_id  uuid          not null,
    member_id  uuid          not null,
    start_at   timestamptz   not null,
    end_at     timestamptz   not null,
    reason     varchar(60)   not null default '',
    note       varchar(500)  not null default '',
    created_at timestamptz   not null,
    check (end_at > start_at)
);
create index unavailability_family_idx on unavailability (family_id, start_at);

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
