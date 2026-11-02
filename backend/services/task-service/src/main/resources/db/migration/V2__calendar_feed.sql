-- A private calendar address per member (iCalendar subscription for Google Calendar, Apple Calendar,
-- Outlook). Only the SHA-256 of the secret token is kept, so a database leak does not leak the addresses.
create table calendar_feed (
    member_id       uuid primary key,
    family_id       uuid         not null,
    token_hash      varchar(64)  not null unique,
    -- Shown as the calendar's name, e.g. "Hearth – Afsara".
    label           varchar(80)  not null,
    -- The family's time zone when the address was made; recurring events are expanded in it.
    timezone        varchar(60)  not null,
    created_at      timestamptz  not null,
    last_fetched_at timestamptz
);
