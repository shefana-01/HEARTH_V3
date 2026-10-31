-- ai-service schema: who agreed to use AI help, and what it cost (for fair-use limits).

-- A member's agreement that the text they type, their tasks' titles and family first names may be sent to
-- the AI provider. Without a row here every AI request is refused.
create table ai_consent (
    member_id  uuid primary key,
    family_id  uuid        not null,
    granted_at timestamptz not null
);

-- One row per AI request that reached the provider.
create table ai_usage (
    id            uuid primary key,
    family_id     uuid        not null,
    member_id     uuid        not null,
    feature       varchar(30) not null check (feature in ('quick-add', 'plan', 'draft')),
    input_tokens  integer     not null check (input_tokens >= 0),
    output_tokens integer     not null check (output_tokens >= 0),
    created_at    timestamptz not null
);
create index ai_usage_member_idx on ai_usage (member_id, created_at);
create index ai_usage_family_idx on ai_usage (family_id, created_at);
