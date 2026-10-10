-- Tracks whether the family map of a family in Neo4j is up to date.
-- Every relevant Kafka event raises "version"; a rebuild records the version it was built from.
create table graph_state (
    family_id     uuid primary key,
    version       bigint not null default 0,
    built_version bigint not null default -1,
    built_at      timestamptz
);
