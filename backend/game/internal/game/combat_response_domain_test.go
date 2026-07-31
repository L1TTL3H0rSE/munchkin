package game

import (
	"encoding/json"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
	"time"
)

func combatResponsePack(t *testing.T) Pack {
	t.Helper()
	pack := testPack(t)
	cards := []Card{
		{
			ID:               "test-player-aid",
			Name:             "Test player aid",
			Deck:             DeckTreasure,
			Kind:             CardOneShot,
			Copies:           4,
			InteractionScope: InteractionOtherPlayers,
			Effects: []Effect{{
				Kind:   EffectModifyCombat,
				Amount: 3,
				Target: EffectTargetPlayer,
			}},
		},
		{
			ID:               "test-monster-aid",
			Name:             "Test monster aid",
			Deck:             DeckTreasure,
			Kind:             CardOneShot,
			Copies:           2,
			InteractionScope: InteractionOtherPlayers,
			Effects: []Effect{{
				Kind:   EffectModifyCombat,
				Amount: 4,
				Target: EffectTargetMonster,
			}},
		},
		{
			ID:               "test-deferred-target-effect",
			Name:             "Test deferred target effect",
			Deck:             DeckDoor,
			Kind:             CardCurse,
			Copies:           1,
			InteractionScope: InteractionOtherPlayers,
			Effects: []Effect{{
				Kind:   EffectModifyCombat,
				Amount: -2,
				Target: EffectTargetPlayer,
			}},
		},
	}
	pack.Cards = append(pack.Cards, cards...)
	for _, card := range cards {
		pack.index[card.ID] = card
	}
	return pack
}

func multiplayerCombatState(
	t *testing.T,
) (State, Pack, []EventEnvelope) {
	t.Helper()
	pack := combatResponsePack(t)
	created, err := CreateLobby("game-multiplayer", Player{
		ID:             "player-a",
		Name:           "Alice",
		Level:          1,
		CredentialHash: "hash-a",
	}, pack, 42)
	if err != nil {
		t.Fatal(err)
	}
	state, all := applyForTest(t, State{}, []DomainEvent{created})
	for _, player := range []Player{
		{
			ID:             "player-b",
			Name:           "Bob",
			CredentialHash: "hash-b",
		},
		{
			ID:             "player-c",
			Name:           "Cara",
			CredentialHash: "hash-c",
		},
	} {
		joined, err := Handle(state, Command{
			Type:           CommandJoin,
			PlayerID:       player.ID,
			DisplayName:    player.Name,
			CredentialHash: player.CredentialHash,
		}, pack)
		if err != nil {
			t.Fatal(err)
		}
		var envelopes []EventEnvelope
		state, envelopes = applyForTest(t, state, joined)
		all = append(all, envelopes...)
	}
	started, err := Handle(
		state,
		Command{Type: CommandStart, ActorID: "player-a"},
		pack,
	)
	if err != nil {
		t.Fatal(err)
	}
	var envelopes []EventEnvelope
	state, envelopes = applyForTest(t, state, started)
	all = append(all, envelopes...)
	state, envelopes = finishSetup(t, state, pack)
	all = append(all, envelopes...)
	forceDoorTop(t, &state, "courtyard-pigeon")
	state, envelopes = applyCommand(
		t,
		state,
		Command{Type: CommandOpenDoor},
		pack,
	)
	all = append(all, envelopes...)
	if state.Turn.Phase != PhaseCombat {
		t.Fatalf("fixture did not enter combat: %#v", state.Turn)
	}
	return state, pack, all
}

func requestCombatWindow(
	t *testing.T,
	state State,
	pack Pack,
	openedAt time.Time,
) (State, []EventEnvelope) {
	t.Helper()
	events, err := Handle(state, Command{
		Type:          CommandRequestCombatResolution,
		ActorID:       state.Turn.PlayerID,
		InteractionID: "interaction-combat",
		InteractionAt: openedAt,
	}, pack)
	if err != nil {
		t.Fatal(err)
	}
	return applyForTest(t, state, events)
}

func clearCombatInterventionsFromHand(
	t *testing.T,
	state *State,
	playerIndex int,
	pack Pack,
) {
	t.Helper()
	hand := append([]string(nil), state.Players[playerIndex].Hand...)
	for _, instanceID := range hand {
		card, _, exists := pack.DefinitionForInstance(*state, instanceID)
		if !exists {
			t.Fatalf("unknown hand instance %s", instanceID)
		}
		if _, legal := combatInterventionEffect(card); !legal {
			continue
		}
		state.Players[playerIndex].Hand, _ = removeString(
			state.Players[playerIndex].Hand,
			instanceID,
		)
		switch card.Deck {
		case DeckDoor:
			state.DoorDeck = append(state.DoorDeck, instanceID)
		case DeckTreasure:
			state.TreasureDeck = append(state.TreasureDeck, instanceID)
		default:
			t.Fatalf("invalid intervention deck %s", card.Deck)
		}
	}
	if err := state.Validate(); err != nil {
		t.Fatal(err)
	}
}

