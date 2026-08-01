package postgres

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"testing"
	"time"

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
	if err := store.Migrate(
		ctx,
		"../../../migrations/000001_game.up.sql",
	); err != nil {
		t.Fatal(err)
	}
	if err := store.Migrate(ctx, "../../../migrations"); err != nil {
		t.Fatal(err)
	}
	if _, err := store.pool.Exec(
		ctx,
		"TRUNCATE game_interaction_deadlines, game_command_receipts, game_events, game_players, games CASCADE",
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

	runtimeClock := &postgresClock{
		value: time.Date(2026, time.July, 30, 21, 0, 0, 0, time.UTC),
	}
	runtimeService := application.NewService(
		store,
		postgresPack(t),
		runtimeClock,
		application.NoopPublisher{},
	)
	initiatorID := before.Turn.PlayerID
	participantID := owner.PlayerID
	participantCredential := owner.Credential
	if participantID == initiatorID {
		participantID = joined.PlayerID
		participantCredential = joined.Credential
	}
	interactionID, err := runtimeService.OpenInteraction(
		ctx,
		owner.GameID,
		"postgres-interaction-open",
		before.Version,
		application.InteractionOpenSpec{
			Kind: game.InteractionKindCombatResponse,
			Parent: game.InteractionParent{
				Phase:       before.Turn.Phase,
				SubjectKind: game.InteractionSubjectTurn,
				SubjectID:   before.Turn.PlayerID,
			},
			InitiatorActorID:  initiatorID,
			EligibilityPolicy: game.InteractionEligibilityPublicPredicate,
			AllowedIntents: []game.InteractionIntent{
				game.InteractionIntentPass,
				game.InteractionIntentRespond,
			},
			Participants: []application.InteractionParticipant{{
				ActorID:       participantID,
				Requirement:   game.InteractionResponseOptional,
				TimeoutIntent: game.InteractionIntentPass,
			}},
			DeadlinePolicy: game.CollectiveInteractionDeadlinePolicy(),
		},
	)
	if err != nil {
		t.Fatal(err)
	}
	projected, err := runtimeService.Get(
		ctx,
		owner.GameID,
		participantCredential,
	)
	if err != nil || projected.Interaction == nil ||
		projected.Interaction.InteractionID != interactionID {
		t.Fatalf("persisted interaction projection=%#v err=%v", projected.Interaction, err)
	}

	restartedStore, err := Open(ctx, databaseURL)
	if err != nil {
		t.Fatal(err)
	}
	defer restartedStore.Close()
	runtimeClock.value = projected.Interaction.DeadlineAt
	candidates, err := restartedStore.DueInteractions(ctx, runtimeClock.value, 10)
	if err != nil || len(candidates) != 1 {
		t.Fatalf("restart due candidates=%#v err=%v", candidates, err)
	}
	restartedService := application.NewService(
		restartedStore,
		postgresPack(t),
		runtimeClock,
		application.NoopPublisher{},
	)
	processed, err := restartedService.ProcessInteractionTimeout(ctx, candidates[0])
	if err != nil || !processed {
		t.Fatalf("restart timeout processed=%v err=%v", processed, err)
	}
	afterTimeout, err := restartedService.Get(
		ctx,
		owner.GameID,
		participantCredential,
	)
	if err != nil || afterTimeout.Interaction != nil {
		t.Fatalf("timeout projection=%#v err=%v", afterTimeout.Interaction, err)
	}
	var deadlineCount int
	if err := restartedStore.pool.QueryRow(
		ctx,
		"SELECT count(*) FROM game_interaction_deadlines WHERE game_id = $1",
		owner.GameID,
	).Scan(&deadlineCount); err != nil {
		t.Fatal(err)
	}
	if deadlineCount != 0 {
		t.Fatalf("closed interaction retained %d deadline rows", deadlineCount)
	}
}

func TestPostgresMigrationsSerializeAndRetryAfterFailure(t *testing.T) {
	databaseURL := os.Getenv("TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("TEST_DATABASE_URL is not configured")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	store, err := Open(ctx, databaseURL)
	if err != nil {
		t.Fatal(err)
	}
	defer store.Close()
	suffix := fmt.Sprintf("%d", time.Now().UnixNano())
	tableName := "munchkin_migration_probe_" + suffix
	path := filepath.Join(t.TempDir(), "000001_probe_"+suffix+".up.sql")
	if err := os.WriteFile(path, []byte(
		"CREATE TABLE "+tableName+" (id TEXT PRIMARY KEY); SELECT pg_sleep(0.15);\n",
	), 0o600); err != nil {
		t.Fatal(err)
	}
	defer func() {
		_, _ = store.pool.Exec(context.Background(), "DROP TABLE IF EXISTS "+tableName)
		_, _ = store.pool.Exec(
			context.Background(),
			"DELETE FROM munchkin_schema_migrations WHERE version = $1",
			filepath.Base(path),
		)
	}()

	var group sync.WaitGroup
	results := make(chan error, 2)
	for range 2 {
		group.Add(1)
		go func() {
			defer group.Done()
			results <- store.Migrate(ctx, path)
		}()
	}
	group.Wait()
	close(results)
	for migrationErr := range results {
		if migrationErr != nil {
			t.Fatal(migrationErr)
		}
	}
	var applied int
	if err := store.pool.QueryRow(
		ctx,
		"SELECT count(*) FROM munchkin_schema_migrations WHERE version = $1",
		filepath.Base(path),
	).Scan(&applied); err != nil {
		t.Fatal(err)
	}
	if applied != 1 {
		t.Fatalf("applied migration rows=%d", applied)
	}

	failingPath := filepath.Join(t.TempDir(), "000002_fail_"+suffix+".up.sql")
	if err := os.WriteFile(failingPath, []byte(
		"CREATE TABLE "+tableName+"_partial (id TEXT); SELECT 1 / 0;\n",
	), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := store.Migrate(ctx, failingPath); err == nil {
		t.Fatal("failed migration unexpectedly succeeded")
	}
	var exists *string
	if err := store.pool.QueryRow(
		ctx,
		"SELECT to_regclass($1)",
		tableName+"_partial",
	).Scan(&exists); err != nil {
		t.Fatal(err)
	}
	if exists != nil {
		t.Fatalf("partial migration table survived: %s", *exists)
	}
	if err := os.WriteFile(failingPath, []byte(
		"CREATE TABLE "+tableName+"_partial (id TEXT);\n",
	), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := store.Migrate(ctx, failingPath); err != nil {
		t.Fatal(err)
	}
}

type postgresClock struct {
	value time.Time
}

func (clock *postgresClock) Now() int64 {
	return clock.value.UnixNano()
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
