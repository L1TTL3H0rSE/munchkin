package application_test

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
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

func (publisher *capturePublisher) Publish(
	_ context.Context,
	event Invalidation,
) error {
	publisher.mu.Lock()
	defer publisher.mu.Unlock()
	publisher.events = append(publisher.events, event)
	return nil
}

func applicationPack(t *testing.T) game.Pack {
	t.Helper()
	cards := []game.Card{
		{
			ID:               "choice-curse",
			Name:             "Choice Curse",
			Deck:             game.DeckDoor,
			Kind:             game.CardCurse,
			Copies:           25,
			InteractionScope: game.InteractionSelf,
			Effects: []game.Effect{{
				Kind:     game.EffectDiscard,
				Selector: game.SelectorHand,
				Count:    2,
			}},
		},
		{
			ID:               "coin-item",
			Name:             "Coin Item",
			Deck:             game.DeckTreasure,
			Kind:             game.CardItem,
			Copies:           25,
			InteractionScope: game.InteractionSelf,
			Item: &game.ItemSpec{
				Slot:  game.SlotNone,
				Size:  game.SizeSmall,
				Value: 500,
			},
		},
	}
	for index := 0; index < 10; index++ {
		cards = append(cards, game.Card{
			ID:               fmt.Sprintf("deferred-%02d", index),
			Name:             "Deferred Interaction",
			Deck:             game.DeckDoor,
			Kind:             game.CardCurse,
			Copies:           1,
			InteractionScope: game.InteractionOtherPlayers,
			Effects: []game.Effect{{
				Kind:   game.EffectLoseLevel,
				Amount: 1,
			}},
		})
	}
	pack := game.Pack{
		SchemaVersion: 1,
		SetID:         "application-test",
		Version:       1,
		Author:        "tests",
		License:       "CC0-1.0",
		Source:        "test-fixture",
		Cards:         cards,
	}
	pack.ContentDigest = game.CardsDigest(pack.Cards)
	if err := pack.Validate(); err != nil {
		t.Fatal(err)
	}
	return pack
}

func testService(t *testing.T) (*Service, *capturePublisher) {
	t.Helper()
	publisher := &capturePublisher{}
	service := NewService(
		memory.New(),
		applicationPack(t),
		&fixedClock{},
		publisher,
	)
	return service, publisher
}

func createAndStartSingle(
	t *testing.T,
	service *Service,
) (LobbyResult, CommandResult) {
	t.Helper()
	ctx := context.Background()
	owner, err := service.CreateLobby(ctx, "Alice")
	if err != nil {
		t.Fatal(err)
	}
	started, err := service.Execute(
		ctx,
		owner.GameID,
		owner.Credential,
		"start-1",
		owner.Projection.Version,
		game.Command{Type: game.CommandStart},
	)
	if err != nil {
		t.Fatal(err)
	}
	return owner, started
}

func TestEveryReadAndMutationRejectsContentIdentityDrift(t *testing.T) {
	ctx := context.Background()
	store := memory.New()
	originalPack := applicationPack(t)
	original := NewService(
		store,
		originalPack,
		&fixedClock{},
		NoopPublisher{},
	)
	owner, err := original.CreateLobby(ctx, "Alice")
	if err != nil {
		t.Fatal(err)
	}

	driftedPack := originalPack
	driftedPack.Cards = append([]game.Card(nil), originalPack.Cards...)
	driftedPack.Cards[0].Name = "Drifted Choice Curse"
	driftedPack.ContentDigest = game.CardsDigest(driftedPack.Cards)
	if err := driftedPack.Validate(); err != nil {
		t.Fatal(err)
	}
	drifted := NewService(
		store,
		driftedPack,
		&fixedClock{},
		NoopPublisher{},
	)

	if _, err := drifted.GetLobby(ctx, owner.GameID); !errors.Is(err, game.ErrInvalidContent) {
		t.Fatalf("lobby summary accepted drifted content: %v", err)
	}
	if _, err := drifted.JoinLobby(
		ctx,
		owner.GameID,
		"new-player-credential",
		"join-drifted",
		owner.Projection.Version,
		"Bob",
	); !errors.Is(err, game.ErrInvalidContent) {
		t.Fatalf("join accepted drifted content: %v", err)
	}
	if _, err := drifted.Execute(
		ctx,
		owner.GameID,
		owner.Credential,
		"start-drifted",
		owner.Projection.Version,
		game.Command{Type: game.CommandStart},
	); !errors.Is(err, game.ErrInvalidContent) {
		t.Fatalf("command accepted drifted content: %v", err)
	}

	projection, err := original.Get(ctx, owner.GameID, owner.Credential)
	if err != nil {
		t.Fatal(err)
	}
	if projection.Version != owner.Projection.Version || len(projection.Players) != 1 {
		t.Fatalf("drift rejection mutated the game: %#v", projection)
	}
}