func TestRulesProfilesKeepLegacyCombatAndActivateNewLobbies(t *testing.T) {
	pack := combatResponsePack(t)
	legacy, err := CreateLegacyLobby("legacy", Player{
		ID:             "legacy-owner",
		Name:           "Legacy",
		Level:          1,
		CredentialHash: "legacy-hash",
	}, pack, 1)
	if err != nil {
		t.Fatal(err)
	}
	legacyState, err := Apply(State{}, legacy)
	if err != nil {
		t.Fatal(err)
	}
	if legacyState.RulesProfileID != FirstEditionCoreProfileID {
		t.Fatalf("legacy profile changed: %#v", legacyState)
	}
	rawLegacy, err := json.Marshal(legacyState)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(rawLegacy), LobbyMultiplayerProfileID) {
		t.Fatalf("legacy state leaked multiplayer profile: %s", rawLegacy)
	}

	multiplayer, err := CreateLobby("new", Player{
		ID:             "new-owner",
		Name:           "New",
		Level:          1,
		CredentialHash: "new-hash",
	}, pack, 2)
	if err != nil {
		t.Fatal(err)
	}
	multiplayerState, err := Apply(State{}, multiplayer)
	if err != nil {
		t.Fatal(err)
	}
	if multiplayerState.RulesProfileID != LobbyMultiplayerProfileID {
		t.Fatalf("new lobby profile: %#v", multiplayerState)
	}

	state, _, _ := multiplayerCombatState(t)
	if _, exists := state.Instances["test-player-aid-1"]; !exists {
		t.Fatal("multiplayer combat intervention was not materialized")
	}
	if _, exists := state.Instances["test-deferred-target-effect-1"]; exists {
		t.Fatal("out-of-scope target effect was materialized")
	}
}

func TestMoscowMultiplayerProfileMaterializesOnlyCombatInterventions(
	t *testing.T,
) {
	pack, err := LoadPack(filepath.Join(
		"..",
		"..",
		"..",
		"..",
		"content",
		"sets",
		"moscow",
		"v1",
		"cards.json",
	))
	if err != nil {
		t.Fatal(err)
	}
	instances, _, _, err := materializeForProfile(
		pack,
		LobbyMultiplayerProfile(),
	)
	if err != nil {
		t.Fatal(err)
	}
	for _, instanceID := range []string{
		"flash-mob-intervention-1",
		"sudden-traffic-jam-1",
	} {
		if _, exists := instances[instanceID]; !exists {
			t.Fatalf("combat intervention %s was not materialized", instanceID)
		}
	}
	for _, deferredID := range []string{
		"skyscraper-draft-1",
		"wrong-entrance-curse-1",
		"anonymous-complaint-1",
	} {
		if _, exists := instances[deferredID]; exists {
			t.Fatalf("out-of-scope definition %s was materialized", deferredID)
		}
	}
}

