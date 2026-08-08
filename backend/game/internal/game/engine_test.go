package game

import (
	"encoding/json"
	"errors"
	"fmt"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
	"time"
)

func testPack(t *testing.T) Pack {
	t.Helper()
	pack, err := LoadPack(filepath.Join(
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

func applyForTest(
	t *testing.T,
	state State,
	events []DomainEvent,
) (State, []EventEnvelope) {
	t.Helper()
	envelopes := make([]EventEnvelope, 0, len(events))
	for _, event := range events {
		sequence := state.Version + 1
		next, err := Apply(state, event)
		if err != nil {
			t.Fatal(err)
		}
		envelopes = append(envelopes, EventEnvelope{
			GameID:     next.GameID,
			Sequence:   sequence,
			EventID:    fmt.Sprintf("event-%d", sequence),
			CommandID:  fmt.Sprintf("command-%d", sequence),
			Type:       event.Type,
			Schema:     1,
			OccurredAt: time.Unix(0, int64(sequence)).UTC(),
			Payload:    event.Payload,
		})
		state = next
	}
	return state, envelopes
}

func startedState(
	t *testing.T,
	pack Pack,
	playerCount int,
) (State, []EventEnvelope) {
	t.Helper()
	created, err := CreateLegacyLobby("game", Player{
		ID:             "player-a",
		Name:           "Alice",
		Level:          1,
		CredentialHash: "hash-a",
	}, pack, 42)
	if err != nil {
		t.Fatal(err)
	}
	state, all := applyForTest(t, State{}, []DomainEvent{created})
	for index := 1; index < playerCount; index++ {
		playerID := fmt.Sprintf("player-%c", 'a'+index)
		joined, err := Handle(state, Command{
			Type:           CommandJoin,
			PlayerID:       playerID,
			DisplayName:    fmt.Sprintf("Player %d", index+1),
			CredentialHash: "hash-" + playerID,
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
	return state, all
}

func applyCommand(
	t *testing.T,
	state State,
	command Command,
	pack Pack,
) (State, []EventEnvelope) {
	t.Helper()
	if command.ActorID == "" {
		command.ActorID = state.Turn.PlayerID
	}
	events, err := Handle(state, command, pack)
	if err != nil {
		t.Fatalf("%s: %v", command.Type, err)
	}
	return applyForTest(t, state, events)
}

func finishSetup(
	t *testing.T,
	state State,
	pack Pack,
) (State, []EventEnvelope) {
	t.Helper()
	var all []EventEnvelope
	for state.Turn.Phase == PhaseSetup {
		var events []EventEnvelope
		playerIndex := state.PlayerIndex(state.Turn.PlayerID)
		if state.Players[playerIndex].SetupDiscardPending {
			limit, err := handLimit(state, playerIndex, pack)
			if err != nil {
				t.Fatal(err)
			}
			excess := max(0, len(state.Players[playerIndex].Hand)-limit)
			state, events = applyCommand(
				t,
				state,
				Command{
					Type: CommandResolveCharity,
					InstanceIDs: append(
						[]string(nil),
						state.Players[playerIndex].Hand[:excess]...,
					),
				},
				pack,
			)
		} else {
			state, events = applyCommand(
				t,
				state,
				Command{Type: CommandFinishSetup},
				pack,
			)
		}
		all = append(all, events...)
	}
	return state, all
}

func completeTurnForTest(
	t *testing.T,
	state State,
	pack Pack,
	expectedNextActorID string,
) (State, []EventEnvelope) {
	t.Helper()
	if state.Turn.Phase != PhasePreparation {
		t.Fatalf("complete turn started in phase %s", state.Turn.Phase)
	}
	startVersion := state.Version
	var all []EventEnvelope
	for steps := 0; steps < 30; steps++ {
		if state.Version > startVersion &&
			state.Turn.Phase == PhasePreparation &&
			state.Turn.PlayerID == expectedNextActorID {
			return state, all
		}
		var command Command
		switch state.Turn.Phase {
		case PhasePreparation:
			command.Type = CommandOpenDoor
		case PhaseDoorChoice:
			command.Type = CommandLootRoom
		case PhaseCombat:
			command.Type = CommandResolveCombat
		case PhaseRunAway:
			command.Type = CommandRunAway
		case PhaseResolveEffect:
			command.Type = CommandChooseEffect
			command.ChoiceIDs = append(
				[]string(nil),
				state.Turn.Pending.Options[:state.Turn.Pending.Minimum]...,
			)
		case PhaseCharity:
			playerIndex := state.PlayerIndex(state.Turn.PlayerID)
			limit, err := handLimit(state, playerIndex, pack)
			if err != nil {
				t.Fatal(err)
			}
			excess := max(0, len(state.Players[playerIndex].Hand)-limit)
			command.Type = CommandResolveCharity
			command.InstanceIDs = append(
				[]string(nil),
				state.Players[playerIndex].Hand[:excess]...,
			)
		case PhaseEndTurn:
			command.Type = CommandEndTurn
		default:
			t.Fatalf("unexpected phase %s", state.Turn.Phase)
		}
		var added []EventEnvelope
		state, added = applyCommand(t, state, command, pack)
		all = append(all, added...)
	}
	t.Fatalf(
		"turn did not reach preparation for %s: %#v",
		expectedNextActorID,
		state.Turn,
	)
	return State{}, nil
}

func moveDefinition(
	t *testing.T,
	state *State,
	definitionID string,
	destination *[]string,
) string {
	return moveDefinitionExcluding(t, state, definitionID, destination)
}

func moveDefinitionExcluding(
	t *testing.T,
	state *State,
	definitionID string,
	destination *[]string,
	excluded ...string,
) string {
	t.Helper()
	excludedIDs := make(map[string]struct{}, len(excluded))
	for _, instanceID := range excluded {
		excludedIDs[instanceID] = struct{}{}
	}
	instanceID := ""
	for _, zone := range [][]string{
		state.DoorDeck,
		state.DoorDiscard,
		state.TreasureDeck,
		state.TreasureDiscard,
	} {
		for _, candidateID := range zone {
			_, skip := excludedIDs[candidateID]
			if !skip && state.Instances[candidateID].DefinitionID == definitionID {
				instanceID = candidateID
				break
			}
		}
		if instanceID != "" {
			break
		}
	}
	if instanceID == "" {
		for candidateID, instance := range state.Instances {
			_, skip := excludedIDs[candidateID]
			if !skip && instance.DefinitionID == definitionID {
				instanceID = candidateID
				break
			}
		}
	}
	if instanceID == "" {
		t.Fatalf("definition %s has no instance", definitionID)
	}
	removeTestInstance(state, instanceID)
	*destination = append(*destination, instanceID)
	if err := state.Validate(); err != nil {
		t.Fatalf("move %s: %v", definitionID, err)
	}
	return instanceID
}

func forceDoorTop(t *testing.T, state *State, definitionID string) string {
	t.Helper()
	instanceID := moveDefinition(t, state, definitionID, &state.DoorDeck)
	state.DoorDeck, _ = removeString(state.DoorDeck, instanceID)
	state.DoorDeck = append([]string{instanceID}, state.DoorDeck...)
	return instanceID
}

func removeTestInstance(state *State, instanceID string) {
	state.DoorDeck, _ = removeString(state.DoorDeck, instanceID)
	state.TreasureDeck, _ = removeString(state.TreasureDeck, instanceID)
	state.DoorDiscard, _ = removeString(state.DoorDiscard, instanceID)
	state.TreasureDiscard, _ = removeString(state.TreasureDiscard, instanceID)
	state.Turn.Resolving, _ = removeString(state.Turn.Resolving, instanceID)
	if state.Turn.Encounter != nil &&
		state.Turn.Encounter.MonsterInstanceID == instanceID {
		state.Turn.Encounter = nil
	}
	for index := range state.Players {
		removeOwnedInstance(&state.Players[index], instanceID)
		for attachmentID, targetID := range state.Players[index].CheatTargets {
			if attachmentID == instanceID || targetID == instanceID {
				delete(state.Players[index].CheatTargets, attachmentID)
			}
		}
	}
}

func TestDemoPackDigestMaterializationAndGoNodeConformance(t *testing.T) {
	pack := testPack(t)
	const expected = "sha256:3f32638963d1e77243ba746023153214482e6e7e4ca202ea99553e4e26018acf"
	if pack.ContentDigest != expected || CardsDigest(pack.Cards) != expected {
		t.Fatalf("digest drift: pack=%s go=%s", pack.ContentDigest, CardsDigest(pack.Cards))
	}
	instances, doors, treasures, err := pack.Materialize()
	if err != nil {
		t.Fatal(err)
	}
	if len(pack.Cards) != 36 || len(doors) != 40 || len(treasures) != 30 {
		t.Fatalf(
			"unexpected content counts: definitions=%d doors=%d treasures=%d",
			len(pack.Cards),
			len(doors),
			len(treasures),
		)
	}
	for _, instance := range instances {
		card, exists := pack.Card(instance.DefinitionID)
		if !exists || card.InteractionScope == InteractionOtherPlayers {
			t.Fatalf("disabled or missing definition materialized: %#v", instance)
		}
	}
}

func TestSequentialSetupDealsFourPlusFour(t *testing.T) {
	pack := testPack(t)
	state, _ := startedState(t, pack, 2)
	state.RulesProfileID = DeathLootProfileID
	state.RulesProfileVersion = DeathLootProfileVersion
	if state.Turn.Phase != PhaseSetup ||
		state.Turn.PlayerID != "player-a" ||
		len(state.Players[0].Hand) != 8 ||
		len(state.Players[1].Hand) != 8 {
		t.Fatalf("unexpected initial setup: %#v", state)
	}
	if events, err := Handle(
		state,
		Command{Type: CommandOpenDoor, ActorID: "player-a"},
		pack,
	); err == nil || len(events) != 0 {
		t.Fatal("door opened before setup finished")
	}
	state, _ = applyCommand(t, state, Command{Type: CommandFinishSetup}, pack)
	if !state.Players[0].SetupDiscardPending ||
		state.Turn.PlayerID != "player-a" ||
		state.Turn.Phase != PhaseSetup {
		t.Fatalf("setup discard did not become mandatory: %#v", state)
	}
	projection, err := ProjectForActor(state, "player-a", pack)
	if err != nil {
		t.Fatal(err)
	}
	if len(projection.Turn.AvailableActions) != 1 ||
		projection.Turn.AvailableActions[0].Type != CommandResolveCharity ||
		projection.Turn.AvailableActions[0].Minimum != 3 ||
		projection.Turn.AvailableActions[0].Maximum != 3 {
		t.Fatalf("setup discard action=%#v", projection.Turn.AvailableActions)
	}
	state, _ = applyCommand(t, state, Command{
		Type:        CommandResolveCharity,
		InstanceIDs: append([]string(nil), state.Players[0].Hand[:3]...),
	}, pack)
	if state.Turn.PlayerID != "player-b" || state.Turn.Phase != PhaseSetup {
		t.Fatalf("setup did not rotate after discard: %#v", state.Turn)
	}
	state, _ = applyCommand(t, state, Command{Type: CommandFinishSetup}, pack)
	state, _ = applyCommand(t, state, Command{
		Type:        CommandResolveCharity,
		InstanceIDs: append([]string(nil), state.Players[1].Hand[:3]...),
	}, pack)
	if state.Turn.PlayerID != "player-a" || state.Turn.Phase != PhasePreparation ||
		state.Turn.Number != 1 {
		t.Fatalf("first turn did not start: %#v", state.Turn)
	}
}

func TestOnePlayerFullTurnReplaysAndReturnsToSameActor(t *testing.T) {
	pack := testPack(t)
	state, envelopes := startedState(t, pack, 1)
	var added []EventEnvelope
	state, added = finishSetup(t, state, pack)
	envelopes = append(envelopes, added...)
	state, added = completeTurnForTest(t, state, pack, "player-a")
	envelopes = append(envelopes, added...)
	if state.Turn.PlayerID != "player-a" || state.Turn.Phase != PhasePreparation ||
		state.Turn.Number != 2 {
		t.Fatalf("one-player turn did not cycle: %#v", state.Turn)
	}
	replayed, err := Replay(envelopes)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(replayed, state) {
		t.Fatalf("replay mismatch\nwant: %#v\ngot: %#v", state, replayed)
	}
}

func TestTwoPlayersCompleteTurnsRotateBackToFirstActor(t *testing.T) {
	pack := testPack(t)
	state, envelopes := startedState(t, pack, 2)
	var added []EventEnvelope
	state, added = finishSetup(t, state, pack)
	envelopes = append(envelopes, added...)

	state, added = completeTurnForTest(t, state, pack, "player-b")
	envelopes = append(envelopes, added...)
	if state.Turn.PlayerID != "player-b" ||
		state.Turn.Phase != PhasePreparation ||
		state.Turn.Number != 2 {
		t.Fatalf("first completed turn did not rotate to player-b: %#v", state.Turn)
	}

	state, added = completeTurnForTest(t, state, pack, "player-a")
	envelopes = append(envelopes, added...)
	if state.Turn.PlayerID != "player-a" ||
		state.Turn.Phase != PhasePreparation ||
		state.Turn.Number != 3 {
		t.Fatalf("second completed turn did not rotate to player-a: %#v", state.Turn)
	}

	replayed, err := Replay(envelopes)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(replayed, state) {
		t.Fatalf("two-player replay mismatch\nwant: %#v\ngot: %#v", state, replayed)
	}
}

func TestCombatUsesStrictGreaterAndRunAwayRequiresClosedLoss(t *testing.T) {
	pack := testPack(t)
	state, _ := startedState(t, pack, 1)
	state, _ = finishSetup(t, state, pack)
	forceDoorTop(t, &state, "courtyard-pigeon")
	state, _ = applyCommand(t, state, Command{Type: CommandOpenDoor}, pack)
	if state.Turn.Phase != PhaseCombat {
		t.Fatalf("monster did not start combat: %#v", state.Turn)
	}
	if events, err := Handle(
		state,
		Command{Type: CommandRunAway, ActorID: "player-a"},
		pack,
	); err == nil || len(events) != 0 {
		t.Fatal("run away succeeded before combat was resolved")
	}
	state, _ = applyCommand(t, state, Command{Type: CommandResolveCombat}, pack)
	if state.Turn.Phase != PhaseRunAway {
		t.Fatalf("level 1 incorrectly won a tie: %#v", state.Turn)
	}

	tieState, _ := startedState(t, pack, 1)
	tieState, _ = finishSetup(t, tieState, pack)
	moveDefinition(
		t,
		&tieState,
		"patient-archivist",
		&tieState.Players[0].Traits,
	)
	forceDoorTop(t, &tieState, "courtyard-pigeon")
	tieState, _ = applyCommand(t, tieState, Command{Type: CommandOpenDoor}, pack)
	tieState, _ = applyCommand(
		t,
		tieState,
		Command{Type: CommandResolveCombat},
		pack,
	)
	if tieState.Turn.Phase != PhaseCharity || tieState.Players[0].Level != 2 {
		t.Fatalf("typed tie-win was not applied: %#v", tieState)
	}
}

func TestCombatVictoryCompletesWhenTreasureSupplyIsShort(t *testing.T) {
	pack := testPack(t)

	t.Run("empty treasure supply", func(t *testing.T) {
		state, _ := startedState(t, pack, 1)
		state, _ = finishSetup(t, state, pack)
		forceDoorTop(t, &state, "archive-dust")
		state, _ = applyCommand(t, state, Command{Type: CommandOpenDoor}, pack)
		state.Turn.Encounter.PlayerCombatModifier = 7
		monsterID := state.Turn.Encounter.MonsterInstanceID
		state.Players[0].Hand = append(
			state.Players[0].Hand,
			state.TreasureDeck...,
		)
		state.Players[0].Hand = append(
			state.Players[0].Hand,
			state.TreasureDiscard...,
		)
		state.TreasureDeck = nil
		state.TreasureDiscard = nil
		if err := state.Validate(); err != nil {
			t.Fatal(err)
		}
		before := state.Clone()
		beforeHand := len(state.Players[0].Hand)
		beforeLevel := state.Players[0].Level
		next, envelopes := applyCommand(
			t,
			state,
			Command{Type: CommandResolveCombat},
			pack,
		)
		if next.Turn.Phase != PhaseCharity ||
			next.Turn.Encounter != nil ||
			next.Players[0].Level != beforeLevel+1 ||
			len(next.Players[0].Hand) != beforeHand ||
			!slicesContains(next.DoorDiscard, monsterID) {
			t.Fatalf("empty reward supply blocked combat completion: %#v", next)
		}
		replayed, err := ReplayFrom(before, envelopes)
		if err != nil {
			t.Fatal(err)
		}
		if !reflect.DeepEqual(replayed, next) {
			t.Fatal("empty-reward combat did not replay")
		}
	})

	t.Run("partial treasure supply", func(t *testing.T) {
		state, _ := startedState(t, pack, 1)
		state, _ = finishSetup(t, state, pack)
		forceDoorTop(t, &state, "archive-dust")
		state, _ = applyCommand(t, state, Command{Type: CommandOpenDoor}, pack)
		state.Turn.Encounter.PlayerCombatModifier = 7
		available := append([]string(nil), state.TreasureDeck...)
		available = append(available, state.TreasureDiscard...)
		if len(available) < 2 {
			t.Fatal("fixture needs at least two remaining Treasure cards")
		}
		state.Players[0].Hand = append(state.Players[0].Hand, available[1:]...)
		state.TreasureDeck = nil
		state.TreasureDiscard = []string{available[0]}
		if err := state.Validate(); err != nil {
			t.Fatal(err)
		}
		beforeHand := len(state.Players[0].Hand)
		next, envelopes := applyCommand(
			t,
			state,
			Command{Type: CommandResolveCombat},
			pack,
		)
		if next.Turn.Phase != PhaseCharity ||
			len(next.Players[0].Hand) != beforeHand+1 {
			t.Fatalf("partial reward supply was not exhausted cleanly: %#v", next)
		}
		var payload stateChangedPayload
		if err := json.Unmarshal(envelopes[0].Payload, &payload); err != nil {
			t.Fatal(err)
		}
		if len(payload.Outcomes) != 1 ||
			payload.Outcomes[0].Kind != "shuffle" ||
			payload.Outcomes[0].Deck != DeckTreasure {
			t.Fatalf("partial reward shuffle was not persisted: %#v", payload.Outcomes)
		}
	})
}

func TestRunAwayPersistsRollAndDeathRevivesWithFreshHand(t *testing.T) {
	pack := testPack(t)
	state, _ := startedState(t, pack, 1)
	state, _ = finishSetup(t, state, pack)
	moveDefinition(t, &state, "swift-courier", &state.Players[0].Traits)
	moveDefinition(t, &state, "broken-laces", &state.Players[0].PersistentCurses)
	forceDoorTop(t, &state, "night-inspector")
	state, _ = applyCommand(t, state, Command{Type: CommandOpenDoor}, pack)
	state, _ = applyCommand(t, state, Command{Type: CommandResolveCombat}, pack)
	for seed := uint64(1); ; seed++ {
		roll, _ := rollD6(seed)
		if roll < 5 {
			state.RNGState = seed
			break
		}
	}
	events, err := Handle(
		state,
		Command{Type: CommandRunAway, ActorID: "player-a"},
		pack,
	)
	if err != nil {
		t.Fatal(err)
	}
	var payload stateChangedPayload
	if err := json.Unmarshal(events[0].Payload, &payload); err != nil {
		t.Fatal(err)
	}
	if len(payload.Outcomes) != 1 ||
		payload.Outcomes[0].Kind != "d6" ||
		payload.Outcomes[0].Roll < 1 ||
		payload.Outcomes[0].Roll > 4 {
		t.Fatalf("run-away roll was not persisted: %#v", payload.Outcomes)
	}
	state, _ = applyForTest(t, state, events)
	if !state.Players[0].Dead ||
		!state.Players[0].NeedsRedraw ||
		len(state.Players[0].Traits) != 1 ||
		len(state.Players[0].PersistentCurses) != 1 ||
		len(state.Players[0].Hand) != 0 {
		t.Fatalf("death preservation is wrong: %#v", state.Players[0])
	}
	state, _ = applyCommand(
		t,
		state,
		Command{Type: CommandResolveCharity},
		pack,
	)
	state, _ = applyCommand(t, state, Command{Type: CommandEndTurn}, pack)
	if state.Players[0].Dead ||
		state.Players[0].NeedsRedraw ||
		len(state.Players[0].Hand) != 8 ||
		len(state.Players[0].Traits) != 1 ||
		len(state.Players[0].PersistentCurses) != 1 {
		t.Fatalf("revival/redeal is wrong: %#v", state.Players[0])
	}
}

func TestDeadPlayerRevivesOnlyAtStartOfOwnNextTurn(t *testing.T) {
	pack := testPack(t)
	state, _ := startedState(t, pack, 3)
	state, _ = finishSetup(t, state, pack)
	if err := killPlayer(&state, 0, pack); err != nil {
		t.Fatal(err)
	}
	setTurnPhase(&state, PhaseCharity)

	state, _ = applyCommand(
		t,
		state,
		Command{Type: CommandResolveCharity},
		pack,
	)
	state, _ = applyCommand(t, state, Command{Type: CommandEndTurn}, pack)
	if state.Turn.PlayerID != "player-b" || !state.Players[0].Dead {
		t.Fatalf("dead player revived before own turn: %#v", state.Players[0])
	}

	setTurnPhase(&state, PhaseEndTurn)
	state, _ = applyCommand(t, state, Command{Type: CommandEndTurn}, pack)
	if state.Turn.PlayerID != "player-c" || !state.Players[0].Dead {
		t.Fatalf("dead player revived during another turn: %#v", state.Players[0])
	}

	setTurnPhase(&state, PhaseEndTurn)
	state, _ = applyCommand(t, state, Command{Type: CommandEndTurn}, pack)
	if state.Turn.PlayerID != "player-a" ||
		state.Players[0].Dead ||
		state.Players[0].NeedsRedraw ||
		len(state.Players[0].Hand) != 8 {
		t.Fatalf("player did not revive on own next turn: %#v", state.Players[0])
	}
}

func TestEffectChoiceUsesVisibleAllowlistedInstances(t *testing.T) {
	pack := testPack(t)
	state, _ := startedState(t, pack, 1)
	state, _ = finishSetup(t, state, pack)
	forceDoorTop(t, &state, "wet-documents")
	before := len(state.Players[0].Hand)
	state, _ = applyCommand(t, state, Command{Type: CommandOpenDoor}, pack)
	if state.Turn.Phase != PhaseResolveEffect ||
		state.Turn.Pending == nil ||
		state.Turn.Pending.Minimum != 1 {
		t.Fatalf("effect choice was not projected in state: %#v", state.Turn.Pending)
	}
	if events, err := Handle(state, Command{
		Type:      CommandChooseEffect,
		ActorID:   "player-a",
		ChoiceIDs: []string{"forged-instance"},
	}, pack); err == nil || len(events) != 0 {
		t.Fatal("forged effect option was accepted")
	}
	selected := state.Turn.Pending.Options[0]
	state, _ = applyCommand(t, state, Command{
		Type:      CommandChooseEffect,
		ChoiceIDs: []string{selected},
	}, pack)
	if state.Turn.Phase != PhaseDoorChoice ||
		len(state.Players[0].Hand) != before-1 {
		t.Fatalf("effect choice did not resume turn: %#v", state)
	}
}

func TestEquipmentCheatSaleAndNonWinningLevels(t *testing.T) {
	pack := testPack(t)
	state, _ := startedState(t, pack, 1)
	state, _ = finishSetup(t, state, pack)
	restricted := moveDefinition(
		t,
		&state,
		"two-handed-sign",
		&state.Players[0].Hand,
	)
	state, _ = applyCommand(t, state, Command{
		Type:       CommandPlayCard,
		InstanceID: restricted,
	}, pack)
	if events, err := Handle(state, Command{
		Type:       CommandEquipItem,
		ActorID:    "player-a",
		InstanceID: restricted,
	}, pack); err == nil || len(events) != 0 {
		t.Fatal("restricted item equipped without required tag")
	}
	cheat := moveDefinition(t, &state, "stamped-exception", &state.Players[0].Hand)
	state, _ = applyCommand(t, state, Command{
		Type:             CommandPlayCard,
		InstanceID:       cheat,
		TargetInstanceID: restricted,
	}, pack)
	state, _ = applyCommand(t, state, Command{
		Type:       CommandEquipItem,
		InstanceID: restricted,
	}, pack)
	if !slicesContains(state.Players[0].Equipped, restricted) {
		t.Fatal("cheat did not bypass item restriction")
	}
	secondBig := moveDefinitionExcluding(
		t,
		&state,
		"two-handed-sign",
		&state.Players[0].Hand,
		restricted,
	)
	state, _ = applyCommand(t, state, Command{
		Type:       CommandPlayCard,
		InstanceID: secondBig,
	}, pack)
	thirdBig := moveDefinition(
		t,
		&state,
		"roomy-cart",
		&state.Players[0].Hand,
	)
	if events, err := Handle(state, Command{
		Type:       CommandPlayCard,
		ActorID:    "player-a",
		InstanceID: thirdBig,
	}, pack); err == nil || len(events) != 0 {
		t.Fatal("Big item above the uncheated allowance entered play")
	}
	secondCheat := moveDefinitionExcluding(
		t,
		&state,
		"stamped-exception",
		&state.Players[0].Hand,
		cheat,
	)
	state, _ = applyCommand(t, state, Command{
		Type:             CommandPlayCard,
		InstanceID:       secondCheat,
		TargetInstanceID: thirdBig,
	}, pack)
	state, _ = applyCommand(t, state, Command{
		Type:       CommandEquipItem,
		InstanceID: thirdBig,
	}, pack)
	if state.Players[0].CheatTargets[secondCheat] != thirdBig ||
		!slicesContains(state.Players[0].Equipped, thirdBig) {
		t.Fatal("cheat did not atomically bring a restricted Big item into play")
	}

	first := moveDefinition(t, &state, "folding-umbrella", &state.Players[0].Hand)
	second := moveDefinition(t, &state, "archive-key", &state.Players[0].Hand)
	state.Players[0].Level = 8
	state, _ = applyCommand(t, state, Command{
		Type:        CommandSellItems,
		InstanceIDs: []string{first, second},
	}, pack)
	if state.Players[0].Level != 9 {
		t.Fatalf("1000-value sale did not grant one level: %d", state.Players[0].Level)
	}
	levelUp := moveDefinition(
		t,
		&state,
		"late-train-lesson",
		&state.Players[0].Hand,
	)
	state, _ = applyCommand(t, state, Command{
		Type:       CommandPlayCard,
		InstanceID: levelUp,
	}, pack)
	if state.Players[0].Level != 9 || state.Status != StatusActive {
		t.Fatal("ordinary level-up granted the winning level")
	}
}

func TestLoadoutReconciliationAndMandatoryOverflowChoice(t *testing.T) {
	pack := testPack(t)

	t.Run("restriction loss carries the item and trait attachment follows bases", func(t *testing.T) {
		state, _ := startedState(t, pack, 1)
		state, _ = finishSetup(t, state, pack)
		courier := moveDefinition(t, &state, "swift-courier", &state.Players[0].Traits)
		restricted := moveDefinition(
			t,
			&state,
			"two-handed-sign",
			&state.Players[0].Hand,
		)
		state, _ = applyCommand(t, state, Command{
			Type:       CommandPlayCard,
			InstanceID: restricted,
		}, pack)
		state, _ = applyCommand(t, state, Command{
			Type:       CommandEquipItem,
			InstanceID: restricted,
		}, pack)
		state, _ = applyCommand(t, state, Command{
			Type:       CommandDiscardCard,
			InstanceID: courier,
		}, pack)
		if slicesContains(state.Players[0].Equipped, restricted) ||
			!slicesContains(state.Players[0].Carried, restricted) {
			t.Fatalf("restricted item was not carried after tag loss: %#v", state.Players[0])
		}

		firstClass := moveDefinition(
			t,
			&state,
			"swift-courier",
			&state.Players[0].Traits,
		)
		secondClass := moveDefinition(
			t,
			&state,
			"patient-archivist",
			&state.Players[0].Traits,
		)
		attachment := moveDefinition(
			t,
			&state,
			"double-shift",
			&state.Players[0].Attachments,
		)
		state, _ = applyCommand(t, state, Command{
			Type:       CommandDiscardCard,
			InstanceID: firstClass,
		}, pack)
		if !slicesContains(state.Players[0].Attachments, attachment) {
			t.Fatal("attachment disappeared while one base trait remained")
		}
		state, _ = applyCommand(t, state, Command{
			Type:       CommandDiscardCard,
			InstanceID: secondClass,
		}, pack)
		if slicesContains(state.Players[0].Attachments, attachment) ||
			!slicesContains(state.DoorDiscard, attachment) {
			t.Fatal("orphan trait attachment was not discarded exactly once")
		}
		if err := state.Validate(); err != nil {
			t.Fatal(err)
		}
	})

	t.Run("allowance loss creates a mandatory follow-up choice", func(t *testing.T) {
		state, _ := startedState(t, pack, 1)
		state, _ = finishSetup(t, state, pack)
		allowance := moveDefinition(t, &state, "born-local", &state.Players[0].Traits)
		firstBig := moveDefinition(
			t,
			&state,
			"two-handed-sign",
			&state.Players[0].Carried,
		)
		secondBig := moveDefinitionExcluding(
			t,
			&state,
			"two-handed-sign",
			&state.Players[0].Carried,
			firstBig,
		)
		forceDoorTop(t, &state, "forgotten-title")
		state, _ = applyCommand(t, state, Command{Type: CommandOpenDoor}, pack)
		if state.Turn.Phase != PhaseResolveEffect ||
			state.Turn.Pending == nil ||
			state.Turn.Pending.Minimum != 1 ||
			!slicesContains(state.DoorDiscard, allowance) ||
			!slicesContains(state.Turn.Pending.Options, firstBig) ||
			!slicesContains(state.Turn.Pending.Options, secondBig) {
			t.Fatalf("Big overflow did not request a legal cleanup: %#v", state.Turn.Pending)
		}
		state, _ = applyCommand(t, state, Command{
			Type:      CommandChooseEffect,
			ChoiceIDs: []string{firstBig},
		}, pack)
		if state.Turn.Phase != PhaseDoorChoice ||
			slicesContains(state.Players[0].Carried, firstBig) ||
			!slicesContains(state.Players[0].Carried, secondBig) {
			t.Fatalf("loadout cleanup did not resume the turn: %#v", state)
		}
	})

	t.Run("discarded Cheat leaves an otherwise legal target equipped", func(t *testing.T) {
		for _, definitionID := range []string{"folding-umbrella", "roomy-cart"} {
			state, _ := startedState(t, pack, 1)
			state, _ = finishSetup(t, state, pack)
			target := moveDefinition(
				t,
				&state,
				definitionID,
				&state.Players[0].Hand,
			)
			state, _ = applyCommand(t, state, Command{
				Type:       CommandPlayCard,
				InstanceID: target,
			}, pack)
			state, _ = applyCommand(t, state, Command{
				Type:       CommandEquipItem,
				InstanceID: target,
			}, pack)
			cheat := moveDefinition(
				t,
				&state,
				"stamped-exception",
				&state.Players[0].Hand,
			)
			state, _ = applyCommand(t, state, Command{
				Type:             CommandPlayCard,
				InstanceID:       cheat,
				TargetInstanceID: target,
			}, pack)
			if definitionID == "roomy-cart" {
				secondBig := moveDefinition(
					t,
					&state,
					"heavy-kiosk",
					&state.Players[0].Hand,
				)
				state, _ = applyCommand(t, state, Command{
					Type:       CommandPlayCard,
					InstanceID: secondBig,
				}, pack)
			}
			var outcomes []RandomOutcome
			if err := beginEffectSequence(
				&state,
				0,
				"",
				[]Effect{{
					Kind:     EffectDiscard,
					Selector: SelectorOwnedCard,
					Count:    1,
				}},
				PendingFinalize{Phase: PhaseDoorChoice},
				pack,
				&outcomes,
			); err != nil {
				t.Fatal(err)
			}
			state, _ = applyCommand(t, state, Command{
				Type:      CommandChooseEffect,
				ChoiceIDs: []string{cheat},
			}, pack)
			if state.Turn.Phase != PhaseDoorChoice ||
				state.Turn.Pending != nil ||
				!slicesContains(state.Players[0].Equipped, target) {
				t.Fatalf(
					"legal %s target was unequipped after Cheat loss: %#v",
					definitionID,
					state,
				)
			}
		}
	})

	t.Run("discarded Cheat carries its target before reconciling slots", func(t *testing.T) {
		state, _ := startedState(t, pack, 1)
		state, _ = finishSetup(t, state, pack)
		umbrella := moveDefinition(
			t,
			&state,
			"folding-umbrella",
			&state.Players[0].Hand,
		)
		state, _ = applyCommand(t, state, Command{
			Type:       CommandPlayCard,
			InstanceID: umbrella,
		}, pack)
		state, _ = applyCommand(t, state, Command{
			Type:       CommandEquipItem,
			InstanceID: umbrella,
		}, pack)
		target := moveDefinition(
			t,
			&state,
			"two-handed-sign",
			&state.Players[0].Hand,
		)
		state, _ = applyCommand(t, state, Command{
			Type:       CommandPlayCard,
			InstanceID: target,
		}, pack)
		cheat := moveDefinition(
			t,
			&state,
			"stamped-exception",
			&state.Players[0].Hand,
		)
		state, _ = applyCommand(t, state, Command{
			Type:             CommandPlayCard,
			InstanceID:       cheat,
			TargetInstanceID: target,
		}, pack)
		state, _ = applyCommand(t, state, Command{
			Type:       CommandEquipItem,
			InstanceID: target,
		}, pack)
		var outcomes []RandomOutcome
		if err := beginEffectSequence(
			&state,
			0,
			"",
			[]Effect{{
				Kind:     EffectDiscard,
				Selector: SelectorOwnedCard,
				Count:    1,
			}},
			PendingFinalize{Phase: PhaseDoorChoice},
			pack,
			&outcomes,
		); err != nil {
			t.Fatal(err)
		}
		if state.Turn.Pending == nil ||
			!slicesContains(state.Turn.Pending.Options, cheat) {
			t.Fatal("Cheat was not offered as an owned-card discard")
		}
		state, _ = applyCommand(t, state, Command{
			Type:      CommandChooseEffect,
			ChoiceIDs: []string{cheat},
		}, pack)
		if state.Turn.Phase != PhaseDoorChoice ||
			!slicesContains(state.Players[0].Equipped, umbrella) ||
			slicesContains(state.Players[0].Equipped, target) ||
			!slicesContains(state.Players[0].Carried, target) ||
			!slicesContains(state.TreasureDiscard, cheat) {
			t.Fatalf("discarding Cheat did not restore a legal loadout: %#v", state)
		}
	})

	t.Run("discarded Cheat queues mandatory Big overflow cleanup", func(t *testing.T) {
		state, _ := startedState(t, pack, 1)
		state, _ = finishSetup(t, state, pack)
		firstBig := moveDefinition(
			t,
			&state,
			"heavy-kiosk",
			&state.Players[0].Carried,
		)
		secondBig := moveDefinition(
			t,
			&state,
			"two-handed-sign",
			&state.Players[0].Carried,
		)
		cheat := moveDefinition(
			t,
			&state,
			"stamped-exception",
			&state.Players[0].Attachments,
		)
		state.Players[0].CheatTargets = map[string]string{cheat: secondBig}
		if err := state.Validate(); err != nil {
			t.Fatal(err)
		}
		var outcomes []RandomOutcome
		if err := beginEffectSequence(
			&state,
			0,
			"",
			[]Effect{{
				Kind:     EffectDiscard,
				Selector: SelectorOwnedCard,
				Count:    1,
			}},
			PendingFinalize{Phase: PhaseDoorChoice},
			pack,
			&outcomes,
		); err != nil {
			t.Fatal(err)
		}
		state, _ = applyCommand(t, state, Command{
			Type:      CommandChooseEffect,
			ChoiceIDs: []string{cheat},
		}, pack)
		if state.Turn.Phase != PhaseResolveEffect ||
			state.Turn.Pending == nil ||
			state.Turn.Pending.Minimum != 1 ||
			!slicesContains(state.Turn.Pending.Options, firstBig) ||
			!slicesContains(state.Turn.Pending.Options, secondBig) {
			t.Fatalf("Cheat loss did not queue Big cleanup: %#v", state.Turn.Pending)
		}
		state, _ = applyCommand(t, state, Command{
			Type:      CommandChooseEffect,
			ChoiceIDs: []string{firstBig},
		}, pack)
		if state.Turn.Phase != PhaseDoorChoice ||
			slicesContains(state.Players[0].Carried, firstBig) ||
			!slicesContains(state.Players[0].Carried, secondBig) {
			t.Fatalf("Big cleanup after Cheat loss did not resume: %#v", state)
		}
	})

	t.Run("cascade-selected Cheat and target resolve in either order", func(t *testing.T) {
		for _, targetFirst := range []bool{true, false} {
			state, _ := startedState(t, pack, 1)
			state, _ = finishSetup(t, state, pack)
			target := moveDefinition(
				t,
				&state,
				"heavy-kiosk",
				&state.Players[0].Carried,
			)
			cheat := moveDefinition(
				t,
				&state,
				"stamped-exception",
				&state.Players[0].Attachments,
			)
			state.Players[0].CheatTargets = map[string]string{cheat: target}
			selected := []string{cheat, target}
			if targetFirst {
				selected = []string{target, cheat}
			}
			state.Turn.Pending = &PendingDecision{
				Type:     "effect_choice",
				ActorID:  "player-a",
				Options:  []string{target, cheat},
				Minimum:  2,
				Maximum:  2,
				Effect:   Effect{Kind: EffectDiscard, Selector: SelectorOwnedCard, Count: 2},
				Finalize: PendingFinalize{Phase: PhaseDoorChoice},
			}
			setTurnPhase(&state, PhaseResolveEffect)
			state, _ = applyCommand(t, state, Command{
				Type:      CommandChooseEffect,
				ChoiceIDs: selected,
			}, pack)
			if state.Turn.Phase != PhaseDoorChoice ||
				ownsInstance(state.Players[0], target) ||
				ownsInstance(state.Players[0], cheat) {
				t.Fatalf(
					"cascade selection failed for targetFirst=%t: %#v",
					targetFirst,
					state,
				)
			}
		}
	})
}

func TestSaleQueuesMandatoryLoadoutCleanup(t *testing.T) {
	pack := testPack(t)
	state, _ := startedState(t, pack, 1)
	state, _ = finishSetup(t, state, pack)
	cart := moveDefinition(t, &state, "roomy-cart", &state.Players[0].Hand)
	state, _ = applyCommand(t, state, Command{
		Type:       CommandPlayCard,
		InstanceID: cart,
	}, pack)
	cheat := moveDefinition(
		t,
		&state,
		"stamped-exception",
		&state.Players[0].Hand,
	)
	state, _ = applyCommand(t, state, Command{
		Type:             CommandPlayCard,
		InstanceID:       cheat,
		TargetInstanceID: cart,
	}, pack)
	state, _ = applyCommand(t, state, Command{
		Type:       CommandEquipItem,
		InstanceID: cart,
	}, pack)
	firstBig := moveDefinition(
		t,
		&state,
		"heavy-kiosk",
		&state.Players[0].Hand,
	)
	state, _ = applyCommand(t, state, Command{
		Type:       CommandPlayCard,
		InstanceID: firstBig,
	}, pack)
	secondBig := moveDefinitionExcluding(
		t,
		&state,
		"heavy-kiosk",
		&state.Players[0].Hand,
		firstBig,
	)
	state, _ = applyCommand(t, state, Command{
		Type:       CommandPlayCard,
		InstanceID: secondBig,
	}, pack)
	key := moveDefinition(t, &state, "archive-key", &state.Players[0].Hand)
	beforeLevel := state.Players[0].Level
	state, _ = applyCommand(t, state, Command{
		Type:        CommandSellItems,
		InstanceIDs: []string{cart, key},
	}, pack)
	if state.Players[0].Level != beforeLevel+1 ||
		state.Turn.Phase != PhaseResolveEffect ||
		state.Turn.Pending == nil ||
		state.Turn.Pending.Minimum != 1 ||
		!slicesContains(state.Turn.Pending.Options, firstBig) ||
		!slicesContains(state.Turn.Pending.Options, secondBig) {
		t.Fatalf("sale did not queue mandatory Big cleanup: %#v", state)
	}
	state, _ = applyCommand(t, state, Command{
		Type:      CommandChooseEffect,
		ChoiceIDs: []string{firstBig},
	}, pack)
	if state.Turn.Phase != PhasePreparation ||
		slicesContains(state.Players[0].Carried, firstBig) ||
		!slicesContains(state.Players[0].Carried, secondBig) {
		t.Fatalf("sale cleanup did not resume its original phase: %#v", state)
	}
}

func TestProjectionContainsOnlyExecutableManagementActions(t *testing.T) {
	pack := testPack(t)
	state, _ := startedState(t, pack, 1)
	state, _ = finishSetup(t, state, pack)

	for _, instanceID := range append([]string(nil), state.Players[0].Hand...) {
		if err := discardOwnedInstance(&state, 0, instanceID, pack); err != nil {
			t.Fatal(err)
		}
	}
	firstCart := moveDefinition(t, &state, "roomy-cart", &state.Players[0].Hand)
	state, _ = applyCommand(t, state, Command{
		Type:       CommandPlayCard,
		InstanceID: firstCart,
	}, pack)
	state, _ = applyCommand(t, state, Command{
		Type:       CommandEquipItem,
		InstanceID: firstCart,
	}, pack)
	secondCart := moveDefinitionExcluding(
		t,
		&state,
		"roomy-cart",
		&state.Players[0].Hand,
		firstCart,
	)
	state, _ = applyCommand(t, state, Command{
		Type:       CommandPlayCard,
		InstanceID: secondCart,
	}, pack)
	if events, err := Handle(state, Command{
		Type:       CommandUnequipItem,
		ActorID:    "player-a",
		InstanceID: firstCart,
	}, pack); err == nil || len(events) != 0 {
		t.Fatal("allowance provider was unequipped into an illegal loadout")
	}
	projection, err := ProjectForActor(state, "player-a", pack)
	if err != nil {
		t.Fatal(err)
	}
	for _, action := range projection.Turn.AvailableActions {
		if action.Type == CommandUnequipItem &&
			action.SourceInstanceID == firstCart {
			t.Fatal("projection advertised a reducer-invalid unequip")
		}
	}

	if err := discardOwnedInstance(&state, 0, secondCart, pack); err != nil {
		t.Fatal(err)
	}
	cheap := moveDefinition(t, &state, "folding-umbrella", &state.Players[0].Hand)
	projection, err = ProjectForActor(state, "player-a", pack)
	if err != nil {
		t.Fatal(err)
	}
	for _, action := range projection.Turn.AvailableActions {
		if action.Type == CommandSellItems {
			t.Fatal("projection advertised a sale below the level threshold")
		}
	}
	second := moveDefinition(t, &state, "archive-key", &state.Players[0].Hand)
	projection, err = ProjectForActor(state, "player-a", pack)
	if err != nil {
		t.Fatal(err)
	}
	var sale *ActionView
	for index := range projection.Turn.AvailableActions {
		action := &projection.Turn.AvailableActions[index]
		if action.Type == CommandSellItems {
			sale = action
			break
		}
	}
	if sale == nil ||
		sale.MinimumTotal != SaleLevelCost ||
		sale.InstanceValues[cheap]+sale.InstanceValues[second] < SaleLevelCost {
		t.Fatalf("sale descriptor omitted authoritative value constraint: %#v", sale)
	}
}

func TestCharacterTagReplacementSuppressesTraitTag(t *testing.T) {
	pack := testPack(t)
	state, _ := startedState(t, pack, 1)
	state, _ = finishSetup(t, state, pack)
	moveDefinition(t, &state, "curious-tourist", &state.Players[0].Traits)
	mixup := moveDefinition(t, &state, "identity-mixup", &state.Players[0].Hand)
	state, _ = applyCommand(t, state, Command{
		Type:       CommandPlayCard,
		InstanceID: mixup,
	}, pack)
	projection, err := ProjectForActor(state, "player-a", pack)
	if err != nil {
		t.Fatal(err)
	}
	if slicesContains(projection.You.CharacterTags, "tourist") ||
		!slicesContains(projection.You.CharacterTags, "local") {
		t.Fatalf("trait tag replacement was not reflected: %#v", projection.You.CharacterTags)
	}
}

func TestWinningLevelRequiresMonsterKill(t *testing.T) {
	pack := testPack(t)
	state, _ := startedState(t, pack, 1)
	state, _ = finishSetup(t, state, pack)
	state.Players[0].Level = 9
	forceDoorTop(t, &state, "courtyard-pigeon")
	state, _ = applyCommand(t, state, Command{Type: CommandOpenDoor}, pack)
	state.Turn.Encounter.PlayerCombatModifier = 1
	state, _ = applyCommand(
		t,
		state,
		Command{Type: CommandResolveCombat},
		pack,
	)
	if state.Status != StatusFinished ||
		state.WinnerPlayerID != "player-a" ||
		state.Players[0].Level != WinningLevel {
		t.Fatalf("monster kill did not win: %#v", state)
	}
}

func TestDiscardReshuffleIsPersistedAndReplayDoesNotUseRNG(t *testing.T) {
	pack := testPack(t)
	state, _ := startedState(t, pack, 1)
	state, _ = finishSetup(t, state, pack)
	state.DoorDiscard = append(state.DoorDiscard, state.DoorDeck...)
	state.DoorDeck = nil
	if err := state.Validate(); err != nil {
		t.Fatal(err)
	}
	beforeRNG := state.RNGState
	events, err := Handle(
		state,
		Command{Type: CommandOpenDoor, ActorID: "player-a"},
		pack,
	)
	if err != nil {
		t.Fatal(err)
	}
	var payload stateChangedPayload
	if err := json.Unmarshal(events[0].Payload, &payload); err != nil {
		t.Fatal(err)
	}
	if len(payload.Outcomes) == 0 ||
		payload.Outcomes[0].Kind != "shuffle" ||
		payload.State.RNGState == beforeRNG {
		t.Fatalf("reshuffle outcome was not persisted: %#v", payload.Outcomes)
	}
	next, envelopes := applyForTest(t, state, events)
	replayed, err := ReplayFrom(state, envelopes)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(next, replayed) {
		t.Fatal("replay regenerated reshuffle instead of applying event")
	}
}

func TestProjectionDoesNotLeakOtherHandDeckOrderOrCredentials(t *testing.T) {
	pack := testPack(t)
	state, _ := startedState(t, pack, 2)
	secretInstance := state.Players[1].Hand[0]
	projection, err := ProjectForActor(state, "player-a", pack)
	if err != nil {
		t.Fatal(err)
	}
	raw, err := json.Marshal(projection)
	if err != nil {
		t.Fatal(err)
	}
	serialized := string(raw)
	for _, forbidden := range []string{
		secretInstance,
		"credential_hash",
		"door_deck\"",
		"treasure_deck\"",
		"rng_state",
		"content_digest",
	} {
		if strings.Contains(serialized, forbidden) {
			t.Fatalf("projection leaked %q: %s", forbidden, serialized)
		}
	}
	if len(projection.You.Hand) != 8 ||
		projection.Players[1].HandCount != 8 ||
		len(projection.Turn.AvailableActions) == 0 {
		t.Fatalf("projection omitted actor-visible data: %#v", projection)
	}
	if _, err := ProjectForActor(state, "outsider", pack); err == nil {
		t.Fatal("outsider unexpectedly received a projection")
	}
}

func TestLegacyBootstrapEventFailsWithExplicitDiagnostic(t *testing.T) {
	pack := testPack(t)
	state, envelopes := startedState(t, pack, 1)
	legacy := EventEnvelope{
		GameID:     state.GameID,
		Sequence:   state.Version + 1,
		EventID:    "legacy-event",
		CommandID:  "legacy-command",
		Type:       legacyEventGameStarted,
		Schema:     1,
		OccurredAt: time.Now().UTC(),
		Payload:    json.RawMessage(`{}`),
	}
	_, err := ReplayFrom(state, []EventEnvelope{legacy})
	if !errors.Is(err, ErrIncompatibleState) {
		t.Fatalf("legacy event diagnostic: %v", err)
	}
	if len(envelopes) == 0 {
		t.Fatal("fixture did not create current events")
	}
}

func slicesContains(values []string, target string) bool {
	for _, value := range values {
		if value == target {
			return true
		}
	}
	return false
}
