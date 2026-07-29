package application_test

import (
	"context"
	"encoding/json"
	"errors"
	"sync"
	"testing"

	. "github.com/leinodev/munchkin/backend/game/internal/application"
	"github.com/leinodev/munchkin/backend/game/internal/game"
	"github.com/leinodev/munchkin/backend/game/internal/repository/memory"
)

type fixedClock struct {
	value int64
}

func (clock *fixedClock) Now() int64 {
	clock.value++
	return clock.value
}

type capturePublisher struct {
	mu     sync.Mutex
	events []Invalidation
}

func (publisher *capturePublisher) Publish(_ context.Context, event Invalidation) error {
	publisher.mu.Lock()
	defer publisher.mu.Unlock()
	publisher.events = append(publisher.events, event)
	return nil
}

func applicationPack(t *testing.T) game.Pack {
	t.Helper()
	cards := make([]game.Card, 0, 24)
	for index := 0; index < 12; index++ {
		kind := game.CardDoor
		card := game.Card{ID: "door-" + string(rune('a'+index)), Name: "Door", Kind: kind}
		if index == 0 {
			card = game.Card{ID: "monster-a", Name: "Monster", Kind: game.CardMonster, CombatStrength: 1, TreasureCount: 1, LevelLoss: 1}
		}
		cards = append(cards, card)
	}
	for index := 0; index < 12; index++ {
		cards = append(cards, game.Card{ID: "treasure-" + string(rune('a'+index)), Name: "Treasure", Kind: game.CardTreasure})
	}
	pack := game.Pack{
		SchemaVersion: 1,
		SetID:         "application-test",
		Version:       1,
		Author:        "tests",
		License:       "CC0-1.0",
		Source:        "test-fixture",
		ContentDigest: game.CardsDigest(cards),
		Cards:         cards,
	}
	if err := pack.Validate(); err != nil {
		t.Fatal(err)
	}
	return pack
}

func deterministicService(t *testing.T) (*Service, *capturePublisher) {
	t.Helper()
	publisher := &capturePublisher{}
	service := NewService(memory.New(), applicationPack(t), &fixedClock{}, publisher)
	return service, publisher
}

func createAndStart(t *testing.T, service *Service) (LobbyResult, LobbyResult, CommandResult) {
	t.Helper()
	ctx := context.Background()
	owner, err := service.CreateLobby(ctx, "Alice")
	if err != nil {
		t.Fatal(err)
	}
	joined, err := service.JoinLobby(
		ctx,
		owner.GameID,
		"join-credential-bob",
		"join-1",
		owner.Projection.Version,
		"Bob",
	)
	if err != nil {
		t.Fatal(err)
	}
	started, err := service.Execute(
		ctx,
		owner.GameID,
		owner.Credential,
		"start-1",
		joined.Projection.Version,
		game.CommandStart,
	)
	if err != nil {
		t.Fatal(err)
	}
	return owner, joined, started
}

func TestCredentialAuthorityAndIdempotency(t *testing.T) {
	service, publisher := deterministicService(t)
	owner, _, started := createAndStart(t, service)
	ctx := context.Background()

	if _, err := service.Get(ctx, owner.GameID, "forged"); !errors.Is(err, ErrUnauthorized) {
		t.Fatalf("forged credential: %v", err)
	}

	first, err := service.Execute(
		ctx,
		owner.GameID,
		owner.Credential,
		"open-1",
		started.Version,
		game.CommandOpenDoor,
	)
	if err != nil {
		t.Fatal(err)
	}
	replayed, err := service.Execute(
		ctx,
		owner.GameID,
		owner.Credential,
		"open-1",
		started.Version,
		game.CommandOpenDoor,
	)
	if err != nil {
		t.Fatal(err)
	}
	if !replayed.Replayed || replayed.Version != first.Version {
		t.Fatalf("receipt not replayed: %#v", replayed)
	}
	if _, err := service.Execute(
		ctx,
		owner.GameID,
		owner.Credential,
		"open-1",
		started.Version,
		game.CommandFight,
	); !errors.Is(err, ErrIdempotencyConflict) {
		t.Fatalf("changed key reuse: %v", err)
	}
	publisher.mu.Lock()
	defer publisher.mu.Unlock()
	if len(publisher.events) != 3 {
		t.Fatalf("expected join, start and open invalidations, got %d", len(publisher.events))
	}
	for _, event := range publisher.events {
		raw, _ := json.Marshal(event)
		for _, forbidden := range []string{owner.Credential, "hand", "deck", "rng"} {
			if stringContains(string(raw), forbidden) {
				t.Fatalf("realtime leaked %q: %s", forbidden, raw)
			}
		}
	}
}

func TestJoinUsesClientCredentialAndReplaysReceipt(t *testing.T) {
	service, publisher := deterministicService(t)
	ctx := context.Background()
	owner, err := service.CreateLobby(ctx, "Alice")
	if err != nil {
		t.Fatal(err)
	}
	first, err := service.JoinLobby(
		ctx,
		owner.GameID,
		"stable-client-credential",
		"join-stable",
		owner.Projection.Version,
		"Bob",
	)
	if err != nil {
		t.Fatal(err)
	}
	replayed, err := service.JoinLobby(
		ctx,
		owner.GameID,
		"stable-client-credential",
		"join-stable",
		owner.Projection.Version,
		"Bob",
	)
	if err != nil {
		t.Fatal(err)
	}
	if first.PlayerID != replayed.PlayerID ||
		first.Projection.Version != replayed.Projection.Version ||
		replayed.Credential != "stable-client-credential" {
		t.Fatalf("join receipt was not replayed: first=%#v replayed=%#v", first, replayed)
	}
	if _, err := service.JoinLobby(
		ctx,
		owner.GameID,
		"stable-client-credential",
		"join-stable",
		owner.Projection.Version,
		"Mallory",
	); !errors.Is(err, ErrIdempotencyConflict) {
		t.Fatalf("changed join key reuse: %v", err)
	}
	publisher.mu.Lock()
	defer publisher.mu.Unlock()
	if len(publisher.events) != 1 || publisher.events[0].Reason != string(game.CommandJoin) {
		t.Fatalf("join invalidations: %#v", publisher.events)
	}
}

func TestConcurrentExpectedVersionAllowsOneAppend(t *testing.T) {
	service, _ := deterministicService(t)
	owner, _, started := createAndStart(t, service)
	ctx := context.Background()

	type outcome struct {
		result CommandResult
		err    error
	}
	start := make(chan struct{})
	outcomes := make(chan outcome, 2)
	for _, commandID := range []string{"race-a", "race-b"} {
		go func(id string) {
			<-start
			result, err := service.Execute(
				ctx,
				owner.GameID,
				owner.Credential,
				id,
				started.Version,
				game.CommandOpenDoor,
			)
			outcomes <- outcome{result: result, err: err}
		}(commandID)
	}
	close(start)

	successes := 0
	conflicts := 0
	for range 2 {
		outcome := <-outcomes
		if outcome.err == nil {
			successes++
		} else if errors.Is(outcome.err, ErrVersionConflict) {
			conflicts++
		} else {
			t.Fatalf("unexpected race error: %v", outcome.err)
		}
	}
	if successes != 1 || conflicts != 1 {
		t.Fatalf("race outcomes: successes=%d conflicts=%d", successes, conflicts)
	}
}

func stringContains(value, needle string) bool {
	for index := 0; index+len(needle) <= len(value); index++ {
		if value[index:index+len(needle)] == needle {
			return true
		}
	}
	return false
}
