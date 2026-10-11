-- care-service schema: appointments, health notes, shopping list, documents, outbox, consumer bookkeeping.

create table appointment (
    id               uuid primary key,
    family_id        uuid          not null,
    title            varchar(120)  not null,
    specialty        varchar(80)   not null default '',
    start_at         timestamptz   not null,
    duration_min     integer       not null check (duration_min between 5 and 1440),
    provider         varchar(120)  not null default '',
    location         varchar(200)  not null default '',
    -- Who the visit is for: a member or someone the family looks after. Both live in family-service, so no foreign key.
    for_id           uuid          not null,
    escort_id        uuid,
    visibility       varchar(10)   not null check (visibility in ('family', 'private')),
    prep             jsonb         not null,
    note             varchar(1000) not null default '',
    created_by_id    uuid          not null,
    created_at       timestamptz   not null,
    -- Set when the "starts within the hour" reminder went out; cleared when the visit is moved.
    reminder_sent_at timestamptz,
    -- The family's time zone when the visit was saved, so a reminder can say "3:00 PM" without asking family-service.
    timezone         varchar(60)   not null default 'UTC'
);
create index appointment_family_idx on appointment (family_id, start_at);
create index appointment_for_idx on appointment (family_id, for_id);
create index appointment_reminder_idx on appointment (start_at) where reminder_sent_at is null;

-- One person's health notes. A member owns theirs; the family keeps a dependant's. Not a medical record: see HealthService.
create table health_profile (
    family_id   uuid        not null,
    person_id   uuid        not null,
    conditions  jsonb       not null default '[]',
    goals       jsonb       not null default '[]',
    avoid       jsonb       not null default '[]',
    preferences jsonb       not null default '[]',
    notes       text        not null default '',
    shared      boolean     not null,
    updated_at  timestamptz not null,
    primary key (family_id, person_id)
);

create table grocery_item (
    id              uuid primary key,
    family_id       uuid             not null,
    name            varchar(120)     not null,
    food_group      varchar(60)      not null default 'Other',
    quantity        integer          not null check (quantity >= 1),
    unit            varchar(60)      not null default 'item',
    estimated_price double precision not null default 0,
    status          varchar(20)      not null check (status in ('needed', 'in-pantry')),
    food_id         varchar(60),
    -- People the item was added for (only people whose health notes may be named on the shared list).
    for_ids         jsonb            not null default '[]',
    reason          varchar(120),
    added_by_id     uuid,
    created_at      timestamptz      not null
);
create index grocery_item_family_idx on grocery_item (family_id, created_at);
create unique index grocery_item_food_idx on grocery_item (family_id, food_id) where food_id is not null;

create table care_document (
    id             uuid primary key,
    family_id      uuid         not null,
    title          varchar(160) not null,
    category       varchar(40)  not null check (category in (
        'Medical report', 'Prescription', 'Lab result', 'Insurance', 'ID & legal', 'School & work', 'Bills & receipts', 'Other')),
    file_name      varchar(255) not null,
    content_type   varchar(120) not null,
    size_kb        integer      not null,
    storage_key    varchar(200) not null,
    uploaded_at    timestamptz  not null,
    uploaded_by_id uuid         not null,
    -- Who the document is about (a member or a dependant); null = the household.
    owner_id       uuid,
    access         varchar(20)  not null check (access in ('family', 'restricted')),
    allowed_ids    jsonb        not null default '[]',
    appointment_id uuid
);
create index care_document_family_idx on care_document (family_id, uploaded_at desc);

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
