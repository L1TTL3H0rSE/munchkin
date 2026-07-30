package game

import (
	"reflect"
	"strings"
	"testing"
	"time"
)

func interactionTestState(
	t *testing.T,
	playerCount int,
) (State, Pack, []EventEnvelope) {
	t.Helper()
	pack := testPack(t)
	state, envelopes := startedState(t, pack, playerCount)
	state, setup := finishSetup(t, state, pack)
	return state, pack, append(envelopes, setup...)
}

func interactionWindowForTest(
	state State,
	openedAt time.Time,
	actorIDs []string,
	mandatory map[string]bool,
) *InteractionWindow {
	allowedIntents := []InteractionIntent{
		InteractionIntentPass,
		InteractionIntentRespond,
	}
	for _, actorID := range actorIDs {
		if mandatory[actorID] {
			allowedIntents = append(
				allowedIntents,
				InteractionIntentAutoResolve,
			)
			break
		}
	}
	responses := make(map[string]InteractionResponse, len(actorIDs))
	for _, actorID := range actorIDs {
		response := InteractionResponse{
			Requirement:   InteractionResponseOptional,
			TimeoutIntent: InteractionIntentPass,
			State:         InteractionResponsePending,
		}
		if mandatory[actorID] {
			response.Requirement = InteractionResponseMandatory
			response.TimeoutIntent = InteractionIntentAutoResolve
		}
		responses[actorID] = response
	}
	policy := CollectiveInteractionDeadlinePolicy()
	return &InteractionWindow{
		ID:   "int_test_opaque",
		Kind: InteractionKindCombatResponse,
		Parent: InteractionParent{
			Phase:       state.Turn.Phase,
			SubjectKind: InteractionSubjectTurn,
			SubjectID:   state.Turn.PlayerID,
		},
		InitiatorActorID:       state.Turn.PlayerID,
		EligibilityPolicy:      InteractionEligibilityOpaquePublicSet,
		AllowedIntents:         allowedIntents,
		EligibleActorIDs:       append([]string(nil), actorIDs...),
		OpenedAt:               openedAt,
		DeadlineAt:             openedAt.Add(time.Duration(policy.BaseSeconds) * time.Second),
		DeadlineRevision:       1,
		DeadlinePolicy:         policy,
		ExtensionBudgetSeconds: policy.MaxSeconds - policy.BaseSeconds,
		Responses:              responses,
		Status:                 InteractionWindowOpen,
	}
}

func openInteractionForTest(
	t *testing.T,
	state State,
	pack Pack,
	window *InteractionWindow,
) (State, []EventEnvelope) {
	t.Helper()
	events, err := Handle(state, Command{
		Type:              CommandOpenInteractionWindow,
		ActorID:           window.InitiatorActorID,
		InteractionWindow: window,
	}, pack)
	if err != nil {
		t.Fatal(err)
	}
	return applyForTest(t, state, events)
}

func assertInteractionRejected(
	t *testing.T,
	state State,
	pack Pack,
	command Command,
) {
	t.Helper()
	events, err := Handle(state, command, pack)
	if err == nil {
		t.Fatalf("%s unexpectedly succeeded with events %#v", command.Type, events)
	}
	if events != nil {
		t.Fatalf("%s returned events on rejection: %#v", command.Type, events)
	}
}