func TestCredentialAuthorityAndTypedIdempotency(t *testing.T) {
	service, publisher := testService(t)
	owner, started := createAndStartSingle(t, service)
	ctx := context.Background()

	if _, err := service.Get(ctx, owner.GameID, "forged"); !errors.Is(err, ErrUnauthorized) {
		t.Fatalf("forged credential: %v", err)
	}
	replayed, err := service.Execute(
		ctx,
		owner.GameID,
		owner.Credential,
		"start-1",
		owner.Projection.Version,
		game.Command{Type: game.CommandStart},
	)
	if err != nil {
		t.Fatal(err)
	}
	if !replayed.Replayed || replayed.Version != started.Version {
		t.Fatalf("receipt not replayed: %#v", replayed)
	}
	if _, err := service.Execute(
		ctx,
		owner.GameID,
		owner.Credential,
		"start-1",
		owner.Projection.Version,
		game.Command{Type: game.CommandFinishSetup},
	); !errors.Is(err, ErrIdempotencyConflict) {
		t.Fatalf("changed key reuse: %v", err)
	}

	publisher.mu.Lock()
	defer publisher.mu.Unlock()
	if len(publisher.events) != 1 {
		t.Fatalf("expected one start invalidation, got %d", len(publisher.events))
	}
	raw, _ := json.Marshal(publisher.events[0])
	for _, forbidden := range []string{owner.Credential, "hand", "deck", "rng"} {
		if stringContains(string(raw), forbidden) {
			t.Fatalf("realtime leaked %q: %s", forbidden, raw)
		}
	}
}

func TestCanonicalSelectionFingerprintAndRollback(t *testing.T) {
	service, _ := testService(t)
	owner, started := createAndStartSingle(t, service)
	ctx := context.Background()
	setup, err := service.Execute(
		ctx,
		owner.GameID,
		owner.Credential,
		"setup-1",
		started.Version,
		game.Command{Type: game.CommandFinishSetup},
	)
	if err != nil {
		t.Fatal(err)
	}
	opened, err := service.Execute(
		ctx,
		owner.GameID,
		owner.Credential,
		"open-1",
		setup.Version,
		game.Command{Type: game.CommandOpenDoor},
	)
	if err != nil {
		t.Fatal(err)
	}
	decision := opened.Projection.Turn.PendingDecision
	if decision == nil || len(decision.Options) < 3 {
		t.Fatalf("choice fixture did not create enough options: %#v", decision)
	}
	expectedVersion := opened.Version
	firstSelection := []string{decision.Options[0], decision.Options[1]}
	first, err := service.Execute(
		ctx,
		owner.GameID,
		owner.Credential,
		"choice-1",
		expectedVersion,
		game.Command{
			Type:      game.CommandChooseEffect,
			ChoiceIDs: firstSelection,
		},
	)
	if err != nil {
		t.Fatal(err)
	}
	replayed, err := service.Execute(
		ctx,
		owner.GameID,
		owner.Credential,
		"choice-1",
		expectedVersion,
		game.Command{
			Type:      game.CommandChooseEffect,
			ChoiceIDs: []string{firstSelection[1], firstSelection[0]},
		},
	)
	if err != nil || !replayed.Replayed || replayed.Version != first.Version {
		t.Fatalf("canonical replay: result=%#v err=%v", replayed, err)
	}
	if _, err := service.Execute(
		ctx,
		owner.GameID,
		owner.Credential,
		"choice-1",
		expectedVersion,
		game.Command{
			Type: game.CommandChooseEffect,
			ChoiceIDs: []string{
				decision.Options[0],
				decision.Options[2],
			},
		},
	); !errors.Is(err, ErrIdempotencyConflict) {
		t.Fatalf("different selection reused receipt: %v", err)
	}

	before, err := service.Get(ctx, owner.GameID, owner.Credential)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := service.Execute(
		ctx,
		owner.GameID,
		owner.Credential,
		"invalid-1",
		before.Version,
		game.Command{
			Type:      game.CommandChooseEffect,
			ChoiceIDs: []string{"forged"},
		},
	); err == nil {
		t.Fatal("invalid command unexpectedly succeeded")
	}
	after, err := service.Get(ctx, owner.GameID, owner.Credential)
	if err != nil {
		t.Fatal(err)
	}
	if after.Version != before.Version {
		t.Fatalf(
			"failed command changed version: before=%d after=%d",
			before.Version,
			after.Version,
		)
	}
}

func TestConcurrentExpectedVersionAllowsOneAppend(t *testing.T) {
	service, _ := testService(t)
	owner, started := createAndStartSingle(t, service)
	ctx := context.Background()

	type outcome struct {
		result CommandResult
		err    error
	}
	release := make(chan struct{})
	outcomes := make(chan outcome, 2)
	for _, commandID := range []string{"race-a", "race-b"} {
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
			outcomes <- outcome{result: result, err: err}
		}(commandID)
	}
	close(release)

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
		t.Fatalf(
			"race outcomes: successes=%d conflicts=%d",
			successes,
			conflicts,
		)
	}
}

func TestJoinUsesClientCredentialAndReplaysReceipt(t *testing.T) {
	service, publisher := testService(t)
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
		t.Fatalf(
			"join receipt was not replayed: first=%#v replayed=%#v",
			first,
			replayed,
		)
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
	if len(publisher.events) != 1 ||
		publisher.events[0].Reason != string(game.CommandJoin) {
		t.Fatalf("join invalidations: %#v", publisher.events)
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
