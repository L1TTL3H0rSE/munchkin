package game

import (
	"bytes"
	"encoding/json"
	"reflect"
	"slices"
	"testing"
	"time"
)

func deathLootState(
	t *testing.T,
	playerCount int,
) (State, Pack, []string) {
	t.Helper()
	pack := testPack(t)
	pack.SetID = "moscow-core"
	pack.Version = 4
	pack.Source = "death-loot-test"
	pack.ContentDigest = CardsDigest(pack.Cards)
	if err := pack.Validate(); err != nil {
		t.Fatal(err)
	}
	state, _ := startedState(t, pack, playerCount)
	state.RulesProfileID = DeathLootProfileID
	state.RulesProfileVersion = DeathLootProfileVersion
	state, _ = finishSetup(t, state, pack)
	deadIndex := 0
	if playerCount > 1 {
		deadIndex = 1
	}
	player := &state.Players[deadIndex]
	if len(player.Hand) >= 2 {
		player.Carried = append(player.Carried, player.Hand[0])
		player.Equipped = append(player.Equipped, player.Hand[1])
		player.Hand = append([]string(nil), player.Hand[2:]...)
	}
	player.CharacterTags = []string{"persistent-death-test"}
	lootable := append([]string(nil), player.Hand...)
	lootable = append(lootable, player.Carried...)
	lootable = append(lootable, player.Equipped...)
	if err := killPlayer(&state, deadIndex, pack); err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(
		state.Players[deadIndex].CharacterTags,
		[]string{"persistent-death-test"},
	) {
		t.Fatal("death removed persistent character state")
	}
	if err := state.Validate(); err != nil {
		t.Fatal(err)
	}
	return state, pack, lootable
}

func openDeathLootWindowForTest(
	t *testing.T,
	state State,
	pack Pack,
	interactionID string,
	openedAt time.Time,
) State {
	t.Helper()
	actorID, available := state.DeathLoot.CurrentActor()
	if !available {
		t.Fatal("death loot actor is unavailable")
	}
	window := &InteractionWindow{
		ID:   interactionID,
		Kind: InteractionKindDeathLootPriority,
		Parent: InteractionParent{
			Phase:       state.Turn.Phase,
			SubjectKind: InteractionSubjectTurn,
			SubjectID:   state.Turn.PlayerID,
		},
		InitiatorActorID:  actorID,
		EligibilityPolicy: InteractionEligibilityActorPrivate,
		AllowedIntents: []InteractionIntent{
			InteractionIntentPass,
			InteractionIntentRespond,
		},
		EligibleActorIDs: []string{actorID},
		OpenedAt:         openedAt,
		DeadlineAt:       openedAt.Add(30 * time.Second),
		DeadlineRevision: 1,
		DeadlinePolicy:   AddressedInteractionDeadlinePolicy(),
		Responses: map[string]InteractionResponse{
			actorID: {
				Requirement:   InteractionResponseOptional,
				TimeoutIntent: InteractionIntentPass,
				State:         InteractionResponsePending,
			},
		},
		Status: InteractionWindowOpen,
	}
	events, err := Handle(state, Command{
		Type:              CommandOpenInteractionWindow,
		ActorID:           actorID,
		InteractionWindow: window,
	}, pack)
	if err != nil {
		t.Fatal(err)
	}
	next, _ := applyForTest(t, state, events)
	return next
}

func TestDeathLootUsesStableSeatPriorityAndPrivateDescriptors(t *testing.T) {
	state, pack, lootable := deathLootState(t, 3)
	if state.DeathLoot == nil ||
		state.DeathLoot.DeadPlayerID != "player-b" ||
		!reflect.DeepEqual(
			state.DeathLoot.SeatOrder,
			[]string{"player-c", "player-a"},
		) ||
		!reflect.DeepEqual(state.DeathLoot.Pool, lootable) {
		t.Fatalf("death loot setup=%#v", state.DeathLoot)
	}
	openedAt := time.Date(2026, 7, 31, 7, 0, 0, 0, time.UTC)
	state = openDeathLootWindowForTest(
		t,
		state,
		pack,
		"interaction-death-loot-c",
		openedAt,
	)
	current, err := ProjectForActor(state, "player-c", pack)
	if err != nil {
		t.Fatal(err)
	}
	observer, err := ProjectForActor(state, "player-a", pack)
	if err != nil {
		t.Fatal(err)
	}
	if current.Interaction == nil ||
		current.Interaction.PublicKind != "death_loot_priority" ||
		current.Interaction.DeathLoot == nil ||
		len(current.Interaction.DeathLoot.Options) != len(lootable) ||
		len(current.Interaction.Actions) != len(lootable)+1 ||
		observer.Interaction == nil ||
		observer.Interaction.DeathLoot == nil ||
		len(observer.Interaction.DeathLoot.Options) != 0 ||
		len(observer.Interaction.Actions) != 0 {
		t.Fatalf(
			"current=%#v observer=%#v",
			current.Interaction,
			observer.Interaction,
		)
	}
	rawObserver, err := json.Marshal(observer)
	if err != nil {
		t.Fatal(err)
	}
	for _, instanceID := range lootable {
		if bytes.Contains(rawObserver, []byte(instanceID)) {
			t.Fatalf("observer received private loot option %s", instanceID)
		}
	}
}

