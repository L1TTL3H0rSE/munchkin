package postgres

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"reflect"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/leinodev/munchkin/backend/game/internal/application"
	"github.com/leinodev/munchkin/backend/game/internal/game"
)

type Store struct {
	pool *pgxpool.Pool
}

func Open(ctx context.Context, databaseURL string) (*Store, error) {
	config, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return nil, err
	}
	config.MaxConns = 8
	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		return nil, err
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, err
	}
	return &Store{pool: pool}, nil
}

func (store *Store) Close() {
	store.pool.Close()
}

func (store *Store) Ready(ctx context.Context) error {
	return store.pool.Ping(ctx)
}

func (store *Store) Create(
	ctx context.Context,
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
	tx, err := store.pool.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.Serializable})
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	snapshot, err := json.Marshal(state)
	if err != nil {
		return err
	}
	if _, err := tx.Exec(
		ctx,
		`INSERT INTO games (id, current_version, snapshot) VALUES ($1, $2, $3)`,
		state.GameID,
		state.Version,
		snapshot,
	); err != nil {
		if uniqueViolation(err) {
			return application.ErrAlreadyExists
		}
		return err
	}
	if err := insertPlayers(ctx, tx, state); err != nil {
		return err
	}
	if err := insertEvents(ctx, tx, events); err != nil {
		return err
	}
	if err := syncInteractionDeadline(ctx, tx, state); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (store *Store) WithinGame(
	ctx context.Context,
	gameID string,
	callback func(application.Tx) error,
) error {
	tx, err := store.pool.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.Serializable})
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var snapshot []byte
	var currentVersion uint64
	err = tx.QueryRow(
		ctx,
		`SELECT current_version, snapshot FROM games WHERE id = $1 FOR UPDATE`,
		gameID,
	).Scan(&currentVersion, &snapshot)
	if errors.Is(err, pgx.ErrNoRows) {
		return application.ErrNotFound
	}
	if serializationFailure(err) {
		return application.ErrVersionConflict
	}
	if err != nil {
		return err
	}
	var state game.State
	if err := json.Unmarshal(snapshot, &state); err != nil {
		return fmt.Errorf("decode snapshot: %w", err)
	}
	if state.Version != currentVersion {
		return fmt.Errorf("snapshot version %d differs from row %d", state.Version, currentVersion)
	}
	receipts, err := loadReceipts(ctx, tx, gameID)
	if err != nil {
		return err
	}
	transaction := &gameTx{
		ctx:      ctx,
		tx:       tx,
		gameID:   gameID,
		state:    state,
		receipts: receipts,
	}
	if err := callback(transaction); err != nil {
		if serializationFailure(err) {
			return application.ErrVersionConflict
		}
		return err
	}
	if err := tx.Commit(ctx); err != nil {
		if serializationFailure(err) {
			return application.ErrVersionConflict
		}
		return err
	}
	return nil
}