func TestInteractionWindowModelCloneAndValidation(t *testing.T) {
	state, _, _ := interactionTestState(t, 3)
	openedAt := time.Date(2026, time.July, 30, 12, 0, 0, 0, time.UTC)
	state.InteractionWindow = interactionWindowForTest(
		state,
		openedAt,
		[]string{"player-b", "player-c"},
		nil,
	)
	if err := state.Validate(); err != nil {
		t.Fatal(err)
	}

	clone := state.Clone()
	clone.InteractionWindow.AllowedIntents[0] = InteractionIntentAccept
	clone.InteractionWindow.EligibleActorIDs[0] = "player-a"
	response := clone.InteractionWindow.Responses["player-b"]
	response.State = InteractionResponsePassed
	clone.InteractionWindow.Responses["player-b"] = response
	if state.InteractionWindow.AllowedIntents[0] != InteractionIntentPass ||
		state.InteractionWindow.EligibleActorIDs[0] != "player-b" ||
		state.InteractionWindow.Responses["player-b"].State !=
			InteractionResponsePending {
		t.Fatal("State.Clone shared interaction window collections")
	}

	tests := []struct {
		name   string
		mutate func(*InteractionWindow)
	}{
		{
			name: "duplicate actor",
			mutate: func(window *InteractionWindow) {
				window.EligibleActorIDs = append(
					window.EligibleActorIDs,
					window.EligibleActorIDs[0],
				)
			},
		},
		{
			name: "unknown kind",
			mutate: func(window *InteractionWindow) {
				window.Kind = "unknown"
			},
		},
		{
			name: "unknown eligibility policy",
			mutate: func(window *InteractionWindow) {
				window.EligibilityPolicy = "unknown"
			},
		},
		{
			name: "stale parent subject",
			mutate: func(window *InteractionWindow) {
				window.Parent.SubjectID = "other-turn"
			},
		},
		{
			name: "unknown intent",
			mutate: func(window *InteractionWindow) {
				window.AllowedIntents[0] = "unknown"
			},
		},
		{
			name: "unknown response state",
			mutate: func(window *InteractionWindow) {
				response := window.Responses["player-b"]
				response.State = "unknown"
				window.Responses["player-b"] = response
			},
		},
		{
			name: "deadline beyond hard cap",
			mutate: func(window *InteractionWindow) {
				window.DeadlineAt = window.OpenedAt.Add(91 * time.Second)
				window.ExtensionBudgetSeconds = 0
			},
		},
		{
			name: "open window has close state",
			mutate: func(window *InteractionWindow) {
				window.CloseReason = InteractionCloseCancelled
				window.ClosedAt = window.OpenedAt
			},
		},
		{
			name: "closed window lacks reason",
			mutate: func(window *InteractionWindow) {
				window.Status = InteractionWindowClosed
				window.ClosedAt = window.OpenedAt
			},
		},
		{
			name: "response for ineligible actor",
			mutate: func(window *InteractionWindow) {
				window.Responses["player-a"] = InteractionResponse{
					Requirement:   InteractionResponseOptional,
					TimeoutIntent: InteractionIntentPass,
					State:         InteractionResponsePending,
				}
			},
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			invalid := state.Clone()
			test.mutate(invalid.InteractionWindow)
			if err := invalid.Validate(); err == nil {
				t.Fatal("invalid interaction window passed validation")
			}
		})
	}
}

