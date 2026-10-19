-- family-service schema: accounts, families, dependants, members, local sign-in data, outbox.

create table account (
    id              uuid primary key,
    subject         varchar(100) not null unique,
    email           varchar(255) not null,
    name            varchar(80)  not null,
    phone           varchar(40),
    about           varchar(400) not null default '',
    photo           text,
    whatsapp_alerts boolean      not null default false,
    created_at      timestamptz  not null
);
create unique index account_email_key on account (lower(email));

create table family (
    id                    uuid primary key,
    name                  varchar(80)  not null,
    location              varchar(120) not null default '',
    timezone              varchar(60)  not null default 'UTC',
    invite_code           varchar(20)  not null unique,
    weekly_grocery_budget double precision check (weekly_grocery_budget >= 0),
    created_at            timestamptz  not null
);

-- People the family looks after who do not use Hearth themselves (a child, a grandparent). A family may have none.
create table dependant (
    id         uuid primary key,
    family_id  uuid         not null references family (id) on delete cascade,
    name       varchar(80)  not null,
    relation   varchar(60)  not null default '',
    birth_year integer      check (birth_year between 1900 and 2100),
    notes      text         not null default '',
    created_at timestamptz  not null
);
create index dependant_family_idx on dependant (family_id, created_at);

create table family_member (
    id                uuid primary key,
    family_id         uuid         not null references family (id) on delete cascade,
    account_id        uuid unique references account (id) on delete set null,
    name              varchar(80)  not null,
    relation          varchar(60)  not null default '',
    role              varchar(20)  not null check (role in ('lead', 'contributor', 'observer')),
    focus             varchar(120) not null default '',
    email             varchar(255) not null,
    phone             varchar(40),
    photo             text,
    status            varchar(20)  not null check (status in ('active', 'invited')),
    skills            jsonb        not null default '[]',
    availability      jsonb        not null,
    access_schedule   boolean      not null default true,
    access_medical    boolean      not null default false,
    access_documents  boolean      not null default false,
    -- The short "what I'm up to" line. Text, expiry and time of writing are set and cleared together.
    status_text       varchar(80),
    status_until      timestamptz,
    status_updated_at timestamptz,
    joined_at         timestamptz  not null,
    constraint family_member_status_note_check check (
        (status_text is null and status_until is null and status_updated_at is null)
        or (status_text is not null and status_text <> '' and status_updated_at is not null))
);
create index family_member_family_idx on family_member (family_id);
create unique index family_member_email_key on family_member (family_id, lower(email));

-- Local identity provider (used unless the "keycloak" profile is active).
create table local_credential (
    subject       varchar(100) primary key,
    email         varchar(255) not null,
    password_hash varchar(100) not null
);
create unique index local_credential_email_key on local_credential (lower(email));

create table refresh_token (
    id         uuid primary key,
    subject    varchar(100) not null,
    token_hash varchar(64)  not null unique,
    expires_at timestamptz  not null,
    revoked    boolean      not null default false,
    created_at timestamptz  not null
);
create index refresh_token_subject_idx on refresh_token (subject);

create table signing_key (
    kid         varchar(64) primary key,
    private_key text        not null,
    public_key  text        not null,
    created_at  timestamptz not null
);

-- Transactional outbox: events waiting to be sent to Kafka.
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
