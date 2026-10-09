-- Chat and task comments. channel is 'family' or 'task:<id>'.
-- author_id is null for lines Hearth writes itself; kind is 'text' or 'system'.
create table message (
    id         uuid primary key,
    family_id  uuid          not null,
    channel    varchar(80)   not null,
    author_id  uuid,
    kind       varchar(20)   not null default 'text',
    body       varchar(2000) not null,
    created_at timestamptz   not null
);
create index message_channel_idx on message (family_id, channel, created_at);

-- One row per family, member and channel: when that member last read it.
create table channel_read (
    id           uuid primary key,
    family_id    uuid         not null,
    member_id    uuid         not null,
    channel      varchar(80)  not null,
    last_read_at timestamptz  not null,
    unique (family_id, member_id, channel)
);
