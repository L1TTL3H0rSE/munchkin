package application_test

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"sync"
	"testing"
	"time"

	. "github.com/leinodev/munchkin/backend/game/internal/application"
	"github.com/leinodev/munchkin/backend/game/internal/game"
	"github.com/leinodev/munchkin/backend/game/internal/repository/memory"
)

func combatApplicationPack(t *testing.T) game.Pack {
	t.Helper()
	cards := []game.Card{
		{
			ID:               "application-monster",
			Name:             "Application Monster",
			Deck:             game.DeckDoor,
			Kind:             game.CardMonster,
			Copies:           25,
			InteractionScope: game.InteractionNone,
			Monster: &game.MonsterSpec{
				Strength:  2,
				Treasures: 1,
				Levels:    1,
				BadStuff: []game.Effect{{
					Kind:   game.EffectLoseLevel,
					Amount: 1,
				}},
			},
		},
		{
			ID:               "application-item",
			Name:             "Application Item",
			Deck:             game.DeckTreasure,
			Kind:             game.CardItem,
			Copies:           25,
			InteractionScope: game.InteractionSelf,
			Item: &game.ItemSpec{
				Slot:  game.SlotNone,
				Size:  game.SizeSmall,
				Value: 100,
			},
		},
		{
			ID:               "application-intervention",
			Name:             "Application Intervention",
			Deck:             game.DeckTreasure,
			Kind:             game.CardOneShot,
			Copies:           4,
			InteractionScope: game.InteractionOtherPlayers,
			Effects: []game.Effect{{
				Kind:   game.EffectModifyCombat,
				Amount: 2,
				Target: game.EffectTargetPlayer,
			}},
		},
	}
	for index := 0; index < 10; index++ {
		cards = append(cards, game.Card{
			ID:               fmt.Sprintf("application-item-%02d", index),
			Name:             fmt.Sprintf("Application Item %02d", index),
			Deck:             game.DeckTreasure,
			Kind:             game.CardItem,
			Copies:           1,
			InteractionScope: game.InteractionSelf,
			Item: &game.ItemSpec{
				Slot:  game.SlotNone,
				Size:  game.SizeSmall,
				Value: 100,
			},
		})
	}
	pack := game.Pack{
		SchemaVersion: 1,
		SetID:         "combat-application-test",
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

func advancedCombatApplicationPack(t *testing.T) game.Pack {
	t.Helper()
	pack := combatApplicationPack(t)
	pack.SetID = "moscow-core"
	pack.Version = 3
	pack.Source = "advanced-application-test"
	pack.Cards = append(pack.Cards, game.Card{
		ID:               "application-enhancer",
		Name:             "Application Enhancer",
		Deck:             game.DeckTreasure,
		Kind:             game.CardOneShot,
		Copies:           30,
		InteractionScope: game.InteractionOtherPlayers,
		Effects: []game.Effect{{
			Kind:   game.EffectModifyCombat,
			Amount: 3,
			Target: game.EffectTargetMonster,
		}},
		CombatCapability: &game.CombatCapability{
			Kind:   game.CombatCapabilityEnhance,
			Amount: 3,
		},
	})
	pack.ContentDigest = game.CardsDigest(pack.Cards)
	if err := pack.Validate(); err != nil {
		t.Fatal(err)
	}
	// The validated filler cards prove the pack shape. Removing their physical
	// copies here makes the randomized deal deterministic for this application
	// boundary test without changing the registered definitions.
	for index := range pack.Cards {
		if pack.Cards[index].ID != "application-monster" &&
			pack.Cards[index].ID != "application-enhancer" {
			pack.Cards[index].Copies = 0
		}
	}
	return pack
}

type manualClock struct {
	mu    sync.Mutex
	value time.Time
	calls int
}

type withinGate struct {
	entered chan struct{}
	release chan struct{}
}

type gatedMemoryStore struct {
	*memory.Store
	mu   sync.Mutex
	gate *withinGate
}

func (store *gatedMemoryStore) Arm() *withinGate {
	store.mu.Lock()
	defer store.mu.Unlock()
	gate := &withinGate{
		entered: make(chan struct{}),
		release: make(chan struct{}),
	}
	store.gate = gate
	return gate
}

func (store *gatedMemoryStore) WithinGame(
	ctx context.Context,
	gameID string,
	operation func(Tx) error,
) error {
	store.mu.Lock()
	gate := store.gate
	store.gate = nil
	store.mu.Unlock()
	if gate != nil {
		close(gate.entered)
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-gate.release:
		}
	}
	return store.Store.WithinGame(ctx, gameID, operation)
}

type transientDueStore struct {
	Store
	mu     sync.Mutex
	calls  int
	cancel context.CancelFunc
}

func (store *transientDueStore) DueInteractions(
	context.Context,
	time.Time,
	int,
) ([]InteractionDeadline, error) {
	store.mu.Lock()
	defer store.mu.Unlock()
	store.calls++
	if store.calls == 1 {
		return nil, errors.New("temporary due scan failure")
	}
	store.cancel()
	return nil, nil
}

func (clock *manualClock) Now() int64 {
	clock.mu.Lock()
	defer clock.mu.Unlock()
	clock.calls++
	return clock.value.UnixNano()
}

func (clock *manualClock) Set(value time.Time) {
	clock.mu.Lock()
	defer clock.mu.Unlock()
	clock.value = value.UTC()
}

func (clock *manualClock) Calls() int {
	clock.mu.Lock()
	defer clock.mu.Unlock()
	return clock.calls
}

type interactionFixture struct {
	service       *Service
	store         *memory.Store
	gatedStore    *gatedMemoryStore
	clock         *manualClock
	publisher     *capturePublisher
	owner         LobbyResult
	participants  []LobbyResult
	interactionID string
}

func newInteractionFixture(
	t *testing.T,
	participantCount int,
) interactionFixture {
	t.Helper()
	ctx := context.Background()
	store := memory.New()
	gatedStore := &gatedMemoryStore{Store: store}
	clock := &manualClock{
		value: time.Date(2026, time.July, 30, 20, 0, 0, 0, time.UTC),
	}
	publisher := &capturePublisher{}
	service := NewService(gatedStore, applicationPack(t), clock, publisher)
	owner, err := service.CreateLobby(ctx, "Alice")
	if err != nil {
		t.Fatal(err)
	}
	participants := make([]LobbyResult, 0, participantCount)
	version := owner.Projection.Version
	for index := range participantCount {
		joined, err := service.JoinLobby(
			ctx,
			owner.GameID,
			"interaction-credential-"+string(rune('b'+index)),
			"interaction-join-"+string(rune('b'+index)),
			version,
			"Responder "+string(rune('B'+index)),
		)
		if err != nil {
			t.Fatal(err)
		}
		participants = append(participants, joined)
		version = joined.Projection.Version
	}
	started, err := service.Execute(
		ctx,
		owner.GameID,
		owner.Credential,
		"interaction-start",
		version,
		game.Command{Type: game.CommandStart},
	)
	if err != nil {
		t.Fatal(err)
	}
	specParticipants := make([]InteractionParticipant, 0, len(participants))
	for _, participant := range participants {
		specParticipants = append(specParticipants, InteractionParticipant{
			ActorID:       participant.PlayerID,
			Requirement:   game.InteractionResponseOptional,
			TimeoutIntent: game.InteractionIntentPass,
		})
	}
	interactionID, err := service.OpenInteraction(
		ctx,
		owner.GameID,
		"interaction-open",
		started.Version,
		InteractionOpenSpec{
			Kind: game.InteractionKindCombatResponse,
			Parent: game.InteractionParent{
				Phase:       started.Projection.Turn.Phase,
				SubjectKind: game.InteractionSubjectTurn,
				SubjectID:   started.Projection.Turn.PlayerID,
			},
			InitiatorActorID:  owner.PlayerID,
			EligibilityPolicy: game.InteractionEligibilityPublicPredicate,
			AllowedIntents: []game.InteractionIntent{
				game.InteractionIntentPass,
				game.InteractionIntentRespond,
			},
			Participants:   specParticipants,
			DeadlinePolicy: game.CollectiveInteractionDeadlinePolicy(),
		},
	)
	if err != nil {
		t.Fatal(err)
	}
	return interactionFixture{
		service:       service,
		store:         store,
		gatedStore:    gatedStore,
		clock:         clock,
		publisher:     publisher,
		owner:         owner,
		participants:  participants,
		interactionID: interactionID,
	}
}

func TestInteractionPlayerCommandReceiptAndPrivacy(t *testing.T) {
	fixture := newInteractionFixture(t, 1)
	ctx := context.Background()
	participant := fixture.participants[0]
	projection, err := fixture.service.Get(
		ctx,
		fixture.owner.GameID,
		participant.Credential,
	)
	if err != nil {
		t.Fatal(err)
	}
	if projection.Interaction == nil ||
		projection.Interaction.ServerTime == nil ||
		!projection.Interaction.ServerTime.Equal(fixture.clock.value) {
		t.Fatalf("interaction server time: %#v", projection.Interaction)
	}
	action := interactionActionForTest(
		t,
		projection,
		game.InteractionIntentPass,
	)
	clockCalls := fixture.clock.Calls()
	result, err := fixture.service.ExecuteInteraction(
		ctx,
		fixture.owner.GameID,
		participant.Credential,
		"interaction-pass",
		projection.Version,
		fixture.interactionID,
		action.ActionID,
		action.Type,
	)
	if err != nil {
		t.Fatal(err)
	}
	if got := fixture.clock.Calls() - clockCalls; got != 1 {
		t.Fatalf("player interaction sampled clock %d times", got)
	}
	if result.Projection.Interaction != nil {
		t.Fatalf("terminal interaction remained projected: %#v", result.Projection.Interaction)
	}
	replayed, err := fixture.service.ExecuteInteraction(
		ctx,
		fixture.owner.GameID,
		participant.Credential,
		"interaction-pass",
		projection.Version,
		fixture.interactionID,
		action.ActionID,
		action.Type,
	)
	if err != nil || !replayed.Replayed || replayed.Version != result.Version {
		t.Fatalf("interaction replay: result=%#v err=%v", replayed, err)
	}
	if _, err := fixture.service.ExecuteInteraction(
		ctx,
		fixture.owner.GameID,
		participant.Credential,
		"interaction-pass",
		projection.Version,
		fixture.interactionID,
		action.ActionID,
		game.InteractionIntentRespond,
	); !errors.Is(err, ErrIdempotencyConflict) {
		t.Fatalf("reused interaction command ID: %v", err)
	}
	if got := fixture.publisher.events[len(fixture.publisher.events)-1].Reason; got != "interaction_changed" {
		t.Fatalf("sensitive invalidation reason: %q", got)
	}
}

func TestCombatResolutionRequestUsesReceiptAndContinuesAfterPass(t *testing.T) {
	ctx := context.Background()
	clock := &manualClock{
		value: time.Date(2026, time.July, 31, 4, 0, 0, 0, time.UTC),
	}
	service := NewService(
		memory.New(),
		combatApplicationPack(t),
		clock,
		NoopPublisher{},
	)
	owner, err := service.CreateLobby(ctx, "Alice")
	if err != nil {
		t.Fatal(err)
	}
	responder, err := service.JoinLobby(
		ctx,
		owner.GameID,
		"combat-responder-credential",
		"combat-join",
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
		"combat-start",
		responder.Projection.Version,
		game.Command{Type: game.CommandStart},
	)
	if err != nil {
		t.Fatal(err)
	}
	setupOwner, err := service.Execute(
		ctx,
		owner.GameID,
		owner.Credential,
		"combat-setup-owner",
		started.Version,
		game.Command{Type: game.CommandFinishSetup},
	)
	if err != nil {
		t.Fatal(err)
	}
	setupResponder, err := service.Execute(
		ctx,
		owner.GameID,
		responder.Credential,
		"combat-setup-responder",
		setupOwner.Version,
		game.Command{Type: game.CommandFinishSetup},
	)
	if err != nil {
		t.Fatal(err)
	}
	opened, err := service.Execute(
		ctx,
		owner.GameID,
		owner.Credential,
		"combat-open-door",
		setupResponder.Version,
		game.Command{Type: game.CommandOpenDoor},
	)
	if err != nil {
		t.Fatal(err)
	}
	if opened.Projection.Turn.Phase != game.PhaseCombat {
		t.Fatalf("fixture phase: %s", opened.Projection.Turn.Phase)
	}
	if _, err := service.Execute(
		ctx,
		owner.GameID,
		owner.Credential,
		"combat-direct-resolve",
		opened.Version,
		game.Command{Type: game.CommandResolveCombat},
	); !errors.Is(err, game.ErrIllegalCommand) {
		t.Fatalf("direct resolution error: %v", err)
	}

	requested, err := service.RequestCombatResolution(
		ctx,
		owner.GameID,
		owner.Credential,
		"combat-request",
		opened.Version,
	)
	if err != nil {
		t.Fatal(err)
	}
	if requested.Projection.Interaction == nil ||
		requested.Projection.Interaction.PublicKind != "combat_response" {
		t.Fatalf("combat response projection: %#v", requested.Projection.Interaction)
	}
	replayed, err := service.RequestCombatResolution(
		ctx,
		owner.GameID,
		owner.Credential,
		"combat-request",
		opened.Version,
	)
	if err != nil || !replayed.Replayed ||
		replayed.Version != requested.Version {
		t.Fatalf("combat request replay=%#v err=%v", replayed, err)
	}
	if _, err := service.RequestCombatResolution(
		ctx,
		owner.GameID,
		owner.Credential,
		"combat-request",
		requested.Version,
	); !errors.Is(err, ErrIdempotencyConflict) {
		t.Fatalf("changed combat request reused receipt: %v", err)
	}

	responderProjection, err := service.Get(
		ctx,
		owner.GameID,
		responder.Credential,
	)
	if err != nil {
		t.Fatal(err)
	}
	pass := interactionActionForTest(
		t,
		responderProjection,
		game.InteractionIntentPass,
	)
	result, err := service.ExecuteInteraction(
		ctx,
		owner.GameID,
		responder.Credential,
		fmt.Sprintf("combat-pass-%d", responderProjection.Version),
		responderProjection.Version,
		responderProjection.Interaction.InteractionID,
		pass.ActionID,
		game.InteractionIntentPass,
	)
	if err != nil {
		t.Fatal(err)
	}
	if result.Projection.Interaction != nil ||
		result.Projection.Turn.Phase == game.PhaseCombat {
		t.Fatalf("combat did not continue after pass: %#v", result.Projection)
	}
}

func TestAdvancedCombatActionUsesActorProjectionCASAndReceipt(t *testing.T) {
	ctx := context.Background()
	openedAt := time.Date(2026, time.July, 31, 4, 15, 0, 0, time.UTC)
	clock := &manualClock{value: openedAt}
	service := NewService(
		memory.New(),
		advancedCombatApplicationPack(t),
		clock,
		NoopPublisher{},
	)
	owner, err := service.CreateLobby(ctx, "Alice")
	if err != nil {
		t.Fatal(err)
	}
	responder, err := service.JoinLobby(
		ctx,
		owner.GameID,
		"advanced-responder-credential",
		"advanced-join",
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
		"advanced-start",
		responder.Projection.Version,
		game.Command{Type: game.CommandStart},
	)
	if err != nil {
		t.Fatal(err)
	}
	setupOwner, err := service.Execute(
		ctx,
		owner.GameID,
		owner.Credential,
		"advanced-setup-owner",
		started.Version,
		game.Command{Type: game.CommandFinishSetup},
	)
	if err != nil {
		t.Fatal(err)
	}
	setupResponder, err := service.Execute(
		ctx,
		owner.GameID,
		responder.Credential,
		"advanced-setup-responder",
		setupOwner.Version,
		game.Command{Type: game.CommandFinishSetup},
	)
	if err != nil {
		t.Fatal(err)
	}
	opened, err := service.Execute(
		ctx,
		owner.GameID,
		owner.Credential,
		"advanced-open-door",
		setupResponder.Version,
		game.Command{Type: game.CommandOpenDoor},
	)
	if err != nil {
		t.Fatal(err)
	}
	requested, err := service.RequestCombatResolution(
		ctx,
		owner.GameID,
		owner.Credential,
		"advanced-request",
		opened.Version,
	)
	if err != nil {
		t.Fatal(err)
	}
	responderProjection, err := service.Get(
		ctx,
		owner.GameID,
		responder.Credential,
	)
	if err != nil {
		t.Fatal(err)
	}
	var action game.InteractionActionView
	for _, candidate := range responderProjection.Interaction.Actions {
		if candidate.CombatCapability == game.CombatCapabilityEnhance {
			action = candidate
			break
		}
	}
	if action.ActionID == "" ||
		action.TargetMonsterInstanceID == "" ||
		action.CombatDelta != 3 {
		t.Fatalf("advanced actor descriptor: %#v", action)
	}
	if _, err := service.ExecuteInteraction(
		ctx,
		owner.GameID,
		owner.Credential,
		"foreign-advanced-action",
		requested.Version,
		requested.Projection.Interaction.InteractionID,
		action.ActionID,
		action.Type,
	); !errors.Is(err, ErrInteractionAction) {
		t.Fatalf("foreign actor used private advanced action: %v", err)
	}

	clock.Set(openedAt.Add(31 * time.Second))
	result, err := service.ExecuteInteraction(
		ctx,
		owner.GameID,
		responder.Credential,
		"advanced-effect",
		responderProjection.Version,
		responderProjection.Interaction.InteractionID,
		action.ActionID,
		action.Type,
	)
	if err != nil {
		t.Fatal(err)
	}
	if result.Projection.Interaction == nil ||
		result.Projection.Interaction.Actions[0].Revision != 2 ||
		!result.Projection.Interaction.DeadlineAt.Equal(
			openedAt.Add(70*time.Second),
		) ||
		result.Projection.Turn.Combat == nil ||
		len(result.Projection.Turn.Combat.Effects) != 1 ||
		result.Projection.Turn.Combat.Effects[0].EffectID == "" {
		t.Fatalf("advanced CAS outcome: %#v", result.Projection)
	}
	replayed, err := service.ExecuteInteraction(
		ctx,
		owner.GameID,
		responder.Credential,
		"advanced-effect",
		responderProjection.Version,
		responderProjection.Interaction.InteractionID,
		action.ActionID,
		action.Type,
	)
	if err != nil || !replayed.Replayed ||
		replayed.Version != result.Version {
		t.Fatalf("advanced receipt replay=%#v err=%v", replayed, err)
	}
	if _, err := service.ExecuteInteraction(
		ctx,
		owner.GameID,
		responder.Credential,
		"advanced-effect",
		result.Version,
		result.Projection.Interaction.InteractionID,
		result.Projection.Interaction.Actions[0].ActionID,
		game.InteractionIntentPass,
	); !errors.Is(err, ErrIdempotencyConflict) {
		t.Fatalf("advanced receipt accepted another fingerprint: %v", err)
	}
	if _, err := service.ExecuteInteraction(
		ctx,
		owner.GameID,
		responder.Credential,
		"stale-advanced-effect",
		responderProjection.Version,
		responderProjection.Interaction.InteractionID,
		action.ActionID,
		action.Type,
	); !errors.Is(err, ErrVersionConflict) {
		t.Fatalf("stale advanced action error: %v", err)
	}
}

func TestCombatHelpActionsArePrivateIdempotentAndHaveOneConcurrentWinner(
	t *testing.T,
) {
	ctx := context.Background()
	clock := &manualClock{
		value: time.Date(2026, time.July, 31, 4, 30, 0, 0, time.UTC),
	}
	store := memory.New()
	service := NewService(
		store,
		combatApplicationPack(t),
		clock,
		NoopPublisher{},
	)
	owner, err := service.CreateLobby(ctx, "Alice")
	if err != nil {
		t.Fatal(err)
	}
	helper, err := service.JoinLobby(
		ctx,
		owner.GameID,
		"combat-helper-credential",
		"combat-helper-join",
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
		"combat-helper-start",
		helper.Projection.Version,
		game.Command{Type: game.CommandStart},
	)
	if err != nil {
		t.Fatal(err)
	}
	setupOwner, err := service.Execute(
		ctx,
		owner.GameID,
		owner.Credential,
		"combat-helper-setup-owner",
		started.Version,
		game.Command{Type: game.CommandFinishSetup},
	)
	if err != nil {
		t.Fatal(err)
	}
	setupHelper, err := service.Execute(
		ctx,
		owner.GameID,
		helper.Credential,
		"combat-helper-setup-helper",
		setupOwner.Version,
		game.Command{Type: game.CommandFinishSetup},
	)
	if err != nil {
		t.Fatal(err)
	}
	opened, err := service.Execute(
		ctx,
		owner.GameID,
		owner.Credential,
		"combat-helper-open-door",
		setupHelper.Version,
		game.Command{Type: game.CommandOpenDoor},
	)
	if err != nil {
		t.Fatal(err)
	}
	requested, err := service.RequestCombatResolution(
		ctx,
		owner.GameID,
		owner.Credential,
		"combat-helper-request",
		opened.Version,
	)
	if err != nil {
		t.Fatal(err)
	}
	offer := interactionActionForTest(
		t,
		requested.Projection,
		game.InteractionIntentOfferHelp,
	)
	if offer.HelperPlayerID != helper.PlayerID ||
		offer.RewardTreasures != 1 {
		t.Fatalf("server-owned offer: %#v", offer)
	}
	if _, err := service.ExecuteCombatHelpAction(
		ctx,
		owner.GameID,
		helper.Credential,
		"foreign-help-action",
		requested.Version,
		offer.ActionID,
	); !errors.Is(err, ErrInteractionAction) {
		t.Fatalf("foreign actor used private offer action: %v", err)
	}
	offered, err := service.ExecuteCombatHelpAction(
		ctx,
		owner.GameID,
		owner.Credential,
		"combat-help-offer",
		requested.Version,
		offer.ActionID,
	)
	if err != nil {
		t.Fatal(err)
	}
	if offered.Projection.Interaction == nil ||
		offered.Projection.Interaction.PublicKind != "combat_help_offer" ||
		offered.Projection.Interaction.CombatHelpOffer == nil {
		t.Fatalf("owner offer projection: %#v", offered.Projection.Interaction)
	}
	replayed, err := service.ExecuteCombatHelpAction(
		ctx,
		owner.GameID,
		owner.Credential,
		"combat-help-offer",
		requested.Version,
		offer.ActionID,
	)
	if err != nil || !replayed.Replayed ||
		replayed.Version != offered.Version {
		t.Fatalf("offer replay=%#v err=%v", replayed, err)
	}
	cancel := interactionActionForTest(
		t,
		offered.Projection,
		game.InteractionIntentCancelHelp,
	)
	if _, err := service.ExecuteCombatHelpAction(
		ctx,
		owner.GameID,
		owner.Credential,
		"combat-help-offer",
		offered.Version,
		cancel.ActionID,
	); !errors.Is(err, ErrIdempotencyConflict) {
		t.Fatalf("offer command ID accepted another fingerprint: %v", err)
	}

	helperProjection, err := service.Get(
		ctx,
		owner.GameID,
		helper.Credential,
	)
	if err != nil {
		t.Fatal(err)
	}
	accept := interactionActionForTest(
		t,
		helperProjection,
		game.InteractionIntentAccept,
	)
	supersede := interactionActionForTest(
		t,
		offered.Projection,
		game.InteractionIntentOfferHelp,
	)
	type outcome struct {
		err error
	}
	release := make(chan struct{})
	outcomes := make(chan outcome, 2)
	go func() {
		<-release
		_, err := service.ExecuteInteraction(
			ctx,
			owner.GameID,
			helper.Credential,
			"combat-help-accept",
			helperProjection.Version,
			helperProjection.Interaction.InteractionID,
			accept.ActionID,
			accept.Type,
		)
		outcomes <- outcome{err: err}
	}()
	go func() {
		<-release
		_, err := service.ExecuteCombatHelpAction(
			ctx,
			owner.GameID,
			owner.Credential,
			"combat-help-supersede",
			offered.Version,
			supersede.ActionID,
		)
		outcomes <- outcome{err: err}
	}()
	close(release)
	successes := 0
	conflicts := 0
	for range 2 {
		result := <-outcomes
		switch {
		case result.err == nil:
			successes++
		case errors.Is(result.err, ErrVersionConflict):
			conflicts++
		default:
			t.Fatalf("concurrent help outcome: %v", result.err)
		}
	}
	if successes != 1 || conflicts != 1 {
		t.Fatalf(
			"concurrent accept/supersede successes=%d conflicts=%d",
			successes,
			conflicts,
		)
	}
	due, err := store.DueInteractions(
		ctx,
		clock.value.Add(30*time.Second),
		10,
	)
	if err != nil {
		t.Fatal(err)
	}
	if len(due) > 1 {
		t.Fatalf("more than one actionable deadline survived: %#v", due)
	}
}

func TestExpiredPlayerCommandCommitsSingleTimeout(t *testing.T) {
	fixture := newInteractionFixture(t, 1)
	ctx := context.Background()
	participant := fixture.participants[0]
	projection, err := fixture.service.Get(
		ctx,
		fixture.owner.GameID,
		participant.Credential,
	)
	if err != nil {
		t.Fatal(err)
	}
	action := interactionActionForTest(
		t,
		projection,
		game.InteractionIntentPass,
	)
	fixture.clock.Set(projection.Interaction.DeadlineAt)
	if _, err := fixture.service.ExecuteInteraction(
		ctx,
		fixture.owner.GameID,
		participant.Credential,
		"late-pass",
		projection.Version,
		fixture.interactionID,
		action.ActionID,
		action.Type,
	); !errors.Is(err, ErrInteractionExpired) {
		t.Fatalf("late interaction response: %v", err)
	}
	after, err := fixture.service.Get(
		ctx,
		fixture.owner.GameID,
		participant.Credential,
	)
	if err != nil {
		t.Fatal(err)
	}
	if after.Interaction != nil || after.Version <= projection.Version {
		t.Fatalf("expired interaction was not committed: %#v", after.Interaction)
	}
	due, err := fixture.store.DueInteractions(ctx, fixture.clock.value, 10)
	if err != nil {
		t.Fatal(err)
	}
	if len(due) != 0 {
		t.Fatalf("closed interaction retained deadline: %#v", due)
	}
}

func TestConcurrentTimeoutCandidatesHaveOneWinner(t *testing.T) {
	fixture := newInteractionFixture(t, 1)
	ctx := context.Background()
	participant := fixture.participants[0]
	projection, err := fixture.service.Get(
		ctx,
		fixture.owner.GameID,
		participant.Credential,
	)
	if err != nil {
		t.Fatal(err)
	}
	fixture.clock.Set(projection.Interaction.DeadlineAt)
	candidates, err := fixture.store.DueInteractions(ctx, fixture.clock.value, 10)
	if err != nil || len(candidates) != 1 {
		t.Fatalf("due candidates=%#v err=%v", candidates, err)
	}
	results := make(chan bool, 2)
	failures := make(chan error, 2)
	for range 2 {
		go func() {
			processed, err := fixture.service.ProcessInteractionTimeout(
				ctx,
				candidates[0],
			)
			results <- processed
			failures <- err
		}()
	}
	winners := 0
	for range 2 {
		if err := <-failures; err != nil {
			t.Fatal(err)
		}
		if <-results {
			winners++
		}
	}
	if winners != 1 {
		t.Fatalf("timeout winners=%d", winners)
	}
}

func TestPlayerAndTimeoutRaceHasOneTerminalWinner(t *testing.T) {
	t.Run("player commits before timeout recheck", func(t *testing.T) {
		fixture := newInteractionFixture(t, 1)
		ctx := context.Background()
		participant := fixture.participants[0]
		projection, err := fixture.service.Get(
			ctx,
			fixture.owner.GameID,
			participant.Credential,
		)
		if err != nil {
			t.Fatal(err)
		}
		action := interactionActionForTest(
			t,
			projection,
			game.InteractionIntentPass,
		)
		candidate := InteractionDeadline{
			GameID:           fixture.owner.GameID,
			InteractionID:    fixture.interactionID,
			DeadlineRevision: 1,
			DeadlineAt:       projection.Interaction.DeadlineAt,
		}
		gate := fixture.gatedStore.Arm()
		timeoutResult := make(chan bool, 1)
		timeoutError := make(chan error, 1)
		go func() {
			processed, err := fixture.service.ProcessInteractionTimeout(
				ctx,
				candidate,
			)
			timeoutResult <- processed
			timeoutError <- err
		}()
		<-gate.entered
		fixture.clock.Set(projection.Interaction.DeadlineAt.Add(-time.Nanosecond))
		if _, err := fixture.service.ExecuteInteraction(
			ctx,
			fixture.owner.GameID,
			participant.Credential,
			"player-wins-timeout-race",
			projection.Version,
			fixture.interactionID,
			action.ActionID,
			action.Type,
		); err != nil {
			t.Fatal(err)
		}
		fixture.clock.Set(projection.Interaction.DeadlineAt)
		close(gate.release)
		if err := <-timeoutError; err != nil {
			t.Fatal(err)
		}
		if <-timeoutResult {
			t.Fatal("stale timeout committed after player response")
		}
	})

	t.Run("timeout commits before player lock", func(t *testing.T) {
		fixture := newInteractionFixture(t, 1)
		ctx := context.Background()
		participant := fixture.participants[0]
		projection, err := fixture.service.Get(
			ctx,
			fixture.owner.GameID,
			participant.Credential,
		)
		if err != nil {
			t.Fatal(err)
		}
		action := interactionActionForTest(
			t,
			projection,
			game.InteractionIntentPass,
		)
		gate := fixture.gatedStore.Arm()
		playerError := make(chan error, 1)
		go func() {
			_, err := fixture.service.ExecuteInteraction(
				ctx,
				fixture.owner.GameID,
				participant.Credential,
				"timeout-wins-player-race",
				projection.Version,
				fixture.interactionID,
				action.ActionID,
				action.Type,
			)
			playerError <- err
		}()
		<-gate.entered
		fixture.clock.Set(projection.Interaction.DeadlineAt)
		processed, err := fixture.service.ProcessInteractionTimeout(
			ctx,
			InteractionDeadline{
				GameID:           fixture.owner.GameID,
				InteractionID:    fixture.interactionID,
				DeadlineRevision: 1,
				DeadlineAt:       projection.Interaction.DeadlineAt,
			},
		)
		if err != nil || !processed {
			t.Fatalf("timeout processed=%v err=%v", processed, err)
		}
		close(gate.release)
		if err := <-playerError; !errors.Is(err, ErrVersionConflict) {
			t.Fatalf("player after committed timeout: %v", err)
		}
	})
}

func TestConcurrentPlayerResponsesHaveOneVersionWinner(t *testing.T) {
	fixture := newInteractionFixture(t, 2)
	ctx := context.Background()
	type intent struct {
		participant LobbyResult
		projection  game.Projection
		action      game.InteractionActionView
	}
	intents := make([]intent, 0, 2)
	for _, participant := range fixture.participants {
		projection, err := fixture.service.Get(
			ctx,
			fixture.owner.GameID,
			participant.Credential,
		)
		if err != nil {
			t.Fatal(err)
		}
		intents = append(intents, intent{
			participant: participant,
			projection:  projection,
			action: interactionActionForTest(
				t,
				projection,
				game.InteractionIntentPass,
			),
		})
	}
	type outcome struct {
		result CommandResult
		err    error
	}
	release := make(chan struct{})
	outcomes := make(chan outcome, 2)
	for index, pending := range intents {
		go func(index int, pending intent) {
			<-release
			result, err := fixture.service.ExecuteInteraction(
				ctx,
				fixture.owner.GameID,
				pending.participant.Credential,
				"concurrent-pass-"+string(rune('a'+index)),
				pending.projection.Version,
				fixture.interactionID,
				pending.action.ActionID,
				pending.action.Type,
			)
			outcomes <- outcome{result: result, err: err}
		}(index, pending)
	}
	close(release)
	successes := 0
	conflicts := 0
	for range 2 {
		outcome := <-outcomes
		switch {
		case outcome.err == nil:
			successes++
		case errors.Is(outcome.err, ErrVersionConflict):
			conflicts++
		default:
			t.Fatalf("unexpected concurrent player response: %v", outcome.err)
		}
	}
	if successes != 1 || conflicts != 1 {
		t.Fatalf(
			"concurrent player responses: successes=%d conflicts=%d",
			successes,
			conflicts,
		)
	}
}

func TestLateMaterialResponseAtomicallyReplacesDeadlineRevision(t *testing.T) {
	fixture := newInteractionFixture(t, 2)
	ctx := context.Background()
	participant := fixture.participants[0]
	projection, err := fixture.service.Get(
		ctx,
		fixture.owner.GameID,
		participant.Credential,
	)
	if err != nil {
		t.Fatal(err)
	}
	action := interactionActionForTest(
		t,
		projection,
		game.InteractionIntentRespond,
	)
	otherProjection, err := fixture.service.Get(
		ctx,
		fixture.owner.GameID,
		fixture.participants[1].Credential,
	)
	if err != nil {
		t.Fatal(err)
	}
	staleAction := interactionActionForTest(
		t,
		otherProjection,
		game.InteractionIntentPass,
	)
	originalDeadline := projection.Interaction.DeadlineAt
	fixture.clock.Set(originalDeadline.Add(-29 * time.Second))
	result, err := fixture.service.ExecuteInteraction(
		ctx,
		fixture.owner.GameID,
		participant.Credential,
		"late-material-response",
		projection.Version,
		fixture.interactionID,
		action.ActionID,
		action.Type,
	)
	if err != nil {
		t.Fatal(err)
	}
	if result.Projection.Interaction == nil ||
		!result.Projection.Interaction.DeadlineAt.Equal(
			originalDeadline.Add(10*time.Second),
		) {
		t.Fatalf(
			"extended interaction projection: %#v",
			result.Projection.Interaction,
		)
	}
	dueAtOriginal, err := fixture.store.DueInteractions(
		ctx,
		originalDeadline,
		10,
	)
	if err != nil {
		t.Fatal(err)
	}
	if len(dueAtOriginal) != 0 {
		t.Fatalf("old deadline revision remained due: %#v", dueAtOriginal)
	}
	if _, err := fixture.service.ExecuteInteraction(
		ctx,
		fixture.owner.GameID,
		fixture.participants[1].Credential,
		"stale-projection-action",
		result.Version,
		fixture.interactionID,
		staleAction.ActionID,
		staleAction.Type,
	); !errors.Is(err, ErrInteractionAction) {
		t.Fatalf("stale projection action: %v", err)
	}
	dueAtExtended, err := fixture.store.DueInteractions(
		ctx,
		originalDeadline.Add(10*time.Second),
		10,
	)
	if err != nil || len(dueAtExtended) != 1 ||
		dueAtExtended[0].DeadlineRevision != 2 {
		t.Fatalf("extended deadline=%#v err=%v", dueAtExtended, err)
	}
}

func TestInteractionTimeoutWorkerStopsWithContext(t *testing.T) {
	fixture := newInteractionFixture(t, 1)
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if err := fixture.service.RunInteractionTimeoutWorker(
		ctx,
		time.Millisecond,
		1,
		nil,
	); err != nil {
		t.Fatal(err)
	}
	if err := fixture.service.RunInteractionTimeoutWorker(
		context.Background(),
		0,
		1,
		nil,
	); err == nil {
		t.Fatal("zero interaction sweep interval was accepted")
	}
}

func TestInteractionTimeoutWorkerReportsTransientErrorAndContinues(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	store := &transientDueStore{
		Store:  memory.New(),
		cancel: cancel,
	}
	service := NewService(
		store,
		applicationPack(t),
		&manualClock{
			value: time.Date(2026, time.July, 30, 20, 0, 0, 0, time.UTC),
		},
		NoopPublisher{},
	)
	reported := 0
	if err := service.RunInteractionTimeoutWorker(
		ctx,
		time.Millisecond,
		1,
		func(error) {
			reported++
		},
	); err != nil {
		t.Fatal(err)
	}
	store.mu.Lock()
	calls := store.calls
	store.mu.Unlock()
	if calls < 2 || reported != 1 {
		t.Fatalf("worker calls=%d reported_errors=%d", calls, reported)
	}
}

func interactionActionForTest(
	t *testing.T,
	projection game.Projection,
	intent game.InteractionIntent,
) game.InteractionActionView {
	t.Helper()
	if projection.Interaction == nil {
		t.Fatal("interaction missing from projection")
	}
	for _, action := range projection.Interaction.Actions {
		if action.Type == intent {
			return action
		}
	}
	t.Fatalf("interaction action %q missing: %#v", intent, projection.Interaction)
	return game.InteractionActionView{}
}

func targetRuntimePack(t *testing.T) game.Pack {
	t.Helper()
	pack := game.Pack{
		SchemaVersion: 1,
		SetID:         "moscow-core",
		Version:       3,
		Author:        "tests",
		License:       "CC0-1.0",
		Source:        "target-runtime-test",
		Cards: []game.Card{
			{
				ID:               "runtime-target-curse",
				Name:             "Runtime target curse",
				Deck:             game.DeckDoor,
				Kind:             game.CardCurse,
				Copies:           30,
				InteractionScope: game.InteractionOtherPlayers,
				Effects: []game.Effect{{
					Kind:     game.EffectDiscard,
					Selector: game.SelectorOwnedCard,
					Count:    1,
				}},
			},
			{
				ID:               "runtime-target-filler-monster",
				Name:             "Runtime target filler monster",
				Deck:             game.DeckDoor,
				Kind:             game.CardMonster,
				Copies:           30,
				InteractionScope: game.InteractionNone,
				Monster: &game.MonsterSpec{
					Strength:  2,
					Treasures: 1,
					Levels:    1,
					BadStuff: []game.Effect{{
						Kind:   game.EffectLoseLevel,
						Amount: 1,
					}},
				},
			},
			{
				ID:               "runtime-target-item",
				Name:             "Runtime target item",
				Deck:             game.DeckTreasure,
				Kind:             game.CardItem,
				Copies:           30,
				InteractionScope: game.InteractionSelf,
				Item: &game.ItemSpec{
					Slot:  game.SlotNone,
					Size:  game.SizeSmall,
					Value: 100,
				},
			},
		},
	}
	for index := 0; index < 9; index++ {
		pack.Cards = append(pack.Cards, game.Card{
			ID: fmt.Sprintf(
				"runtime-target-curse-filler-%02d",
				index,
			),
			Name:             "Runtime target curse filler",
			Deck:             game.DeckDoor,
			Kind:             game.CardCurse,
			Copies:           1,
			InteractionScope: game.InteractionOtherPlayers,
			Effects: []game.Effect{{
				Kind:     game.EffectDiscard,
				Selector: game.SelectorOwnedCard,
				Count:    1,
			}},
		})
	}
	pack.ContentDigest = game.CardsDigest(pack.Cards)
	if err := pack.Validate(); err != nil {
		t.Fatal(err)
	}
	return pack
}

func runAwayRuntimePack(t *testing.T) game.Pack {
	t.Helper()
	pack := game.Pack{
		SchemaVersion: 1,
		SetID:         "moscow-core",
		Version:       3,
		Author:        "tests",
		License:       "CC0-1.0",
		Source:        "run-away-runtime-test",
		Cards: []game.Card{
			{
				ID:               "runtime-run-away-monster",
				Name:             "Runtime Run Away monster",
				Deck:             game.DeckDoor,
				Kind:             game.CardMonster,
				Copies:           30,
				InteractionScope: game.InteractionNone,
				Monster: &game.MonsterSpec{
					Strength:  50,
					Treasures: 1,
					Levels:    1,
					BadStuff: []game.Effect{{
						Kind:   game.EffectLoseLevel,
						Amount: 1,
					}},
				},
			},
			{
				ID:               "runtime-run-away-modifier",
				Name:             "Runtime Run Away modifier",
				Deck:             game.DeckTreasure,
				Kind:             game.CardOneShot,
				Copies:           30,
				InteractionScope: game.InteractionSelf,
				Effects: []game.Effect{{
					Kind:   game.EffectModifyEscape,
					Amount: 2,
				}},
			},
		},
	}
	for index := 0; index < 10; index++ {
		pack.Cards = append(pack.Cards, game.Card{
			ID: fmt.Sprintf(
				"runtime-run-away-monster-filler-%02d",
				index,
			),
			Name:             "Runtime Run Away monster filler",
			Deck:             game.DeckDoor,
			Kind:             game.CardMonster,
			Copies:           1,
			InteractionScope: game.InteractionNone,
			Monster: &game.MonsterSpec{
				Strength:  50,
				Treasures: 1,
				Levels:    1,
				BadStuff: []game.Effect{{
					Kind:   game.EffectLoseLevel,
					Amount: 1,
				}},
			},
		})
	}
	pack.ContentDigest = game.CardsDigest(pack.Cards)
	if err := pack.Validate(); err != nil {
		t.Fatal(err)
	}
	return pack
}

type twoPlayerRuntimeFixture struct {
	service *Service
	store   *memory.Store
	clock   *manualClock
	owner   LobbyResult
	other   LobbyResult
	current CommandResult
}

func newTwoPlayerRuntimeFixture(
	t *testing.T,
	pack game.Pack,
	start time.Time,
) twoPlayerRuntimeFixture {
	t.Helper()
	ctx := context.Background()
	const (
		gameID          = "runtime-game"
		ownerID         = "player-a"
		otherID         = "player-b"
		ownerCredential = "target-runtime-alice-credential"
		otherCredential = "target-runtime-bob-credential"
	)
	ownerHash := fmt.Sprintf(
		"%x",
		sha256.Sum256([]byte(ownerCredential)),
	)
	otherHash := fmt.Sprintf(
		"%x",
		sha256.Sum256([]byte(otherCredential)),
	)
	var (
		state     game.State
		envelopes []game.EventEnvelope
	)
	for seed := uint64(1); seed <= 4096; seed++ {
		lobbyEvent, err := game.CreateLobby(
			gameID,
			game.Player{
				ID:             ownerID,
				Name:           "Alice",
				Level:          1,
				CredentialHash: ownerHash,
			},
			pack,
			seed,
		)
		if err != nil {
			t.Fatal(err)
		}
		candidate, candidateEvents := applyRuntimeEvents(
			t,
			game.State{},
			nil,
			"runtime-create",
			[]game.DomainEvent{lobbyEvent},
			start,
		)
		commands := []struct {
			id      string
			command game.Command
		}{
			{
				id: "runtime-join",
				command: game.Command{
					Type:           game.CommandJoin,
					PlayerID:       otherID,
					DisplayName:    "Bob",
					CredentialHash: otherHash,
				},
			},
			{
				id: "runtime-start",
				command: game.Command{
					Type:    game.CommandStart,
					ActorID: ownerID,
				},
			},
			{
				id: "runtime-owner-setup",
				command: game.Command{
					Type:    game.CommandFinishSetup,
					ActorID: ownerID,
				},
			},
			{
				id: "runtime-other-setup",
				command: game.Command{
					Type:    game.CommandFinishSetup,
					ActorID: otherID,
				},
			},
		}
		for _, step := range commands {
			domainEvents, err := game.Handle(
				candidate,
				step.command,
				pack,
			)
			if err != nil {
				t.Fatal(err)
			}
			candidate, candidateEvents = applyRuntimeEvents(
				t,
				candidate,
				candidateEvents,
				step.id,
				domainEvents,
				start,
			)
		}
		if pack.Source == "economy-runtime-test" ||
			pack.Source == "charity-runtime-test" {
			economyBase := candidate.Clone()
			validEconomyHands := true
			for playerIndex := range candidate.Players {
				itemIndex := -1
				for handIndex, instanceID := range candidate.Players[playerIndex].Hand {
					card, _, exists := pack.DefinitionForInstance(
						candidate,
						instanceID,
					)
					if exists && card.Item != nil {
						itemIndex = handIndex
						break
					}
				}
				if itemIndex < 0 {
					validEconomyHands = false
					break
				}
				instanceID := candidate.Players[playerIndex].Hand[itemIndex]
				candidate.Players[playerIndex].Hand = append(
					candidate.Players[playerIndex].Hand[:itemIndex],
					candidate.Players[playerIndex].Hand[itemIndex+1:]...,
				)
				candidate.Players[playerIndex].Carried = append(
					candidate.Players[playerIndex].Carried,
					instanceID,
				)
			}
			if !validEconomyHands {
				continue
			}
			if pack.Source == "charity-runtime-test" {
				candidate.Turn.Phase = game.PhaseCharity
				candidate.Turn.ActionWindow = game.ActionWindow{
					Kind: string(game.PhaseCharity),
					EligibleActorIDs: []string{
						candidate.Turn.PlayerID,
					},
				}
			}
			if err := candidate.Validate(); err != nil {
				t.Fatal(err)
			}
			raw, err := json.Marshal(struct {
				Reason game.CommandType `json:"reason"`
				State  game.State       `json:"state"`
			}{
				Reason: game.CommandPlayCard,
				State:  candidate,
			})
			if err != nil {
				t.Fatal(err)
			}
			candidate, candidateEvents = applyRuntimeEvents(
				t,
				economyBase,
				candidateEvents,
				"runtime-economy-fixture",
				[]game.DomainEvent{{
					Type:    game.EventEquipmentChanged,
					Payload: raw,
				}},
				start,
			)
		}
		if pack.Source == "target-runtime-test" &&
			!playerHasCardKind(candidate, ownerID, game.CardCurse, pack) {
			continue
		}
		state = candidate
		envelopes = candidateEvents
		break
	}
	if state.GameID == "" {
		t.Fatal("deterministic runtime fixture seed was not found")
	}
	store := memory.New()
	clock := &manualClock{value: start}
	service := NewService(store, pack, clock, NoopPublisher{})
	if err := store.Create(ctx, state, envelopes); err != nil {
		t.Fatal(err)
	}
	ownerProjection, err := game.ProjectForActor(state, ownerID, pack)
	if err != nil {
		t.Fatal(err)
	}
	otherProjection, err := game.ProjectForActor(state, otherID, pack)
	if err != nil {
		t.Fatal(err)
	}
	return twoPlayerRuntimeFixture{
		service: service,
		store:   store,
		clock:   clock,
		owner: LobbyResult{
			GameID:     gameID,
			PlayerID:   ownerID,
			Credential: ownerCredential,
			Projection: ownerProjection,
		},
		other: LobbyResult{
			GameID:     gameID,
			PlayerID:   otherID,
			Credential: otherCredential,
			Projection: otherProjection,
		},
		current: CommandResult{
			GameID:     gameID,
			CommandID:  "runtime-other-setup",
			Version:    state.Version,
			Projection: ownerProjection,
		},
	}
}

func applyRuntimeEvents(
	t *testing.T,
	state game.State,
	envelopes []game.EventEnvelope,
	commandID string,
	domainEvents []game.DomainEvent,
	start time.Time,
) (game.State, []game.EventEnvelope) {
	t.Helper()
	next := state
	for _, domainEvent := range domainEvents {
		applied, err := game.Apply(next, domainEvent)
		if err != nil {
			t.Fatal(err)
		}
		envelopes = append(envelopes, game.EventEnvelope{
			GameID:     applied.GameID,
			Sequence:   applied.Version,
			EventID:    fmt.Sprintf("%s:%d", commandID, applied.Version),
			CommandID:  commandID,
			Type:       domainEvent.Type,
			Schema:     1,
			OccurredAt: start.Add(time.Duration(applied.Version) * time.Millisecond),
			Payload:    domainEvent.Payload,
		})
		next = applied
	}
	return next, envelopes
}

func playerHasCardKind(
	state game.State,
	playerID string,
	kind game.CardKind,
	pack game.Pack,
) bool {
	playerIndex := state.PlayerIndex(playerID)
	if playerIndex < 0 {
		return false
	}
	for _, instanceID := range state.Players[playerIndex].Hand {
		card, _, exists := pack.DefinitionForInstance(state, instanceID)
		if exists && card.Kind == kind {
			return true
		}
	}
	return false
}

func economyRuntimePack(t *testing.T, charity bool) game.Pack {
	t.Helper()
	pack := targetRuntimePack(t)
	if charity {
		pack.Source = "charity-runtime-test"
	} else {
		pack.Source = "economy-runtime-test"
	}
	return pack
}

func TestEconomyRuntimeReceiptsCASAndPartyActions(t *testing.T) {
	ctx := context.Background()
	fixture := newTwoPlayerRuntimeFixture(
		t,
		economyRuntimePack(t, false),
		time.Date(2026, time.July, 31, 10, 0, 0, 0, time.UTC),
	)
	ownerCardID := fixture.owner.Projection.You.Carried[0].InstanceID
	otherCardID := fixture.other.Projection.You.Carried[0].InstanceID
	opened, err := fixture.service.ProposeEconomyOffer(
		ctx,
		fixture.owner.GameID,
		fixture.owner.Credential,
		"economy-open",
		fixture.current.Version,
		game.EconomyOfferTrade,
		fixture.other.PlayerID,
		[]string{ownerCardID},
		[]string{otherCardID},
	)
	if err != nil {
		t.Fatal(err)
	}
	if opened.Projection.Interaction == nil ||
		opened.Projection.Interaction.EconomyOffer == nil ||
		opened.Projection.Interaction.EconomyOffer.Kind !=
			game.EconomyOfferTrade {
		t.Fatalf("owner economy projection=%#v", opened.Projection.Interaction)
	}
	replayed, err := fixture.service.ProposeEconomyOffer(
		ctx,
		fixture.owner.GameID,
		fixture.owner.Credential,
		"economy-open",
		fixture.current.Version,
		game.EconomyOfferTrade,
		fixture.other.PlayerID,
		[]string{ownerCardID},
		[]string{otherCardID},
	)
	if err != nil || !replayed.Replayed || replayed.Version != opened.Version {
		t.Fatalf("economy replay=%#v err=%v", replayed, err)
	}
	if _, err := fixture.service.ProposeEconomyOffer(
		ctx,
		fixture.owner.GameID,
		fixture.owner.Credential,
		"economy-open",
		fixture.current.Version,
		game.EconomyOfferGift,
		fixture.other.PlayerID,
		[]string{ownerCardID},
		nil,
	); !errors.Is(err, ErrIdempotencyConflict) {
		t.Fatalf("economy fingerprint conflict=%v", err)
	}
	recipientProjection, err := fixture.service.Get(
		ctx,
		fixture.owner.GameID,
		fixture.other.Credential,
	)
	if err != nil {
		t.Fatal(err)
	}
	accept := interactionActionForTest(
		t,
		recipientProjection,
		game.InteractionIntentAccept,
	)
	accepted, err := fixture.service.ExecuteInteraction(
		ctx,
		fixture.owner.GameID,
		fixture.other.Credential,
		"economy-accept",
		opened.Version,
		recipientProjection.Interaction.InteractionID,
		accept.ActionID,
		game.InteractionIntentAccept,
	)
	if err != nil {
		t.Fatal(err)
	}
	if accepted.Projection.Interaction != nil ||
		len(accepted.Projection.You.Carried) == 0 ||
		accepted.Projection.You.Carried[0].InstanceID != ownerCardID {
		t.Fatalf("accepted economy projection=%#v", accepted.Projection)
	}
	if _, err := fixture.service.ExecuteInteraction(
		ctx,
		fixture.owner.GameID,
		fixture.other.Credential,
		"economy-stale-decline",
		opened.Version,
		recipientProjection.Interaction.InteractionID,
		accept.ActionID,
		game.InteractionIntentDecline,
	); !errors.Is(err, ErrVersionConflict) {
		t.Fatalf("stale economy response=%v", err)
	}
}

func TestCharityRuntimeManualAndTimeoutUseStableAllocation(t *testing.T) {
	for _, automatic := range []bool{false, true} {
		t.Run(fmt.Sprintf("automatic=%t", automatic), func(t *testing.T) {
			ctx := context.Background()
			fixture := newTwoPlayerRuntimeFixture(
				t,
				economyRuntimePack(t, true),
				time.Date(2026, time.July, 31, 10, 30, 0, 0, time.UTC),
			)
			opened, err := fixture.service.ResolveCharity(
				ctx,
				fixture.owner.GameID,
				fixture.owner.Credential,
				"charity-open",
				fixture.current.Version,
				nil,
				nil,
			)
			if err != nil {
				t.Fatal(err)
			}
			view := opened.Projection.Interaction
			if view == nil ||
				view.CharityTransfer == nil ||
				view.CharityTransfer.Excess < 1 {
				t.Fatalf("charity projection=%#v", view)
			}
			if automatic {
				fixture.clock.Set(view.DeadlineAt)
				processed, err := fixture.service.SweepDueInteractions(
					ctx,
					10,
				)
				if err != nil || processed != 1 {
					t.Fatalf("charity sweep=%d err=%v", processed, err)
				}
				projection, err := fixture.service.Get(
					ctx,
					fixture.owner.GameID,
					fixture.owner.Credential,
				)
				if err != nil {
					t.Fatal(err)
				}
				if projection.Turn.Phase != game.PhaseEndTurn ||
					projection.Interaction != nil {
					t.Fatalf("timed charity projection=%#v", projection)
				}
				return
			}
			allocations := make(
				[]game.CharityAllocation,
				view.CharityTransfer.Excess,
			)
			for index := range allocations {
				allocations[index] = game.CharityAllocation{
					InstanceID: view.CharityTransfer.InstanceIDs[index],
					RecipientPlayerID: view.CharityTransfer.EligibleRecipientIDs[index%len(
						view.CharityTransfer.EligibleRecipientIDs,
					)],
				}
			}
			resolved, err := fixture.service.ResolveCharity(
				ctx,
				fixture.owner.GameID,
				fixture.owner.Credential,
				"charity-resolve",
				opened.Version,
				nil,
				allocations,
			)
			if err != nil {
				t.Fatal(err)
			}
			replayed, err := fixture.service.ResolveCharity(
				ctx,
				fixture.owner.GameID,
				fixture.owner.Credential,
				"charity-resolve",
				opened.Version,
				nil,
				allocations,
			)
			if err != nil ||
				!replayed.Replayed ||
				replayed.Version != resolved.Version {
				t.Fatalf("charity replay=%#v err=%v", replayed, err)
			}
		})
	}
}

func TestTargetEffectTimeoutRestoresSameDeadlineAndUsesStableDefault(
	t *testing.T,
) {
	ctx := context.Background()
	fixture := newTwoPlayerRuntimeFixture(
		t,
		targetRuntimePack(t),
		time.Date(2026, time.July, 31, 9, 0, 0, 0, time.UTC),
	)
	ownerProjection, err := fixture.service.Get(
		ctx,
		fixture.owner.GameID,
		fixture.owner.Credential,
	)
	if err != nil {
		t.Fatal(err)
	}
	var targetSourceID string
	for _, card := range ownerProjection.You.Hand {
		if card.Kind == game.CardCurse {
			targetSourceID = card.InstanceID
			break
		}
	}
	if targetSourceID == "" {
		t.Fatal("target source was not dealt")
	}
	started, err := fixture.service.PlayTargetEffect(
		ctx,
		fixture.owner.GameID,
		fixture.owner.Credential,
		"target-runtime-play",
		fixture.current.Version,
		targetSourceID,
		fixture.other.PlayerID,
	)
	if err != nil {
		t.Fatal(err)
	}
	replayed, err := fixture.service.PlayTargetEffect(
		ctx,
		fixture.owner.GameID,
		fixture.owner.Credential,
		"target-runtime-play",
		fixture.current.Version,
		targetSourceID,
		fixture.other.PlayerID,
	)
	if err != nil || !replayed.Replayed ||
		replayed.Version != started.Version {
		t.Fatalf("target receipt replay=%#v err=%v", replayed, err)
	}
	targetProjection, err := fixture.service.Get(
		ctx,
		fixture.owner.GameID,
		fixture.other.Credential,
	)
	if err != nil {
		t.Fatal(err)
	}
	if targetProjection.Interaction == nil ||
		targetProjection.Interaction.PublicKind != "target_response" ||
		targetProjection.Interaction.DeadlineAt.Sub(
			*targetProjection.Interaction.ServerTime,
		) != 30*time.Second {
		t.Fatalf("opaque target deadline: %#v", targetProjection.Interaction)
	}
	responseDeadline := targetProjection.Interaction.DeadlineAt
	reconnected, err := fixture.service.Get(
		ctx,
		fixture.owner.GameID,
		fixture.other.Credential,
	)
	if err != nil {
		t.Fatal(err)
	}
	if reconnected.Interaction == nil ||
		!reconnected.Interaction.DeadlineAt.Equal(responseDeadline) {
		t.Fatalf("reconnect changed target deadline: %#v", reconnected.Interaction)
	}
	pass := interactionActionForTest(
		t,
		targetProjection,
		game.InteractionIntentPass,
	)
	fixture.clock.Set(responseDeadline.Add(-time.Second))
	privateResult, err := fixture.service.ExecuteInteraction(
		ctx,
		fixture.owner.GameID,
		fixture.other.Credential,
		"target-runtime-pass",
		targetProjection.Version,
		targetProjection.Interaction.InteractionID,
		pass.ActionID,
		pass.Type,
	)
	if err != nil {
		t.Fatal(err)
	}
	private := privateResult.Projection.Interaction
	if private == nil ||
		private.PublicKind != "private_choice" ||
		!private.ResponseRequiredForYou ||
		private.DeadlineAt.Sub(*private.ServerTime) != 30*time.Second ||
		privateResult.Projection.Turn.PendingDecision == nil {
		t.Fatalf("private target continuation: %#v", privateResult.Projection)
	}
	defaultChoiceID :=
		privateResult.Projection.Turn.PendingDecision.Options[0]
	if _, err := fixture.service.ExecuteInteraction(
		ctx,
		fixture.owner.GameID,
		fixture.other.Credential,
		"target-runtime-invalid-choice",
		privateResult.Version,
		private.InteractionID,
		"act_ffffffffffffffffffffffffffffffff",
		game.InteractionIntentRespond,
	); err == nil {
		t.Fatal("non-projected private choice action was accepted")
	}
	privateDeadline := private.DeadlineAt
	fixture.clock.Set(privateDeadline)
	processed, err := fixture.service.SweepDueInteractions(ctx, 10)
	if err != nil || processed != 1 {
		t.Fatalf("private timeout processed=%d err=%v", processed, err)
	}
	finalProjection, err := fixture.service.Get(
		ctx,
		fixture.owner.GameID,
		fixture.other.Credential,
	)
	if err != nil {
		t.Fatal(err)
	}
	if finalProjection.Interaction != nil ||
		finalProjection.Turn.PendingDecision != nil ||
		finalProjection.Turn.Phase != game.PhasePreparation {
		t.Fatalf("target timeout did not resume parent: %#v", finalProjection)
	}
	var finalState game.State
	if err := fixture.store.WithinGame(
		ctx,
		fixture.owner.GameID,
		func(tx Tx) error {
			finalState = tx.State()
			return nil
		},
	); err != nil {
		t.Fatal(err)
	}
	targetIndex := finalState.PlayerIndex(fixture.other.PlayerID)
	for _, instanceID := range finalState.Players[targetIndex].Hand {
		if instanceID == defaultChoiceID {
			t.Fatalf("stable timeout choice remained owned: %s", instanceID)
		}
	}
}

func TestRunAwayTimeoutPersistsServerRollAndCompletesStep(t *testing.T) {
	ctx := context.Background()
	fixture := newTwoPlayerRuntimeFixture(
		t,
		runAwayRuntimePack(t),
		time.Date(2026, time.July, 31, 10, 0, 0, 0, time.UTC),
	)
	opened, err := fixture.service.Execute(
		ctx,
		fixture.owner.GameID,
		fixture.owner.Credential,
		"run-away-runtime-door",
		fixture.current.Version,
		game.Command{Type: game.CommandOpenDoor},
	)
	if err != nil {
		t.Fatal(err)
	}
	requested, err := fixture.service.RequestCombatResolution(
		ctx,
		fixture.owner.GameID,
		fixture.owner.Credential,
		"run-away-runtime-request",
		opened.Version,
	)
	if err != nil {
		t.Fatal(err)
	}
	responder, err := fixture.service.Get(
		ctx,
		fixture.owner.GameID,
		fixture.other.Credential,
	)
	if err != nil {
		t.Fatal(err)
	}
	pass := interactionActionForTest(
		t,
		responder,
		game.InteractionIntentPass,
	)
	fixture.clock.Set(
		responder.Interaction.DeadlineAt.Add(-time.Second),
	)
	runAwayOpened, err := fixture.service.ExecuteInteraction(
		ctx,
		fixture.owner.GameID,
		fixture.other.Credential,
		"run-away-runtime-combat-pass",
		responder.Version,
		responder.Interaction.InteractionID,
		pass.ActionID,
		pass.Type,
	)
	if err != nil {
		t.Fatal(err)
	}
	if runAwayOpened.Projection.Interaction == nil ||
		runAwayOpened.Projection.Interaction.PublicKind !=
			"run_away_response" ||
		runAwayOpened.Projection.Turn.RunAway == nil {
		t.Fatalf("Run Away followup was not atomic: %#v", runAwayOpened.Projection)
	}
	runAwayDeadline := runAwayOpened.Projection.Interaction.DeadlineAt
	reconnected, err := fixture.service.Get(
		ctx,
		fixture.owner.GameID,
		fixture.owner.Credential,
	)
	if err != nil {
		t.Fatal(err)
	}
	if reconnected.Interaction == nil ||
		!reconnected.Interaction.DeadlineAt.Equal(runAwayDeadline) {
		t.Fatalf("Run Away reconnect changed deadline: %#v", reconnected.Interaction)
	}
	fixture.clock.Set(runAwayDeadline)
	processed, err := fixture.service.SweepDueInteractions(ctx, 10)
	if err != nil || processed != 1 {
		t.Fatalf("Run Away timeout processed=%d err=%v", processed, err)
	}
	finalProjection, err := fixture.service.Get(
		ctx,
		fixture.owner.GameID,
		fixture.owner.Credential,
	)
	if err != nil {
		t.Fatal(err)
	}
	if finalProjection.Interaction != nil ||
		finalProjection.Turn.RunAway == nil ||
		!finalProjection.Turn.RunAway.Completed ||
		len(finalProjection.Turn.RunAway.Attempts) != 1 ||
		finalProjection.Turn.RunAway.Attempts[0].Roll < 1 ||
		finalProjection.Turn.RunAway.Attempts[0].Roll > 6 ||
		finalProjection.Turn.Phase != game.PhaseCharity {
		t.Fatalf("persisted Run Away timeout: %#v", finalProjection)
	}
	if requested.Version >= runAwayOpened.Version {
		t.Fatalf(
			"Run Away followup did not advance version: request=%d followup=%d",
			requested.Version,
			runAwayOpened.Version,
		)
	}
}
