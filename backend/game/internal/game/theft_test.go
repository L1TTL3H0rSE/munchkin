package game

import (
	"bytes"
	"encoding/json"
	"reflect"
	"slices"
	"testing"
	"time"
)

func theftState(t *testing.T) (State, Pack, string, string) {
	t.Helper()
	pack := testPack(t)
	pack.SetID = "moscow-core"
	pack.Version = 4
	pack.Source = "original-theft-test"
	pack.Cards = append(pack.Cards,
		Card{
			ID:               "theft-class",
			Name:             "Test Theft Class",
			Deck:             DeckDoor,
			Kind:             CardClass,
			Copies:           1,
			InteractionScope: InteractionOtherPlayers,
			Trait: &TraitSpec{
				Group: TraitClass,
				Tags:  []string{"theft-test"},
			},
			Abilities: []Ability{{
				Kind:          AbilityStealRandomCard,
				DiscardCount:  1,
				CooldownTurns: 1,
			}},
		},
		Card{
			ID:               "theft-counter",
			Name:             "Test Theft Counter",
			Deck:             DeckTreasure,
			Kind:             CardOneShot,
			Copies:           1,
			InteractionScope: InteractionOtherPlayers,
			Effects: []Effect{{
				Kind:   EffectModifyCombat,
				Amount: 1,
				Target: EffectTargetPlayer,
			}},
			TheftCapability: &TheftCapability{
				Kind: TheftCapabilityCounter,
			},
		},
	)
	pack.ContentDigest = CardsDigest(pack.Cards)
	if err := pack.Validate(); err != nil {
		t.Fatal(err)
	}
	state, _ := startedState(t, pack, 3)
	state.RulesProfileID = TheftProfileID
	state.RulesProfileVersion = TheftProfileVersion
	state, _ = finishSetup(t, state, pack)
	sourceID := "theft-class-1"
	counterID := "theft-counter-1"
	state.Instances[sourceID] = CardInstance{
		ID:           sourceID,
		DefinitionID: "theft-class",
	}
	state.Instances[counterID] = CardInstance{
		ID:           counterID,
		DefinitionID: "theft-counter",
	}
	state.Players[0].Traits = append(state.Players[0].Traits, sourceID)
	state.Players[2].Hand = append(state.Players[2].Hand, counterID)
	if err := state.Validate(); err != nil {
		t.Fatal(err)
	}
	return state, pack, sourceID, counterID
}

func openTheftForTest(
	t *testing.T,
	state State,
	pack Pack,
	sourceID string,
	openedAt time.Time,
) (State, string) {
	t.Helper()
	costID := state.Players[0].Hand[0]
	events, err := Handle(state, Command{
		Type:           CommandAttemptTheft,
		ActorID:        "player-a",
		InstanceID:     sourceID,
		AbilityIndex:   0,
		InstanceIDs:    []string{costID},
		TargetPlayerID: "player-b",
		InteractionID:  "interaction-theft",
		InteractionAt:  openedAt,
	}, pack)
	if err != nil {
		t.Fatal(err)
	}
	if len(events) != 1 || events[0].Type != EventTheftAttemptStarted {
		t.Fatalf("theft open events=%#v", events)
	}
	next, _ := applyForTest(t, state, events)
	return next, costID
}

func TestTheftTimeoutPersistsServerRandomSelectionAndReplay(t *testing.T) {
	state, pack, sourceID, _ := theftState(t)
	openedAt := time.Date(2026, 7, 31, 6, 0, 0, 0, time.UTC)
	state, costID := openTheftForTest(
		t,
		state,
		pack,
		sourceID,
		openedAt,
	)
	victimBefore := append([]string(nil), state.Players[1].Hand...)
	events, err := Handle(state, Command{
		Type:                CommandTimeoutInteraction,
		InteractionID:       "interaction-theft",
		InteractionAt:       state.InteractionWindow.DeadlineAt,
		InteractionRevision: 1,
	}, pack)
	if err != nil {
		t.Fatal(err)
	}
	if len(events) != 4 ||
		events[len(events)-1].Type != EventTheftResolved {
		t.Fatalf("theft timeout events=%#v", events)
	}
	next, _ := applyForTest(t, state, events)
	if slices.Contains(next.Players[0].Hand, costID) ||
		len(next.Players[1].Hand) != len(victimBefore)-1 ||
		len(next.Players[0].Hand) != len(state.Players[0].Hand) ||
		next.TheftAttempt != nil ||
		next.InteractionWindow.Status != InteractionWindowClosed {
		t.Fatalf("theft settlement=%#v", next)
	}
	var payload stateChangedPayload
	if err := json.Unmarshal(
		events[len(events)-1].Payload,
		&payload,
	); err != nil {
		t.Fatal(err)
	}
	if len(payload.Outcomes) != 1 ||
		payload.Outcomes[0].Kind != "theft" ||
		len(payload.Outcomes[0].Order) != 1 ||
		!slices.Contains(
			victimBefore,
			payload.Outcomes[0].Order[0],
		) {
		t.Fatalf("persisted theft outcome=%#v", payload.Outcomes)
	}
	replayed := state
	for _, event := range events {
		replayed, err = Apply(replayed, event)
		if err != nil {
			t.Fatal(err)
		}
	}
	if !reflect.DeepEqual(replayed, next) {
		t.Fatal("theft replay regenerated RNG instead of applying outcome")
	}
}