func TestInteractionWindowOpenRespondPassCloseAndReplay(t *testing.T) {
	state, pack, _ := interactionTestState(t, 3)
	base := state.Clone()
	openedAt := time.Date(2026, time.July, 30, 13, 0, 0, 0, time.UTC)
	window := interactionWindowForTest(
		state,
		openedAt,
		[]string{"player-b", "player-c"},
		nil,
	)

	opened, err := Handle(state, Command{
		Type:              CommandOpenInteractionWindow,
		ActorID:           "player-a",
		InteractionWindow: window,
	}, pack)
	if err != nil {
		t.Fatal(err)
	}
	if len(opened) != 1 || opened[0].Type != EventInteractionWindowOpened {
		t.Fatalf("open events: %#v", opened)
	}
	if state.InteractionWindow != nil {
		t.Fatal("Handle mutated input state")
	}
	var all []EventEnvelope
	state, envelopes := applyForTest(t, state, opened)
	all = append(all, envelopes...)

	respondCommand := Command{
		Type:              CommandRespondInteraction,
		ActorID:           "player-b",
		InteractionID:     window.ID,
		InteractionIntent: InteractionIntentRespond,
		InteractionAt:     openedAt.Add(31 * time.Second),
	}
	first, err := Handle(state, respondCommand, pack)
	if err != nil {
		t.Fatal(err)
	}
	second, err := Handle(state, respondCommand, pack)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(first, second) {
		t.Fatalf("same base state and command differed:\n%#v\n%#v", first, second)
	}
	if len(first) != 1 ||
		first[0].Type != EventInteractionResponseRecorded {
		t.Fatalf("respond events: %#v", first)
	}
	state, envelopes = applyForTest(t, state, first)
	all = append(all, envelopes...)
	if got := state.InteractionWindow.DeadlineAt; !got.Equal(
		openedAt.Add(70 * time.Second),
	) {
		t.Fatalf("extended deadline: %s", got)
	}
	if state.InteractionWindow.DeadlineRevision != 2 ||
		state.InteractionWindow.ExtensionBudgetSeconds != 20 {
		t.Fatalf("extension state: %#v", state.InteractionWindow)
	}

	passed, err := Handle(state, Command{
		Type:          CommandPassInteraction,
		ActorID:       "player-c",
		InteractionID: window.ID,
		InteractionAt: openedAt.Add(32 * time.Second),
	}, pack)
	if err != nil {
		t.Fatal(err)
	}
	state, envelopes = applyForTest(t, state, passed)
	all = append(all, envelopes...)

	closed, err := Handle(state, Command{
		Type:          CommandCloseInteractionWindow,
		ActorID:       "player-a",
		InteractionID: window.ID,
		InteractionAt: openedAt.Add(33 * time.Second),
	}, pack)
	if err != nil {
		t.Fatal(err)
	}
	if len(closed) != 1 || closed[0].Type != EventInteractionWindowClosed {
		t.Fatalf("close events: %#v", closed)
	}
	state, envelopes = applyForTest(t, state, closed)
	all = append(all, envelopes...)
	if state.InteractionWindow.Status != InteractionWindowClosed ||
		state.InteractionWindow.CloseReason != InteractionCloseAllResponded {
		t.Fatalf("closed window: %#v", state.InteractionWindow)
	}

	replayed, err := ReplayFrom(base, all)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(state, replayed) {
		t.Fatalf("interaction replay differs:\nstate=%#v\nreplayed=%#v", state, replayed)
	}
}

func TestInteractionWindowDeadlineExtensionHasHardCap(t *testing.T) {
	state, pack, _ := interactionTestState(t, 5)
	openedAt := time.Date(2026, time.July, 30, 14, 0, 0, 0, time.UTC)
	window := interactionWindowForTest(
		state,
		openedAt,
		[]string{"player-b", "player-c", "player-d", "player-e"},
		nil,
	)
	state, _ = openInteractionForTest(t, state, pack, window)

	for index, actorID := range window.EligibleActorIDs {
		events, err := Handle(state, Command{
			Type:              CommandRespondInteraction,
			ActorID:           actorID,
			InteractionID:     window.ID,
			InteractionIntent: InteractionIntentRespond,
			InteractionAt: openedAt.Add(
				time.Duration(31+index*10) * time.Second,
			),
		}, pack)
		if err != nil {
			t.Fatal(err)
		}
		state, _ = applyForTest(t, state, events)
	}
	if got := state.InteractionWindow.DeadlineAt; !got.Equal(
		openedAt.Add(90 * time.Second),
	) {
		t.Fatalf("hard-capped deadline: %s", got)
	}
	if state.InteractionWindow.DeadlineRevision != 4 ||
		state.InteractionWindow.ExtensionBudgetSeconds != 0 {
		t.Fatalf("hard-cap state: %#v", state.InteractionWindow)
	}
}

