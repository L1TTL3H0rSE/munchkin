package memory

import (
	"context"
	"fmt"
	"reflect"
	"sync"

	"github.com/leinodev/munchkin/backend/game/internal/application"
	"github.com/leinodev/munchkin/backend/game/internal/game"
)

type record struct {
	state    game.State
	events   []game.EventEnvelope
	receipts map[string]application.Receipt
}

type Store struct {
	mu      sync.Mutex
	records map[string]record
}

func New() *Store {
	return &Store{records: make(map[string]record)}
}

func (store *Store) Create(
	_ context.Context,
	state game.State,
	events []game.EventEnvelope,
) error {
	replayed, err := game.Replay(events)
	if err != nil {
		return fmt.Errorf("validate create events: %w", err)
	}
	if !reflect.DeepEqual(replayed, state) {
		return fmt.Errorf("create snapshot differs from event replay")
	}
	store.mu.Lock()
	defer store.mu.Unlock()
	if _, exists := store.records[state.GameID]; exists {
		return application.ErrAlreadyExists
	}
	store.records[state.GameID] = record{
		state:    state.Clone(),
		events:   append([]game.EventEnvelope(nil), events...),
		receipts: make(map[string]application.Receipt),
	}
	return nil
}

func (store *Store) WithinGame(
	_ context.Context,
	gameID string,
	callback func(application.Tx) error,
) error {
	store.mu.Lock()
	defer store.mu.Unlock()
	current, exists := store.records[gameID]
	if !exists {
		return application.ErrNotFound
	}
	tx := &transaction{
		gameID:          gameID,
		originalVersion: current.state.Version,
		record:          cloneRecord(current),
	}
	if err := callback(tx); err != nil {
		return err
	}
	store.records[gameID] = tx.record
	return nil
}

type transaction struct {
	gameID          string
	originalVersion uint64
	record          record
	saved           bool
}

func (tx *transaction) State() game.State {
	return tx.record.state.Clone()
}

func (tx *transaction) FindReceipt(actorID, commandID string) (application.Receipt, bool) {
	receipt, exists := tx.record.receipts[receiptKey(actorID, commandID)]
	return receipt, exists
}

func (tx *transaction) Save(
	expectedVersion uint64,
	state game.State,
	events []game.EventEnvelope,
	receipt *application.Receipt,
) error {
	if tx.saved {
		return fmt.Errorf("transaction already saved")
	}
	if tx.originalVersion != expectedVersion || tx.record.state.Version != expectedVersion {
		return application.ErrVersionConflict
	}
	if state.GameID != tx.gameID || state.Version <= expectedVersion {
		return fmt.Errorf("invalid state append")
	}
	replayed, err := game.ReplayFrom(tx.record.state, events)
	if err != nil {
		return fmt.Errorf("validate append events: %w", err)
	}
	if !reflect.DeepEqual(replayed, state) {
		return fmt.Errorf("saved snapshot differs from event replay")
	}
	if err := validateReceipt(receipt, state); err != nil {
		return err
	}
	tx.record.state = state.Clone()
	tx.record.events = append(tx.record.events, events...)
	if receipt != nil {
		key := receiptKey(receipt.ActorID, receipt.CommandID)
		if _, exists := tx.record.receipts[key]; exists {
			return application.ErrIdempotencyConflict
		}
		tx.record.receipts[key] = *receipt
	}
	tx.saved = true
	return nil
}

func cloneRecord(source record) record {
	clone := record{
		state:    source.state.Clone(),
		events:   append([]game.EventEnvelope(nil), source.events...),
		receipts: make(map[string]application.Receipt, len(source.receipts)),
	}
	for key, receipt := range source.receipts {
		clone.receipts[key] = receipt
	}
	return clone
}

func validateReceipt(receipt *application.Receipt, state game.State) error {
	if receipt == nil {
		return nil
	}
	if receipt.ActorID == "" ||
		receipt.CommandID == "" ||
		receipt.Fingerprint == "" ||
		receipt.Version != state.Version ||
		len(receipt.Projection) == 0 {
		return fmt.Errorf("invalid command receipt")
	}
	return nil
}

func receiptKey(actorID, commandID string) string {
	return actorID + "\x00" + commandID
}