func TestTheftCounterSettlesCostAndCounterWithoutPrivateLeak(t *testing.T) {
	state, pack, sourceID, counterID := theftState(t)
	openedAt := time.Date(2026, 7, 31, 6, 5, 0, 0, time.UTC)
	state, costID := openTheftForTest(
		t,
		state,
		pack,
		sourceID,
		openedAt,
	)
	victimHand := append([]string(nil), state.Players[1].Hand...)
	for _, actorID := range []string{"player-a", "player-b", "player-c"} {
		projection, err := ProjectForActor(state, actorID, pack)
		if err != nil {
			t.Fatal(err)
		}
		raw, err := json.Marshal(projection)
		if err != nil {
			t.Fatal(err)
		}
		for _, foreignID := range victimHand {
			if actorID != "player-b" &&
				slices.Contains(state.Players[1].Hand, foreignID) &&
				bytes.Contains(raw, []byte(foreignID)) {
				t.Fatalf("%s received victim card %s", actorID, foreignID)
			}
		}
		if projection.Interaction == nil ||
			projection.Interaction.PublicKind != "theft_response" {
			t.Fatalf("%s theft projection=%#v", actorID, projection.Interaction)
		}
	}
	counterProjection, err := ProjectForActor(state, "player-c", pack)
	if err != nil {
		t.Fatal(err)
	}
	counterActionIndex := slices.IndexFunc(
		counterProjection.Interaction.Actions,
		func(action InteractionActionView) bool {
			return action.TheftCapability == TheftCapabilityCounter
		},
	)
	if counterActionIndex < 0 {
		t.Fatal("actor-owned theft counter descriptor is missing")
	}
	action := counterProjection.Interaction.Actions[counterActionIndex]
	events, err := Handle(state, Command{
		Type:                CommandCounterTheft,
		ActorID:             "player-c",
		InstanceID:          action.SourceInstanceID,
		InteractionID:       action.InteractionID,
		InteractionAt:       openedAt.Add(time.Second),
		InteractionRevision: action.Revision,
	}, pack)
	if err != nil {
		t.Fatal(err)
	}
	next, _ := applyForTest(t, state, events)
	if slices.Contains(next.Players[0].Hand, costID) ||
		slices.Contains(next.Players[2].Hand, counterID) ||
		!reflect.DeepEqual(next.Players[1].Hand, victimHand) ||
		next.TheftAttempt != nil {
		t.Fatalf("countered theft settlement=%#v", next)
	}
}

func TestTheftRejectsForeignHiddenTargetsUnknownAbilityAndCooldown(t *testing.T) {
	state, pack, sourceID, _ := theftState(t)
	openedAt := time.Date(2026, 7, 31, 6, 10, 0, 0, time.UTC)
	base := Command{
		Type:           CommandAttemptTheft,
		ActorID:        "player-a",
		InstanceID:     sourceID,
		AbilityIndex:   0,
		InstanceIDs:    []string{state.Players[0].Hand[0]},
		TargetPlayerID: "player-b",
		InteractionID:  "interaction-theft-reject",
		InteractionAt:  openedAt,
	}
	for name, mutate := range map[string]func(*Command){
		"hidden-target": func(command *Command) {
			command.TargetInstanceID = state.Players[1].Hand[0]
		},
		"unknown-ability": func(command *Command) {
			command.AbilityIndex = 99
		},
		"foreign-cost": func(command *Command) {
			command.InstanceIDs = []string{state.Players[1].Hand[0]}
		},
	} {
		t.Run(name, func(t *testing.T) {
			command := base
			mutate(&command)
			if _, err := Handle(state, command, pack); err == nil {
				t.Fatalf("%s theft command was accepted", name)
			}
		})
	}
	state.Turn.TheftUsed = true
	if _, err := Handle(state, base, pack); err == nil {
		t.Fatal("second theft in one turn was accepted")
	}
}