func TestDeathLootPickTimeoutTerminalDiscardAndReplay(t *testing.T) {
	initial, pack, lootable := deathLootState(t, 3)
	openedAt := time.Date(2026, 7, 31, 7, 5, 0, 0, time.UTC)
	state := openDeathLootWindowForTest(
		t,
		initial,
		pack,
		"interaction-death-loot-c",
		openedAt,
	)
	firstWindowState := state
	projection, err := ProjectForActor(state, "player-c", pack)
	if err != nil {
		t.Fatal(err)
	}
	pickIndex := slices.IndexFunc(
		projection.Interaction.Actions,
		func(action InteractionActionView) bool {
			return action.Type == InteractionIntentRespond
		},
	)
	if pickIndex < 0 {
		t.Fatal("death loot pick descriptor is missing")
	}
	pick := projection.Interaction.Actions[pickIndex]
	pickEvents, err := Handle(state, Command{
		Type:                CommandPickDeathLoot,
		ActorID:             "player-c",
		InstanceID:          pick.ChoiceIDs[0],
		InteractionID:       pick.InteractionID,
		InteractionAt:       openedAt.Add(time.Second),
		InteractionRevision: pick.Revision,
	}, pack)
	if err != nil {
		t.Fatal(err)
	}
	if len(pickEvents) != 1 ||
		pickEvents[0].Type != EventDeathLootAdvanced {
		t.Fatalf("pick events=%#v", pickEvents)
	}
	state, _ = applyForTest(t, state, pickEvents)
	if state.DeathLoot.SeatIndex != 1 ||
		!slices.Contains(state.Players[2].Hand, pick.ChoiceIDs[0]) ||
		state.InteractionWindow.Status != InteractionWindowClosed {
		t.Fatalf("pick transition=%#v", state.DeathLoot)
	}
	secondOpenedAt := openedAt.Add(2 * time.Second)
	state = openDeathLootWindowForTest(
		t,
		state,
		pack,
		"interaction-death-loot-a",
		secondOpenedAt,
	)
	timeoutEvents, err := Handle(state, Command{
		Type:                CommandTimeoutInteraction,
		InteractionID:       state.InteractionWindow.ID,
		InteractionAt:       state.InteractionWindow.DeadlineAt,
		InteractionRevision: state.InteractionWindow.DeadlineRevision,
	}, pack)
	if err != nil {
		t.Fatal(err)
	}
	if len(timeoutEvents) != 1 ||
		timeoutEvents[0].Type != EventDeathLootAdvanced {
		t.Fatalf("timeout events=%#v", timeoutEvents)
	}
	state, _ = applyForTest(t, state, timeoutEvents)
	if !state.DeathLoot.Completed ||
		len(state.DeathLoot.Pool) != 0 ||
		state.DeathLoot.SeatIndex != 2 ||
		state.InteractionWindow.CloseReason !=
			InteractionCloseDeadlineExpired {
		t.Fatalf("terminal death loot=%#v", state.DeathLoot)
	}
	remainder := append([]string(nil), lootable...)
	remainder, _ = removeString(remainder, pick.ChoiceIDs[0])
	if !reflect.DeepEqual(
		state.DeathLoot.DiscardedInstanceIDs,
		remainder,
	) {
		t.Fatalf(
			"discarded=%v want=%v",
			state.DeathLoot.DiscardedInstanceIDs,
			remainder,
		)
	}
	var payload stateChangedPayload
	if err := json.Unmarshal(timeoutEvents[0].Payload, &payload); err != nil {
		t.Fatal(err)
	}
	if len(payload.Outcomes) != 1 ||
		payload.Outcomes[0].Kind != "death_loot_discard" ||
		!reflect.DeepEqual(payload.Outcomes[0].Order, remainder) {
		t.Fatalf("terminal persisted outcome=%#v", payload.Outcomes)
	}
	replayed := firstWindowState
	for _, event := range pickEvents {
		replayed, err = Apply(replayed, event)
		if err != nil {
			t.Fatal(err)
		}
	}
	secondWindowEvents, err := Handle(
		replayed,
		Command{
			Type:    CommandOpenInteractionWindow,
			ActorID: "player-a",
			InteractionWindow: stateWindowBeforeTimeout(
				state,
				secondOpenedAt,
			),
		},
		pack,
	)
	if err != nil {
		t.Fatal(err)
	}
	for _, event := range secondWindowEvents {
		replayed, err = Apply(replayed, event)
		if err != nil {
			t.Fatal(err)
		}
	}
	for _, event := range timeoutEvents {
		replayed, err = Apply(replayed, event)
		if err != nil {
			t.Fatal(err)
		}
	}
	if !reflect.DeepEqual(replayed, state) {
		t.Fatal("death loot replay differs from committed state")
	}
}