func (store *Store) DueInteractions(
	ctx context.Context,
	now time.Time,
	limit int,
) ([]application.InteractionDeadline, error) {
	if limit <= 0 {
		return nil, nil
	}
	rows, err := store.pool.Query(
		ctx,
		`SELECT game_id, interaction_id, deadline_revision, deadline_at
		 FROM game_interaction_deadlines
		 WHERE deadline_at <= $1
		 ORDER BY deadline_at, game_id
		 LIMIT $2`,
		now,
		limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	candidates := make([]application.InteractionDeadline, 0)
	for rows.Next() {
		var candidate application.InteractionDeadline
		var revision int64
		if err := rows.Scan(
			&candidate.GameID,
			&candidate.InteractionID,
			&revision,
			&candidate.DeadlineAt,
		); err != nil {
			return nil, err
		}
		if revision <= 0 || uint64(revision) > uint64(^uint32(0)) {
			return nil, fmt.Errorf("invalid interaction deadline revision %d", revision)
		}
		candidate.DeadlineRevision = uint32(revision)
		candidates = append(candidates, candidate)
	}
	return candidates, rows.Err()
}

type gameTx struct {
	ctx      context.Context
	tx       pgx.Tx
	gameID   string
	state    game.State
	receipts map[string]application.Receipt
	saved    bool
}

func (transaction *gameTx) State() game.State {
	return transaction.state.Clone()
}

func (transaction *gameTx) FindReceipt(actorID, commandID string) (application.Receipt, bool) {
	receipt, exists := transaction.receipts[receiptKey(actorID, commandID)]
	return receipt, exists
}

func (transaction *gameTx) Save(
	expectedVersion uint64,
	state game.State,
	events []game.EventEnvelope,
	receipt *application.Receipt,
) error {
	if transaction.saved {
		return fmt.Errorf("transaction already saved")
	}
	if transaction.state.Version != expectedVersion || state.Version <= expectedVersion {
		return application.ErrVersionConflict
	}
	replayed, err := game.ReplayFrom(transaction.state, events)
	if err != nil {
		return fmt.Errorf("validate append events: %w", err)
	}
	if !reflect.DeepEqual(replayed, state) {
		return fmt.Errorf("saved snapshot differs from event replay")
	}
	if err := validateReceipt(receipt, state); err != nil {
		return err
	}
	snapshot, err := json.Marshal(state)
	if err != nil {
		return err
	}
	tag, err := transaction.tx.Exec(
		transaction.ctx,
		`UPDATE games
		 SET current_version = $1, snapshot = $2, updated_at = now()
		 WHERE id = $3 AND current_version = $4`,
		state.Version,
		snapshot,
		transaction.gameID,
		expectedVersion,
	)
	if err != nil {
		return err
	}
	if tag.RowsAffected() != 1 {
		return application.ErrVersionConflict
	}
	if err := insertEvents(transaction.ctx, transaction.tx, events); err != nil {
		if uniqueViolation(err) {
			return application.ErrVersionConflict
		}
		return err
	}
	if err := insertPlayers(transaction.ctx, transaction.tx, state); err != nil {
		return err
	}
	if err := syncInteractionDeadline(transaction.ctx, transaction.tx, state); err != nil {
		return err
	}
	if receipt != nil {
		_, err := transaction.tx.Exec(
			transaction.ctx,
			`INSERT INTO game_command_receipts
			 (game_id, actor_id, command_id, request_fingerprint, resulting_version, projection)
			 VALUES ($1, $2, $3, $4, $5, $6)`,
			transaction.gameID,
			receipt.ActorID,
			receipt.CommandID,
			receipt.Fingerprint,
			receipt.Version,
			receipt.Projection,
		)
		if err != nil {
			if uniqueViolation(err) {
				return application.ErrIdempotencyConflict
			}
			return err
		}
	}
	transaction.state = state.Clone()
	transaction.saved = true
	return nil
}

func insertPlayers(ctx context.Context, tx pgx.Tx, state game.State) error {
	for _, player := range state.Players {
		_, err := tx.Exec(
			ctx,
			`INSERT INTO game_players (game_id, player_id, name, credential_hash)
			 VALUES ($1, $2, $3, $4)
			 ON CONFLICT (game_id, player_id) DO UPDATE
			 SET name = EXCLUDED.name, credential_hash = EXCLUDED.credential_hash`,
			state.GameID,
			player.ID,
			player.Name,
			player.CredentialHash,
		)
		if err != nil {
			return err
		}
	}
	return nil
}

func insertEvents(ctx context.Context, tx pgx.Tx, events []game.EventEnvelope) error {
	for _, event := range events {
		_, err := tx.Exec(
			ctx,
			`INSERT INTO game_events
			 (game_id, sequence, event_id, command_id, event_type, schema_version, occurred_at, payload)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
			event.GameID,
			event.Sequence,
			event.EventID,
			event.CommandID,
			event.Type,
			event.Schema,
			event.OccurredAt,
			event.Payload,
		)
		if err != nil {
			return err
		}
	}
	return nil
}

func syncInteractionDeadline(ctx context.Context, tx pgx.Tx, state game.State) error {
	window := state.InteractionWindow
	if window == nil || window.Status != game.InteractionWindowOpen {
		_, err := tx.Exec(
			ctx,
			`DELETE FROM game_interaction_deadlines WHERE game_id = $1`,
			state.GameID,
		)
		return err
	}
	_, err := tx.Exec(
		ctx,
		`INSERT INTO game_interaction_deadlines
		 (game_id, interaction_id, deadline_revision, deadline_at)
		 VALUES ($1, $2, $3, $4)
		 ON CONFLICT (game_id) DO UPDATE
		 SET interaction_id = EXCLUDED.interaction_id,
		     deadline_revision = EXCLUDED.deadline_revision,
		     deadline_at = EXCLUDED.deadline_at`,
		state.GameID,
		window.ID,
		window.DeadlineRevision,
		window.DeadlineAt,
	)
	return err
}

func loadReceipts(
	ctx context.Context,
	tx pgx.Tx,
	gameID string,
) (map[string]application.Receipt, error) {
	rows, err := tx.Query(
		ctx,
		`SELECT actor_id, command_id, request_fingerprint, resulting_version, projection
		 FROM game_command_receipts WHERE game_id = $1`,
		gameID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	receipts := make(map[string]application.Receipt)
	for rows.Next() {
		var receipt application.Receipt
		if err := rows.Scan(
			&receipt.ActorID,
			&receipt.CommandID,
			&receipt.Fingerprint,
			&receipt.Version,
			&receipt.Projection,
		); err != nil {
			return nil, err
		}
		receipts[receiptKey(receipt.ActorID, receipt.CommandID)] = receipt
	}
	return receipts, rows.Err()
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

func uniqueViolation(err error) bool {
	var pgError *pgconn.PgError
	return errors.As(err, &pgError) && pgError.Code == "23505"
}

func serializationFailure(err error) bool {
	var pgError *pgconn.PgError
	return errors.As(err, &pgError) && pgError.Code == "40001"
}
