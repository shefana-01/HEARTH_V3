-- family-service schema: accounts and sign-in, families, members, people the family looks after,
-- signing keys for the JWTs every service checks, outgoing email and the event outbox.

create table account (
    id                 uuid primary key,
    email              varchar(254) not null,
    password_hash      varchar(100) not null,
    name               varchar(80)  not null,
    phone              varchar(30),
    about              varchar(500) not null default '',
    -- A small profile picture as a data URL (resized in the browser).
    photo              text,
    email_verified     boolean      not null default false,
    whatsapp_alerts    boolean      not null default false,
    failed_sign_ins    integer      not null default 0,
    locked_until       timestamptz,
    created_at         timestamptz  not null,
    version            bigint       not null default 0
);
-- Email addresses are compared without regard to case.
create unique index account_email_idx on account (lower(email));

create table family (
    id                    uuid primary key,
    name                  varchar(80)   not null,
    location              varchar(120)  not null default '',
    timezone              varchar(60)   not null default 'UTC',
    weekly_grocery_budget numeric(12, 2),
    invite_code           varchar(20)   not null unique,
    created_at            timestamptz   not null,
    version               bigint        not null default 0
);

create table member (
    id                uuid primary key,
    family_id         uuid         not null references family (id) on delete cascade,
    -- Null while the person has been invited but has not joined with their own account yet.
    account_id        uuid unique references account (id),
    name              varchar(80)  not null,
    email             varchar(254) not null,
    relation          varchar(60)  not null default '',
    role              varchar(20)  not null check (role in ('lead', 'contributor', 'observer')),
    status            varchar(20)  not null check (status in ('active', 'invited')),
    focus             varchar(200) not null default '',
    phone             varchar(30),
    skills            jsonb        not null default '[]',
    availability      jsonb        not null,
    access_schedule   boolean      not null default true,
    access_medical    boolean      not null default false,
    access_documents  boolean      not null default false,
    status_text       varchar(80),
    status_until      timestamptz,
    status_updated_at timestamptz,
    joined_at         timestamptz  not null,
    version           bigint       not null default 0
);
create index member_family_idx on member (family_id);
create unique index member_family_email_idx on member (family_id, lower(email));

create table dependant (
    id         uuid primary key,
    family_id  uuid          not null references family (id) on delete cascade,
    name       varchar(80)   not null,
    relation   varchar(60)   not null default '',
    birth_year integer,
    notes      varchar(1000) not null default '',
    created_at timestamptz   not null
);
create index dependant_family_idx on dependant (family_id, created_at);

-- Long-lived sign-in tokens. Only a hash is stored; each one is used once and replaced ("rotation").
create table refresh_token (
    id         uuid primary key,
    account_id uuid        not null references account (id) on delete cascade,
    token_hash varchar(64) not null unique,
    expires_at timestamptz not null,
    revoked_at timestamptz,
    created_at timestamptz not null
);
create index refresh_token_account_idx on refresh_token (account_id);

-- Links sent by email (confirm the address, reset the password). Only a hash is stored.
create table one_time_token (
    id         uuid primary key,
    account_id uuid        not null references account (id) on delete cascade,
    purpose    varchar(30) not null check (purpose in ('verify-email', 'password-reset')),
    token_hash varchar(64) not null unique,
    expires_at timestamptz not null,
    used_at    timestamptz,
    created_at timestamptz not null
);

-- RSA key pair that signs the access tokens. Created on first start; its public half is served as a JWKS.
create table signing_key (
    kid         varchar(40) primary key,
    private_key text        not null,
    public_key  text        not null,
    created_at  timestamptz not null
);

-- Email waiting to be sent, written in the same transaction as the change that needs it.
create table email_outbox (
    id         uuid primary key,
    to_address varchar(254)  not null,
    subject    varchar(200)  not null,
    body       text          not null,
    created_at timestamptz   not null,
    sent_at    timestamptz,
    attempts   integer       not null default 0,
    last_error varchar(500)
);
create index email_outbox_pending_idx on email_outbox (created_at) where sent_at is null;

-- hearth-common EventPublisher / OutboxRelay.
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
