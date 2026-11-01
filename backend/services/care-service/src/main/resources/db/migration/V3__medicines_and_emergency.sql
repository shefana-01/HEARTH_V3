-- Medicine schedules, the doses taken or missed, and the emergency details on a person's emergency card.
-- Same visibility as health notes: the person themselves, and family members with medical access
-- (for a member, only if they share their health notes).

create table medication (
    id           uuid primary key,
    family_id    uuid         not null,
    -- A member or someone the family looks after.
    person_id    uuid         not null,
    name         varchar(120) not null,
    dose         varchar(60)  not null default '',
    instructions varchar(300) not null default '',
    -- Local times of day, "HH:mm", one to six of them.
    times        jsonb        not null,
    -- Monday to Sunday.
    days         jsonb        not null,
    start_date   date         not null,
    end_date     date,
    -- The member who helps with it (needed for reminders about someone who does not use Hearth).
    carer_id     uuid,
    reminders    boolean      not null default true,
    active       boolean      not null default true,
    -- The family's time zone when saved: doses are at local times in it.
    timezone     varchar(60)  not null,
    created_by   uuid         not null,
    created_at   timestamptz  not null,
    updated_at   timestamptz  not null,
    version      bigint       not null default 0,
    check (end_date is null or end_date >= start_date)
);
create index medication_family_idx on medication (family_id, person_id);
create index medication_active_idx on medication (active) where active;

create table medication_dose (
    id            uuid primary key,
    family_id     uuid        not null,
    medication_id uuid        not null references medication (id) on delete cascade,
    scheduled_at  timestamptz not null,
    status        varchar(10) not null check (status in ('taken', 'skipped', 'missed')),
    -- null when Hearth recorded a missed dose itself.
    recorded_by   uuid,
    recorded_at   timestamptz not null,
    unique (medication_id, scheduled_at)
);
create index medication_dose_family_idx on medication_dose (family_id, scheduled_at);

-- Which "time for your medicine" and "missed" alerts went out, so each is sent once.
create table medication_alert (
    medication_id uuid        not null references medication (id) on delete cascade,
    scheduled_at  timestamptz not null,
    kind          varchar(10) not null check (kind in ('due', 'missed')),
    sent_at       timestamptz not null,
    primary key (medication_id, scheduled_at, kind)
);

create table emergency_info (
    family_id    uuid         not null,
    person_id    uuid         not null,
    blood_group  varchar(5)   not null default '',
    allergies    varchar(500) not null default '',
    doctor_name  varchar(120) not null default '',
    doctor_phone varchar(30)  not null default '',
    hospital     varchar(200) not null default '',
    notes        varchar(1000) not null default '',
    updated_at   timestamptz  not null,
    updated_by   uuid         not null,
    primary key (family_id, person_id)
);