func TestCombatResolutionRequestIsOpaqueAndActorSpecific(t *testing.T) {
	state, pack, _ := multiplayerCombatState(t)
	sourceID := moveDefinition(
		t,
		&state,
		"test-player-aid",
		&state.Players[1].Hand,
	)
	clearCombatInterventionsFromHand(t, &state, 2, pack)
	openedAt := time.Date(2026, time.July, 31, 2, 0, 0, 0, time.UTC)

	combatant, err := ProjectForActor(state, "player-a", pack)
	if err != nil {
		t.Fatal(err)
	}
	if combatant.Turn.Combat == nil ||
		combatant.Turn.Combat.ResolutionAction == nil ||
		combatant.Turn.Combat.ResolutionAction.Type !=
			CommandRequestCombatResolution {
		t.Fatalf(
			"combat resolution action: %#v",
			combatant.Turn.Combat,
		)
	}
	if events, err := Handle(state, Command{
		Type:    CommandResolveCombat,
		ActorID: "player-a",
	}, pack); err == nil || events != nil {
		t.Fatalf("direct multiplayer resolution succeeded: %#v", events)
	}
	state, _ = requestCombatWindow(t, state, pack, openedAt)
	window := state.InteractionWindow
	if window == nil ||
		window.Kind != InteractionKindCombatResponse ||
		window.EligibilityPolicy != InteractionEligibilityOpaquePublicSet ||
		!reflect.DeepEqual(
			window.EligibleActorIDs,
			[]string{"player-b", "player-c"},
		) ||
		!window.DeadlineAt.Equal(openedAt.Add(60*time.Second)) {
		t.Fatalf("combat response window: %#v", window)
	}

	bob, err := ProjectForActor(state, "player-b", pack)
	if err != nil {
		t.Fatal(err)
	}
	if bob.Interaction == nil ||
		bob.Interaction.PublicKind != "combat_response" ||
		len(bob.Interaction.Actions) < 2 {
		t.Fatalf("Bob interaction: %#v", bob.Interaction)
	}
	var material *InteractionActionView
	for index := range bob.Interaction.Actions {
		action := &bob.Interaction.Actions[index]
		if action.SourceInstanceID == sourceID {
			material = action
		}
	}
	if material == nil ||
		material.Target != EffectTargetPlayer ||
		material.CombatDelta != 3 ||
		material.Revision != 1 {
		t.Fatalf("material descriptor: %#v", material)
	}

	cara, err := ProjectForActor(state, "player-c", pack)
	if err != nil {
		t.Fatal(err)
	}
	rawCara, err := json.Marshal(cara)
	if err != nil {
		t.Fatal(err)
	}
	if cara.Interaction == nil ||
		len(cara.Interaction.Actions) != 1 ||
		cara.Interaction.Actions[0].Type != InteractionIntentPass ||
		strings.Contains(string(rawCara), sourceID) {
		t.Fatalf("private source leaked to Cara: %s", rawCara)
	}
}

func TestCombatInterventionResetsRevisionExtendsAndReplays(t *testing.T) {
	state, pack, _ := multiplayerCombatState(t)
	sourceID := moveDefinition(
		t,
		&state,
		"test-player-aid",
		&state.Players[1].Hand,
	)
	openedAt := time.Date(2026, time.July, 31, 2, 30, 0, 0, time.UTC)
	base := state.Clone()
	state, opened := requestCombatWindow(t, state, pack, openedAt)
	all := append([]EventEnvelope(nil), opened...)

	passEvents, err := Handle(state, Command{
		Type:                CommandPassInteraction,
		ActorID:             "player-c",
		InteractionID:       "interaction-combat",
		InteractionAt:       openedAt.Add(10 * time.Second),
		InteractionRevision: 1,
	}, pack)
	if err != nil {
		t.Fatal(err)
	}
	var envelopes []EventEnvelope
	state, envelopes = applyForTest(t, state, passEvents)
	all = append(all, envelopes...)
	if state.InteractionWindow.DeadlineRevision != 1 ||
		!state.InteractionWindow.DeadlineAt.Equal(
			openedAt.Add(60*time.Second),
		) {
		t.Fatalf("pass changed deadline: %#v", state.InteractionWindow)
	}

	intervention, err := Handle(state, Command{
		Type:                CommandPlayCombatIntervention,
		ActorID:             "player-b",
		InstanceID:          sourceID,
		TargetInstanceID:    string(EffectTargetPlayer),
		InteractionID:       "interaction-combat",
		InteractionAt:       openedAt.Add(31 * time.Second),
		InteractionRevision: 1,
	}, pack)
	if err != nil {
		t.Fatal(err)
	}
	if len(intervention) != 1 ||
		intervention[0].Type != EventCombatInterventionApplied {
		t.Fatalf("intervention events: %#v", intervention)
	}
	state, envelopes = applyForTest(t, state, intervention)
	all = append(all, envelopes...)
	if state.Turn.Encounter.PlayerCombatModifier != 3 ||
		state.InteractionWindow.DeadlineRevision != 2 ||
		!state.InteractionWindow.DeadlineAt.Equal(
			openedAt.Add(70*time.Second),
		) ||
		state.InteractionWindow.Responses["player-b"].State !=
			InteractionResponsePending ||
		state.InteractionWindow.Responses["player-c"].State !=
			InteractionResponsePending {
		t.Fatalf("material reset outcome: %#v", state.InteractionWindow)
	}
	if events, err := Handle(state, Command{
		Type:                CommandPassInteraction,
		ActorID:             "player-c",
		InteractionID:       "interaction-combat",
		InteractionAt:       openedAt.Add(32 * time.Second),
		InteractionRevision: 1,
	}, pack); err == nil || events != nil {
		t.Fatalf("stale pass succeeded: %#v", events)
	}

	for _, actorID := range []string{"player-b", "player-c"} {
		passEvents, err = Handle(state, Command{
			Type:                CommandPassInteraction,
			ActorID:             actorID,
			InteractionID:       "interaction-combat",
			InteractionAt:       openedAt.Add(33 * time.Second),
			InteractionRevision: 2,
		}, pack)
		if err != nil {
			t.Fatal(err)
		}
		state, envelopes = applyForTest(t, state, passEvents)
		all = append(all, envelopes...)
	}
	closed, err := Handle(state, Command{
		Type:                   CommandCloseInteractionWindow,
		ActorID:                "player-a",
		InteractionID:          "interaction-combat",
		InteractionAt:          openedAt.Add(34 * time.Second),
		InteractionCloseReason: InteractionCloseAllResponded,
	}, pack)
	if err != nil {
		t.Fatal(err)
	}
	if len(closed) != 2 ||
		closed[0].Type != EventInteractionWindowClosed ||
		closed[1].Type != EventCombatResolved {
		t.Fatalf("terminal combat sequence: %#v", closed)
	}
	state, envelopes = applyForTest(t, state, closed)
	all = append(all, envelopes...)
	replayed, err := ReplayFrom(base, all)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(replayed, state) {
		t.Fatalf("combat response replay mismatch\nwant=%#v\ngot=%#v", state, replayed)
	}
}

