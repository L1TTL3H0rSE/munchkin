CREATE TABLE IF NOT EXISTS game_interaction_deadlines (
    game_id TEXT PRIMARY KEY REFERENCES games(id) ON DELETE CASCADE,
    interaction_id TEXT NOT NULL,
    deadline_revision BIGINT NOT NULL CHECK (deadline_revision >= 1),
    deadline_at TIMESTAMPTZ NOT NULL,
    UNIQUE (game_id, interaction_id, deadline_revision)
);

CREATE INDEX IF NOT EXISTS game_interaction_deadlines_due_idx
    ON game_interaction_deadlines (deadline_at, game_id);
