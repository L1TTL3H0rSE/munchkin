package telemetry_test

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"testing"

	"github.com/leinodev/munchkin/backend/game/internal/application"
	"github.com/leinodev/munchkin/backend/game/internal/game"
	"github.com/leinodev/munchkin/backend/game/internal/repository/memory"
	"github.com/leinodev/munchkin/backend/game/internal/telemetry"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	oteltrace "go.opentelemetry.io/otel/trace"
)

type captureRecorder struct {
	mu      sync.Mutex
	signals []telemetry.InteractionSignal
}

type traceCaptureStore struct {
	application.Store
	mu       sync.Mutex
	observed bool
}

func (store *traceCaptureStore) WithinGame(
	ctx context.Context,
	gameID string,
	operation func(application.Tx) error,
) error {
	store.mu.Lock()
	store.observed = store.observed ||
		oteltrace.SpanContextFromContext(ctx).IsValid()
	store.mu.Unlock()
	return store.Store.WithinGame(ctx, gameID, operation)
}

func (store *traceCaptureStore) sawTraceContext() bool {
	store.mu.Lock()
	defer store.mu.Unlock()
	return store.observed
}

func (recorder *captureRecorder) StartHTTP(
	ctx context.Context,
	_ telemetry.HTTPStart,
) (context.Context, func(telemetry.HTTPEnd)) {
	return ctx, func(telemetry.HTTPEnd) {}
}

func (recorder *captureRecorder) RecordInteraction(
	_ context.Context,
	signal telemetry.InteractionSignal,
) {
	recorder.mu.Lock()
	defer recorder.mu.Unlock()
	recorder.signals = append(recorder.signals, signal)
}

func (recorder *captureRecorder) snapshot() []telemetry.InteractionSignal {
	recorder.mu.Lock()
	defer recorder.mu.Unlock()
	return append([]telemetry.InteractionSignal(nil), recorder.signals...)
}

func telemetryApplicationPack(t *testing.T) game.Pack {
	t.Helper()
	cards := make([]game.Card, 0, 50)
	for index := 0; index < 25; index++ {
		cards = append(cards, game.Card{
			ID:               fmt.Sprintf("telemetry-door-%02d", index),
			Name:             fmt.Sprintf("Telemetry Door %02d", index),
			Deck:             game.DeckDoor,
			Kind:             game.CardCurse,
			Copies:           1,
			InteractionScope: game.InteractionSelf,
			Effects: []game.Effect{{
				Kind:   game.EffectLoseLevel,
				Amount: 1,
			}},
		})
		cards = append(cards, game.Card{
			ID:               fmt.Sprintf("telemetry-treasure-%02d", index),
			Name:             fmt.Sprintf("Telemetry Treasure %02d", index),
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
		SetID:         "telemetry-test",
		Version:       1,
		Author:        "tests",
		License:       "CC0-1.0",
		Source:        "telemetry-application-test",
		Cards:         cards,
	}
	pack.ContentDigest = game.CardsDigest(pack.Cards)
	if err := pack.Validate(); err != nil {
		t.Fatal(err)
	}
	return pack
}

func TestApplicationEmitsStaleHelperAndRetryAggregates(t *testing.T) {
	tracerProvider := sdktrace.NewTracerProvider()
	t.Cleanup(func() {
		_ = tracerProvider.Shutdown(context.Background())
	})
	ctx, span := tracerProvider.Tracer("telemetry-application-test").Start(
		context.Background(),
		"request",
	)
	defer span.End()
	store := &traceCaptureStore{Store: memory.New()}
	service := application.NewService(
		store,
		telemetryApplicationPack(t),
		application.SystemClock{},
		application.NoopPublisher{},
	)
	recorder := &captureRecorder{}
	service.SetTelemetry(recorder)
	owner, err := service.CreateLobby(ctx, "Alice")
	if err != nil {
		t.Fatal(err)
	}
	responder, err := service.JoinLobby(
		ctx,
		owner.GameID,
		"telemetry-responder-credential",
		"telemetry-join",
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
		"telemetry-start",
		responder.Projection.Version,
		game.Command{Type: game.CommandStart},
	)
	if err != nil {
		t.Fatal(err)
	}
	interactionID, err := service.OpenInteraction(
		ctx,
		owner.GameID,
		"telemetry-open-helper",
		started.Version,
		application.InteractionOpenSpec{
			Kind: game.InteractionKindAddressedResponse,
			Parent: game.InteractionParent{
				Phase:       started.Projection.Turn.Phase,
				SubjectKind: game.InteractionSubjectTurn,
				SubjectID:   started.Projection.Turn.PlayerID,
			},
			InitiatorActorID:  owner.PlayerID,
			EligibilityPolicy: game.InteractionEligibilityActorPrivate,
			AllowedIntents: []game.InteractionIntent{
				game.InteractionIntentPass,
				game.InteractionIntentAccept,
				game.InteractionIntentDecline,
			},
			Participants: []application.InteractionParticipant{{
				ActorID:       responder.PlayerID,
				Requirement:   game.InteractionResponseOptional,
				TimeoutIntent: game.InteractionIntentPass,
			}},
			DeadlinePolicy: game.AddressedInteractionDeadlinePolicy(),
		},
	)
	if err != nil {
		t.Fatal(err)
	}
	projection, err := service.Get(
		ctx,
		owner.GameID,
		responder.Credential,
	)
	if err != nil {
		t.Fatal(err)
	}
	var accept game.InteractionActionView
	for _, action := range projection.Interaction.Actions {
		if action.Type == game.InteractionIntentAccept {
			accept = action
			break
		}
	}
	if accept.ActionID == "" || accept.InteractionID != interactionID {
		t.Fatalf("accept action=%#v", accept)
	}
	_, err = service.ExecuteInteraction(
		ctx,
		owner.GameID,
		responder.Credential,
		"telemetry-stale-helper",
		projection.Version-1,
		interactionID,
		accept.ActionID,
		accept.Type,
	)
	if !errors.Is(err, application.ErrVersionConflict) {
		t.Fatalf("stale helper error=%v", err)
	}
	accepted, err := service.ExecuteInteraction(
		ctx,
		owner.GameID,
		responder.Credential,
		"telemetry-accept-helper",
		projection.Version,
		interactionID,
		accept.ActionID,
		accept.Type,
	)
	if err != nil {
		t.Fatal(err)
	}
	replayed, err := service.ExecuteInteraction(
		ctx,
		owner.GameID,
		responder.Credential,
		"telemetry-accept-helper",
		projection.Version,
		interactionID,
		accept.ActionID,
		accept.Type,
	)
	if err != nil || !replayed.Replayed ||
		replayed.Version != accepted.Version {
		t.Fatalf("helper replay=%#v err=%v", replayed, err)
	}
	signals := recorder.snapshot()
	if len(signals) != 3 {
		t.Fatalf("signals=%#v", signals)
	}
	if signals[0].Kind != "addressed_response" ||
		signals[0].Outcome != telemetry.OutcomeVersionConflict ||
		!signals[0].Stale {
		t.Fatalf("stale signal=%#v", signals[0])
	}
	if signals[1].Response != telemetry.ResponseAccept ||
		signals[1].Outcome != telemetry.OutcomeSuccess {
		t.Fatalf("accept signal=%#v", signals[1])
	}
	if signals[2].Outcome != telemetry.OutcomeReplay ||
		!signals[2].Retry {
		t.Fatalf("retry signal=%#v", signals[2])
	}
	if !store.sawTraceContext() {
		t.Fatal("application did not propagate request trace context to Store")
	}
}