func TestCombatInterventionDeadlineStopsAtHardCap(t *testing.T) {
	state, pack, _ := multiplayerCombatState(t)
	sourceIDs := make([]string, 0, 4)
	for len(sourceIDs) < 4 {
		sourceIDs = append(sourceIDs, moveDefinitionExcluding(
			t,
			&state,
			"test-player-aid",
			&state.Players[1].Hand,
			sourceIDs...,
		))
	}
	openedAt := time.Date(2026, time.July, 31, 2, 45, 0, 0, time.UTC)
	state, _ = requestCombatWindow(t, state, pack, openedAt)
	expectedDeadlines := []time.Duration{
		70 * time.Second,
		80 * time.Second,
		90 * time.Second,
		90 * time.Second,
	}
	for index, sourceID := range sourceIDs {
		events, err := Handle(state, Command{
			Type:                CommandPlayCombatIntervention,
			ActorID:             "player-b",
			InstanceID:          sourceID,
			TargetInstanceID:    string(EffectTargetPlayer),
			InteractionID:       "interaction-combat",
			InteractionAt:       openedAt.Add(time.Duration(31+index*10) * time.Second),
			InteractionRevision: state.InteractionWindow.DeadlineRevision,
		}, pack)
		if err != nil {
			t.Fatal(err)
		}
		state, _ = applyForTest(t, state, events)
		if !state.InteractionWindow.DeadlineAt.Equal(
			openedAt.Add(expectedDeadlines[index]),
		) {
			t.Fatalf(
				"intervention %d deadline=%s",
				index,
				state.InteractionWindow.DeadlineAt,
			)
		}
	}
	if state.InteractionWindow.DeadlineRevision != 5 ||
		state.InteractionWindow.ExtensionBudgetSeconds != 0 {
		t.Fatalf("hard cap state: %#v", state.InteractionWindow)
	}
}

func TestCombatResponseTimeoutAutoPassesAndContinues(t *testing.T) {
	state, pack, _ := multiplayerCombatState(t)
	openedAt := time.Date(2026, time.July, 31, 3, 0, 0, 0, time.UTC)
	state, _ = requestCombatWindow(t, state, pack, openedAt)
	events, err := Handle(state, Command{
		Type:                CommandTimeoutInteraction,
		InteractionID:       "interaction-combat",
		InteractionAt:       openedAt.Add(60 * time.Second),
		InteractionRevision: 1,
	}, pack)
	if err != nil {
		t.Fatal(err)
	}
	if len(events) != 4 ||
		events[0].Type != EventInteractionResponseRecorded ||
		events[1].Type != EventInteractionResponseRecorded ||
		events[2].Type != EventInteractionWindowClosed ||
		events[3].Type != EventCombatResolved {
		t.Fatalf("timeout terminal sequence: %#v", events)
	}
	next, _ := applyForTest(t, state, events)
	if next.InteractionWindow.Status != InteractionWindowClosed ||
		next.InteractionWindow.CloseReason != InteractionCloseDeadlineExpired ||
		next.Turn.Phase == PhaseCombat {
		t.Fatalf("timeout did not continue combat: %#v", next)
	}
}
