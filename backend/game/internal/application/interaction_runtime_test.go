package application_test

import (
	"context"
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
