CREATE TABLE IF NOT EXISTS games (
    id TEXT PRIMARY KEY,
    current_version BIGINT NOT NULL CHECK (current_version >= 1),
    snapshot JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS game_players (
    game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    player_id TEXT NOT NULL,
    name TEXT NOT NULL,
    credential_hash TEXT NOT NULL,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (game_id, player_id),
    UNIQUE (game_id, credential_hash)
);

CREATE TABLE IF NOT EXISTS game_events (
    game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    sequence BIGINT NOT NULL CHECK (sequence >= 1),
    event_id TEXT NOT NULL,
    command_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    schema_version SMALLINT NOT NULL CHECK (schema_version = 1),
    occurred_at TIMESTAMPTZ NOT NULL,
    payload JSONB NOT NULL,
    PRIMARY KEY (game_id, sequence),
    UNIQUE (game_id, event_id)
);

CREATE TABLE IF NOT EXISTS game_command_receipts (
    game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    actor_id TEXT NOT NULL,
    command_id TEXT NOT NULL,
    request_fingerprint TEXT NOT NULL,
    resulting_version BIGINT NOT NULL CHECK (resulting_version >= 1),
    projection JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (game_id, actor_id, command_id)
);

CREATE INDEX IF NOT EXISTS game_events_command_idx
    ON game_events (game_id, command_id);
