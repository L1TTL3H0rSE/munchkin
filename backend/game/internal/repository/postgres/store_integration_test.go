package postgres

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"testing"

	"github.com/leinodev/munchkin/backend/game/internal/application"
	"github.com/leinodev/munchkin/backend/game/internal/game"
)

func TestPostgresServiceContract(t *testing.T) {
	databaseURL := os.Getenv("TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("TEST_DATABASE_URL is not configured")
	}
	ctx := context.Background()
	store, err := Open(ctx, databaseURL)
	if err != nil {
		t.Fatal(err)
	}
	defer store.Close()
	if err := store.Migrate(ctx, "../../../migrations/000001_game.up.sql"); err != nil {
		t.Fatal(err)
	}
	if _, err := store.pool.Exec(
		ctx,
		"TRUNCATE game_command_receipts, game_events, game_players, games CASCADE",
	); err != nil {
		t.Fatal(err)
	}

	service := application.NewService(
		store,
		postgresPack(t),
		application.SystemClock{},
		application.NoopPublisher{},
	)
	owner, err := service.CreateLobby(ctx, "Alice")
	if err != nil {
		t.Fatal(err)
	}
	joined, err := service.JoinLobby(
		ctx,
		owner.GameID,
		"postgres-join-credential",
		"postgres-join",
		owner.Projection.Version,
		"Bob",
	)
	if err != nil {
		t.Fatal(err)
	}
	replayedJoin, err := service.JoinLobby(
		ctx,
		owner.GameID,
		"postgres-join-credential",
		"postgres-join",
		owner.Projection.Version,
		"Bob",
	)
	if err != nil || replayedJoin.PlayerID != joined.PlayerID {
		t.Fatalf("join replay: result=%#v err=%v", replayedJoin, err)
	}
	started, err := service.Execute(
		ctx,
		owner.GameID,
		owner.Credential,
		"postgres-start",
		joined.Projection.Version,
		game.Command{Type: game.CommandStart},
	)
	if err != nil {
		t.Fatal(err)
	}

	type outcome struct {
		commandID string
		result    application.CommandResult
		err       error
	}
	release := make(chan struct{})
	results := make(chan outcome, 2)
	for _, commandID := range []string{"postgres-race-a", "postgres-race-b"} {
		go func(id string) {
			<-release
			result, err := service.Execute(
				ctx,
				owner.GameID,
				owner.Credential,
				id,
				started.Version,
				game.Command{Type: game.CommandFinishSetup},
			)
			results <- outcome{commandID: id, result: result, err: err}
		}(commandID)
	}
	close(release)

	successes := 0
	conflicts := 0
	var successful outcome
	for range 2 {
		result := <-results
		switch {
		case result.err == nil:
			successes++
			successful = result
		case errors.Is(result.err, application.ErrVersionConflict):
			conflicts++
		default:
			t.Fatalf("unexpected concurrent append error: %v", result.err)
		}
	}
	if successes != 1 || conflicts != 1 {
		t.Fatalf("concurrent append: successes=%d conflicts=%d", successes, conflicts)
	}
	replayedCommand, err := service.Execute(
		ctx,
		owner.GameID,
		owner.Credential,
		successful.commandID,
		started.Version,
		game.Command{Type: game.CommandFinishSetup},
	)
	if err != nil || !replayedCommand.Replayed ||
		replayedCommand.Version != successful.result.Version {
		t.Fatalf("command replay: result=%#v err=%v", replayedCommand, err)
	}

	before, err := service.Get(ctx, owner.GameID, owner.Credential)
	if err != nil {
		t.Fatal(err)
	}
	err = store.WithinGame(ctx, owner.GameID, func(tx application.Tx) error {
		state := tx.State()
		next := state.Clone()
		next.Version++
		return tx.Save(state.Version, next, []game.EventEnvelope{{
			GameID: owner.GameID, Sequence: next.Version,
		}}, nil)
	})
	if err == nil {
		t.Fatal("corrupt append unexpectedly committed")
	}
	after, err := service.Get(ctx, owner.GameID, owner.Credential)
	if err != nil {
		t.Fatal(err)
	}
	if after.Version != before.Version {
		t.Fatalf("failed transaction changed version: before=%d after=%d", before.Version, after.Version)
	}

	var eventCount, receiptCount int
	if err := store.pool.QueryRow(
		ctx,
		"SELECT count(*) FROM game_events WHERE game_id = $1",
		owner.GameID,
	).Scan(&eventCount); err != nil {
		t.Fatal(err)
	}
	if err := store.pool.QueryRow(
		ctx,
		"SELECT count(*) FROM game_command_receipts WHERE game_id = $1",
		owner.GameID,
	).Scan(&receiptCount); err != nil {
		t.Fatal(err)
	}
	if eventCount != 4 || receiptCount != 3 {
		t.Fatalf("persisted counts: events=%d receipts=%d", eventCount, receiptCount)
	}
}

func postgresPack(t *testing.T) game.Pack {
	t.Helper()
	pack, err := game.LoadPack(filepath.Join(
		"..",
		"..",
		"..",
		"..",
		"..",
		"content",
		"sets",
		"demo",
		"cards.json",
	))
	if err != nil {
		t.Fatal(err)
	}
	return pack
}
