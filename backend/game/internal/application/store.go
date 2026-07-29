package application

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/leinodev/munchkin/backend/game/internal/game"
)

var (
	ErrNotFound            = errors.New("game not found")
	ErrVersionConflict     = errors.New("version conflict")
	ErrIdempotencyConflict = errors.New("idempotency key reused")
	ErrUnauthorized        = errors.New("invalid game credential")
	ErrAlreadyExists       = errors.New("game already exists")
)

type Receipt struct {
	ActorID     string          `json:"actor_id"`
	CommandID   string          `json:"command_id"`
	Fingerprint string          `json:"fingerprint"`
	Version     uint64          `json:"version"`
	Projection  json.RawMessage `json:"projection"`
}

type Tx interface {
	State() game.State
	FindReceipt(actorID, commandID string) (Receipt, bool)
	Save(
		expectedVersion uint64,
		state game.State,
		events []game.EventEnvelope,
		receipt *Receipt,
	) error
}

type Store interface {
	Create(context.Context, game.State, []game.EventEnvelope) error
	WithinGame(context.Context, string, func(Tx) error) error
}

type Clock interface {
	Now() int64
}

type Publisher interface {
	Publish(context.Context, Invalidation) error
}

type Invalidation struct {
	Type       string `json:"type"`
	OccurredAt string `json:"occurred_at"`
	GameID     string `json:"game_id"`
	Version    uint64 `json:"version"`
	Reason     string `json:"reason"`
}
