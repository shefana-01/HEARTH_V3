-- Web Push: the browsers and phones that asked for notifications, and the messages waiting to go to them.

create table push_subscription (
    id           uuid primary key,
    family_id    uuid          not null,
    member_id    uuid          not null,
    -- The push service address the browser gave; unique per browser profile.
    endpoint     varchar(1000) not null unique,
    p256dh       varchar(200)  not null,
    auth         varchar(100)  not null,
    user_agent   varchar(300),
    created_at   timestamptz   not null,
    last_used_at timestamptz
);
create index push_subscription_member_idx on push_subscription (family_id, member_id);

-- An outbox for pushes: written in the same transaction as the notification, sent by PushRelay.
create table push_message (
    id              uuid primary key,
    subscription_id uuid          not null references push_subscription (id) on delete cascade,
    payload         varchar(3000) not null,
    created_at      timestamptz   not null,
    attempts        integer       not null default 0,
    next_attempt_at timestamptz   not null,
    last_error      varchar(300)
);
create index push_message_due_idx on push_message (next_attempt_at);