func stateWindowBeforeTimeout(
	state State,
	openedAt time.Time,
) *InteractionWindow {
	window := state.InteractionWindow.clone()
	window.Status = InteractionWindowOpen
	window.CloseReason = ""
	window.ClosedAt = time.Time{}
	window.OpenedAt = openedAt
	window.DeadlineAt = openedAt.Add(30 * time.Second)
	for actorID, response := range window.Responses {
		response.State = InteractionResponsePending
		response.Intent = ""
		response.AcceptedAt = time.Time{}
		window.Responses[actorID] = response
	}
	return window
}

func TestDeathLootHandlesOneToSixSeatsAndEmptyPool(t *testing.T) {
	for playerCount := 1; playerCount <= 6; playerCount++ {
		t.Run(string(rune('0'+playerCount)), func(t *testing.T) {
			state, _, _ := deathLootState(t, playerCount)
			expectedSeats := playerCount - 1
			if len(state.DeathLoot.SeatOrder) != expectedSeats {
				t.Fatalf(
					"seat count=%d want=%d order=%v",
					len(state.DeathLoot.SeatOrder),
					expectedSeats,
					state.DeathLoot.SeatOrder,
				)
			}
			if playerCount == 1 &&
				(!state.DeathLoot.Completed ||
					len(state.DeathLoot.DiscardedInstanceIDs) == 0) {
				t.Fatalf("single-player terminal loot=%#v", state.DeathLoot)
			}
		})
	}
	pack := testPack(t)
	pack.SetID = "moscow-core"
	pack.Version = 4
	pack.Source = "empty-death-loot-test"
	pack.ContentDigest = CardsDigest(pack.Cards)
	state, _ := startedState(t, pack, 2)
	state.RulesProfileID = DeathLootProfileID
	state.RulesProfileVersion = DeathLootProfileVersion
	deadIndex := state.PlayerIndex("player-a")
	for _, instanceID := range append(
		[]string(nil),
		state.Players[deadIndex].Hand...,
	) {
		if err := discardOwnedInstance(
			&state,
			deadIndex,
			instanceID,
			pack,
		); err != nil {
			t.Fatal(err)
		}
	}
	if err := killPlayer(&state, deadIndex, pack); err != nil {
		t.Fatal(err)
	}
	if state.DeathLoot == nil ||
		!state.DeathLoot.Completed ||
		state.DeathLoot.InitialCount != 0 {
		t.Fatalf("empty death loot=%#v", state.DeathLoot)
	}
}

func TestEndTurnClearsCompletedDeathLootState(t *testing.T) {
	state, pack, _ := deathLootState(t, 2)
	openedAt := time.Date(2026, 7, 31, 7, 10, 0, 0, time.UTC)
	state = openDeathLootWindowForTest(
		t,
		state,
		pack,
		"interaction-death-loot-a-end-turn",
		openedAt,
	)
	window := state.InteractionWindow
	if window == nil {
		t.Fatal("death loot interaction is missing")
	}
	events, err := Handle(state, Command{
		Type:                CommandPassDeathLoot,
		ActorID:             "player-a",
		InteractionID:       window.ID,
		InteractionAt:       openedAt.Add(time.Second),
		InteractionRevision: window.DeadlineRevision,
	}, pack)
	if err != nil {
		t.Fatal(err)
	}
	state, _ = applyForTest(t, state, events)
	if state.DeathLoot == nil || !state.DeathLoot.Completed {
		t.Fatalf("death loot did not complete: %#v", state.DeathLoot)
	}
	state.Turn.PlayerID = "player-a"
	setTurnPhase(&state, PhaseEndTurn)
	endTurnEvents, err := Handle(state, Command{
		Type:    CommandEndTurn,
		ActorID: "player-a",
	}, pack)
	if err != nil {
		t.Fatal(err)
	}
	next, _ := applyForTest(t, state, endTurnEvents)
	if next.DeathLoot != nil {
		t.Fatalf("completed death loot survived end turn: %#v", next.DeathLoot)
	}
}