func TestInteractionWindowTimeoutAutoPassesAndCloses(t *testing.T) {
	state, pack, _ := interactionTestState(t, 3)
	base := state.Clone()
	openedAt := time.Date(2026, time.July, 30, 15, 0, 0, 0, time.UTC)
	window := interactionWindowForTest(
		state,
		openedAt,
		[]string{"player-b", "player-c"},
		map[string]bool{"player-c": true},
	)
	state, opened := openInteractionForTest(t, state, pack, window)

	assertInteractionRejected(t, state, pack, Command{
		Type:                CommandTimeoutInteraction,
		InteractionID:       window.ID,
		InteractionAt:       window.DeadlineAt,
		InteractionRevision: 2,
	})
	events, err := Handle(state, Command{
		Type:                CommandTimeoutInteraction,
		InteractionID:       window.ID,
		InteractionAt:       window.DeadlineAt,
		InteractionRevision: 1,
	}, pack)
	if err != nil {
		t.Fatal(err)
	}
	if len(events) != 3 ||
		events[0].Type != EventInteractionResponseRecorded ||
		events[1].Type != EventInteractionResponseRecorded ||
		events[2].Type != EventInteractionWindowClosed {
		t.Fatalf("timeout events: %#v", events)
	}
	state, timedOut := applyForTest(t, state, events)
	if state.InteractionWindow.Responses["player-b"].State !=
		InteractionResponseTimedOut ||
		state.InteractionWindow.Responses["player-c"].State !=
			InteractionResponseAutoResolved ||
		state.InteractionWindow.Status != InteractionWindowClosed ||
		state.InteractionWindow.CloseReason != InteractionCloseDeadlineExpired {
		t.Fatalf("timeout state: %#v", state.InteractionWindow)
	}

	all := append(append([]EventEnvelope(nil), opened...), timedOut...)
	replayed, err := ReplayFrom(base, all)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(state, replayed) {
		t.Fatalf("timeout replay differs:\nstate=%#v\nreplayed=%#v", state, replayed)
	}
}

func TestInteractionWindowRejectsIllegalStaleAndClosedTransitions(t *testing.T) {
	state, pack, _ := interactionTestState(t, 3)
	openedAt := time.Date(2026, time.July, 30, 16, 0, 0, 0, time.UTC)
	window := interactionWindowForTest(
		state,
		openedAt,
		[]string{"player-b", "player-c"},
		nil,
	)
	state, _ = openInteractionForTest(t, state, pack, window)

	assertInteractionRejected(t, state, pack, Command{
		Type:              CommandRespondInteraction,
		ActorID:           "player-a",
		InteractionID:     window.ID,
		InteractionIntent: InteractionIntentRespond,
		InteractionAt:     openedAt.Add(time.Second),
	})
	assertInteractionRejected(t, state, pack, Command{
		Type:              CommandRespondInteraction,
		ActorID:           "player-b",
		InteractionID:     "stale",
		InteractionIntent: InteractionIntentRespond,
		InteractionAt:     openedAt.Add(time.Second),
	})
	assertInteractionRejected(t, state, pack, Command{
		Type:              CommandRespondInteraction,
		ActorID:           "player-b",
		InteractionID:     window.ID,
		InteractionIntent: InteractionIntentAccept,
		InteractionAt:     openedAt.Add(time.Second),
	})
	assertInteractionRejected(t, state, pack, Command{
		Type:              CommandRespondInteraction,
		ActorID:           "player-b",
		InteractionID:     window.ID,
		InteractionIntent: InteractionIntentRespond,
		InteractionAt:     window.DeadlineAt,
	})
	assertInteractionRejected(t, state, pack, Command{
		Type:          CommandCloseInteractionWindow,
		ActorID:       "player-b",
		InteractionID: window.ID,
		InteractionAt: openedAt.Add(time.Second),
	})
	assertInteractionRejected(t, state, pack, Command{
		Type:          CommandCloseInteractionWindow,
		ActorID:       "player-a",
		InteractionID: window.ID,
		InteractionAt: openedAt.Add(time.Second),
	})
	assertInteractionRejected(t, state, pack, Command{
		Type:                   CommandCloseInteractionWindow,
		ActorID:                "player-a",
		InteractionID:          window.ID,
		InteractionAt:          window.DeadlineAt,
		InteractionCloseReason: InteractionCloseCancelled,
	})
	assertInteractionRejected(t, state, pack, Command{
		Type:                CommandTimeoutInteraction,
		ActorID:             "player-b",
		InteractionID:       window.ID,
		InteractionAt:       window.DeadlineAt,
		InteractionRevision: 1,
	})
	assertInteractionRejected(t, state, pack, Command{
		Type:                CommandTimeoutInteraction,
		InteractionID:       window.ID,
		InteractionAt:       window.DeadlineAt.Add(-time.Nanosecond),
		InteractionRevision: 1,
	})

	passed, err := Handle(state, Command{
		Type:          CommandPassInteraction,
		ActorID:       "player-b",
		InteractionID: window.ID,
		InteractionAt: openedAt.Add(time.Second),
	}, pack)
	if err != nil {
		t.Fatal(err)
	}
	state, _ = applyForTest(t, state, passed)
	assertInteractionRejected(t, state, pack, Command{
		Type:          CommandPassInteraction,
		ActorID:       "player-b",
		InteractionID: window.ID,
		InteractionAt: openedAt.Add(2 * time.Second),
	})

	cancelled, err := Handle(state, Command{
		Type:                   CommandCloseInteractionWindow,
		ActorID:                "player-a",
		InteractionID:          window.ID,
		InteractionAt:          openedAt.Add(2 * time.Second),
		InteractionCloseReason: InteractionCloseCancelled,
	}, pack)
	if err != nil {
		t.Fatal(err)
	}
	state, _ = applyForTest(t, state, cancelled)
	assertInteractionRejected(t, state, pack, Command{
		Type:          CommandPassInteraction,
		ActorID:       "player-c",
		InteractionID: window.ID,
		InteractionAt: openedAt.Add(3 * time.Second),
	})
	assertInteractionRejected(t, state, pack, Command{
		Type:              CommandOpenInteractionWindow,
		ActorID:           "player-a",
		InteractionWindow: window,
	})
}

func TestLegacyCurrentFlowOmitsAndReplaysZeroInteractionWindow(t *testing.T) {
	state, pack, _ := interactionTestState(t, 2)
	base := state.Clone()
	final, envelopes := completeTurnForTest(t, state, pack, "player-b")
	if final.InteractionWindow != nil {
		t.Fatalf("current flow activated interaction window: %#v", final.InteractionWindow)
	}
	for _, envelope := range envelopes {
		if strings.Contains(string(envelope.Payload), `"interaction_window"`) {
			t.Fatalf("current event payload grew interaction field: %s", envelope.Payload)
		}
	}
	replayed, err := ReplayFrom(base, envelopes)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(final, replayed) || replayed.InteractionWindow != nil {
		t.Fatalf("legacy-compatible replay differs:\nfinal=%#v\nreplayed=%#v", final, replayed)
	}
}

func TestInteractionEventSchemaAndMalformedPayloadFailClosed(t *testing.T) {
	state, pack, _ := interactionTestState(t, 3)
	openedAt := time.Date(2026, time.July, 30, 17, 0, 0, 0, time.UTC)
	window := interactionWindowForTest(
		state,
		openedAt,
		[]string{"player-b", "player-c"},
		nil,
	)
	invalid := *window.clone()
	invalid.Kind = "unknown"
	event, err := newEvent(
		EventInteractionWindowOpened,
		interactionWindowOpenedPayload{Window: invalid},
	)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := Apply(state, event); err == nil {
		t.Fatal("unknown interaction enum replayed")
	}

	events, err := Handle(state, Command{
		Type:              CommandOpenInteractionWindow,
		ActorID:           "player-a",
		InteractionWindow: window,
	}, pack)
	if err != nil {
		t.Fatal(err)
	}
	_, envelopes := applyForTest(t, state, events)
	envelopes[0].Schema = 2
	if _, err := ReplayFrom(state, envelopes); err == nil {
		t.Fatal("unknown interaction envelope schema replayed")
	}

	malformed := DomainEvent{
		Type:    EventInteractionWindowOpened,
		Payload: []byte(`{}`),
	}
	if _, err := Apply(state, malformed); err == nil {
		t.Fatal("malformed interaction payload replayed")
	}
}
