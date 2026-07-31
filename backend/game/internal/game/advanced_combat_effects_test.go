package game

import (
	"encoding/json"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
	"time"
)

func advancedCombatState(t *testing.T) (State, Pack) {
	t.Helper()
	state, pack, _ := multiplayerCombatState(t)
	state.RulesProfileID = AdvancedCombatProfileID
	state.RulesProfileVersion = AdvancedCombatProfileVersion
	state.Players[0].Level = 5
	cards := []Card{
		{
			ID:               "test-additional-monster",
			Name:             "Test additional monster",
			Deck:             DeckDoor,
			Kind:             CardMonster,
			Copies:           1,
			InteractionScope: InteractionOtherPlayers,
			Monster: &MonsterSpec{
				Strength:  1,
				Treasures: 2,
				Levels:    1,
				BadStuff: []Effect{{
					Kind:   EffectLoseLevel,
					Amount: 1,
				}},
			},
			CombatCapability: &CombatCapability{
				Kind: CombatCapabilityAddMonster,
			},
		},
		{
			ID:               "test-monster-enhancer",
			Name:             "Test monster enhancer",
			Deck:             DeckTreasure,
			Kind:             CardOneShot,
			Copies:           1,
			InteractionScope: InteractionOtherPlayers,
			Effects: []Effect{{
				Kind:   EffectModifyCombat,
				Amount: 4,
				Target: EffectTargetMonster,
			}},
			CombatCapability: &CombatCapability{
				Kind:   CombatCapabilityEnhance,
				Amount: 4,
			},
		},
		{
			ID:               "test-combat-counter",
			Name:             "Test combat counter",
			Deck:             DeckTreasure,
			Kind:             CardOneShot,
			Copies:           2,
			InteractionScope: InteractionOtherPlayers,
			Effects: []Effect{{
				Kind:     EffectDiscard,
				Selector: SelectorOwnedCard,
				Count:    1,
			}},
			CombatCapability: &CombatCapability{
				Kind: CombatCapabilityCounter,
			},
		},
		{
			ID:               "test-forced-helper",
			Name:             "Test forced helper",
			Deck:             DeckTreasure,
			Kind:             CardOneShot,
			Copies:           1,
			InteractionScope: InteractionOtherPlayers,
			Effects: []Effect{{
				Kind:   EffectModifyCombat,
				Amount: 1,
				Target: EffectTargetPlayer,
			}},
			CombatCapability: &CombatCapability{
				Kind: CombatCapabilityForceHelper,
			},
		},
	}
	pack.Cards = append(pack.Cards, cards...)
	for _, card := range cards {
		pack.index[card.ID] = card
		for copyIndex := 1; copyIndex <= card.Copies; copyIndex++ {
			instanceID := card.ID + "-" + string(rune('0'+copyIndex))
			state.Instances[instanceID] = CardInstance{
				ID:           instanceID,
				DefinitionID: card.ID,
			}
			target := &state.Players[1].Hand
			if card.ID == "test-combat-counter" {
				target = &state.Players[2].Hand
			}
			*target = append(*target, instanceID)
		}
	}
	if err := state.Validate(); err != nil {
		t.Fatal(err)
	}
	return state, pack
}

func advancedAction(
	t *testing.T,
	projection Projection,
	sourceInstanceID string,
	capability CombatCapabilityKind,
) InteractionActionView {
	t.Helper()
	if projection.Interaction == nil {
		t.Fatal("advanced interaction is missing")
	}
	for _, action := range projection.Interaction.Actions {
		if action.SourceInstanceID == sourceInstanceID &&
			action.CombatCapability == capability {
			return action
		}
	}
	t.Fatalf(
		"advanced action %s for %s is missing: %#v",
		capability,
		sourceInstanceID,
		projection.Interaction.Actions,
	)
	return InteractionActionView{}
}

func applyAdvancedAction(
	t *testing.T,
	state State,
	pack Pack,
	action InteractionActionView,
	actorID string,
	at time.Time,
) (State, []EventEnvelope) {
	t.Helper()
	events, err := Handle(state, Command{
		Type:                CommandPlayAdvancedCombatEffect,
		ActorID:             actorID,
		InstanceID:          action.SourceInstanceID,
		TargetInstanceID:    action.TargetMonsterInstanceID,
		TargetEffectID:      action.TargetEffectID,
		HelperPlayerID:      action.HelperPlayerID,
		InteractionID:       action.InteractionID,
		InteractionAt:       at,
		InteractionRevision: action.Revision,
	}, pack)
	if err != nil {
		t.Fatal(err)
	}
	if len(events) != 1 ||
		events[0].Type != EventAdvancedCombatEffectApplied {
		t.Fatalf("advanced events: %#v", events)
	}
	return applyForTest(t, state, events)
}

func TestMoscowV3SelectsAdvancedProfileWithoutChangingOlderPacks(
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
		"v3",
		"cards.json",
	))
	if err != nil {
		t.Fatal(err)
	}
	created, err := CreateLobby("advanced-v3", Player{
		ID:             "owner",
		Name:           "Owner",
		Level:          1,
		CredentialHash: "owner-hash",
	}, pack, 7)
	if err != nil {
		t.Fatal(err)
	}
	state, err := Apply(State{}, created)
	if err != nil {
		t.Fatal(err)
	}
	if state.RulesProfileID != AdvancedCombatProfileID {
		t.Fatalf("v3 profile: %#v", state)
	}
	advancedInstances, _, _, err := materializeSelectedProfile(
		pack,
		AdvancedCombatProfile(),
	)
	if err != nil {
		t.Fatal(err)
	}
	legacyInstances, _, _, err := materializeSelectedProfile(
		pack,
		LobbyMultiplayerProfile(),
	)
	if err != nil {
		t.Fatal(err)
	}
	for _, instanceID := range []string{
		"paperwork-hydra-1",
		"flash-mob-intervention-1",
		"sudden-traffic-jam-1",
		"anonymous-complaint-1",
	} {
		if _, exists := advancedInstances[instanceID]; !exists {
			t.Fatalf("v3 capability was not materialized: %s", instanceID)
		}
		if _, exists := legacyInstances[instanceID]; exists {
			t.Fatalf("old profile activated v3 capability: %s", instanceID)
		}
	}
}

func TestAdvancedCombatEffectsArePrivateBoundedAndReplaySafe(t *testing.T) {
	state, pack := advancedCombatState(t)
	base := state.Clone()
	openedAt := time.Date(2026, time.July, 31, 3, 30, 0, 0, time.UTC)
	state, all := requestCombatWindow(t, state, pack, openedAt)

	bob, err := ProjectForActor(state, "player-b", pack)
	if err != nil {
		t.Fatal(err)
	}
	cara, err := ProjectForActor(state, "player-c", pack)
	if err != nil {
		t.Fatal(err)
	}
	rawCara, err := json.Marshal(cara)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(rawCara), "test-additional-monster-1") ||
		strings.Contains(string(rawCara), "test-monster-enhancer-1") ||
		strings.Contains(string(rawCara), "test-forced-helper-1") {
		t.Fatalf("Bob's private capability sources leaked to Cara: %s", rawCara)
	}

	addAction := advancedAction(
		t,
		bob,
		"test-additional-monster-1",
		CombatCapabilityAddMonster,
	)
	var envelopes []EventEnvelope
	state, envelopes = applyAdvancedAction(
		t,
		state,
		pack,
		addAction,
		"player-b",
		openedAt.Add(31*time.Second),
	)
	all = append(all, envelopes...)
	if !reflect.DeepEqual(
		encounterMonsterInstanceIDs(*state.Turn.Encounter),
		[]string{"courtyard-pigeon-1", "test-additional-monster-1"},
	) ||
		state.InteractionWindow.DeadlineRevision != 2 ||
		!state.InteractionWindow.DeadlineAt.Equal(
			openedAt.Add(70*time.Second),
		) {
		t.Fatalf("additional-monster outcome: %#v", state.Turn.Encounter)
	}

	bob, err = ProjectForActor(state, "player-b", pack)
	if err != nil {
		t.Fatal(err)
	}
	enhanceAction := advancedAction(
		t,
		bob,
		"test-monster-enhancer-1",
		CombatCapabilityEnhance,
	)
	if enhanceAction.TargetMonsterInstanceID == "" {
		t.Fatalf("enhancer lacks a server target: %#v", enhanceAction)
	}
	for _, action := range bob.Interaction.Actions {
		if action.SourceInstanceID == "test-monster-enhancer-1" &&
			action.TargetMonsterInstanceID == "test-additional-monster-1" {
			enhanceAction = action
		}
	}
	state, envelopes = applyAdvancedAction(
		t,
		state,
		pack,
		enhanceAction,
		"player-b",
		openedAt.Add(32*time.Second),
	)
	all = append(all, envelopes...)
	if len(state.Turn.Encounter.CombatEffects) != 1 ||
		state.Turn.Encounter.CombatEffects[0].Amount != 4 {
		t.Fatalf("enhancement outcome: %#v", state.Turn.Encounter.CombatEffects)
	}
	enhancedTotals, err := combatTotals(
		state,
		state.PlayerIndex(state.Turn.PlayerID),
		pack,
	)
	if err != nil {
		t.Fatal(err)
	}
	publicEffectID := state.Turn.Encounter.CombatEffects[0].ID

	cara, err = ProjectForActor(state, "player-c", pack)
	if err != nil {
		t.Fatal(err)
	}
	counterAction := advancedAction(
		t,
		cara,
		"test-combat-counter-1",
		CombatCapabilityCounter,
	)
	if counterAction.TargetEffectID != publicEffectID ||
		counterAction.TargetEffectID == "test-monster-enhancer-1" {
		t.Fatalf("counter target is not opaque: %#v", counterAction)
	}
	state, envelopes = applyAdvancedAction(
		t,
		state,
		pack,
		counterAction,
		"player-c",
		openedAt.Add(33*time.Second),
	)
	all = append(all, envelopes...)
	if state.Turn.Encounter.CombatEffects[0].Active {
		t.Fatalf("counter did not disable enhancement: %#v", state.Turn.Encounter.CombatEffects)
	}
	counteredTotals, err := combatTotals(
		state,
		state.PlayerIndex(state.Turn.PlayerID),
		pack,
	)
	if err != nil {
		t.Fatal(err)
	}
	if enhancedTotals.MonsterStrength-counteredTotals.MonsterStrength != 4 {
		t.Fatalf(
			"enhancer/counter totals: enhanced=%#v countered=%#v",
			enhancedTotals,
			counteredTotals,
		)
	}
	cara, err = ProjectForActor(state, "player-c", pack)
	if err != nil {
		t.Fatal(err)
	}
	for _, action := range cara.Interaction.Actions {
		if action.SourceInstanceID == "test-combat-counter-2" &&
			action.TargetEffectID == publicEffectID {
			t.Fatalf("inactive effect remained targetable: %#v", action)
		}
	}

	bob, err = ProjectForActor(state, "player-b", pack)
	if err != nil {
		t.Fatal(err)
	}
	forceAction := advancedAction(
		t,
		bob,
		"test-forced-helper-1",
		CombatCapabilityForceHelper,
	)
	for _, action := range bob.Interaction.Actions {
		if action.SourceInstanceID == "test-forced-helper-1" &&
			action.HelperPlayerID == "player-c" {
			forceAction = action
		}
	}
	state, envelopes = applyAdvancedAction(
		t,
		state,
		pack,
		forceAction,
		"player-b",
		openedAt.Add(34*time.Second),
	)
	all = append(all, envelopes...)
	help := state.Turn.Encounter.CombatHelp
	if help == nil ||
		help.HelperPlayerID != "player-c" ||
		help.RewardTreasures != 0 ||
		!help.Forced {
		t.Fatalf("forced helper outcome: %#v", help)
	}
	forcedProjection, err := ProjectForActor(state, "player-c", pack)
	if err != nil {
		t.Fatal(err)
	}
	rawForced, err := json.Marshal(forcedProjection)
	if err != nil {
		t.Fatal(err)
	}
	if forcedProjection.Turn.Combat == nil ||
		!forcedProjection.Turn.Combat.HelperForced ||
		strings.Contains(string(rawForced), "helper_reward_treasures") {
		t.Fatalf("forced-helper projection: %s", rawForced)
	}
	if events, err := Handle(state, Command{
		Type:               CommandOfferCombatHelp,
		ActorID:            "player-a",
		InteractionID:      state.InteractionWindow.ID,
		ChildInteractionID: "illegal-voluntary-help",
		HelperPlayerID:     "player-b",
		RewardTreasures:    1,
		InteractionAt:      openedAt.Add(35 * time.Second),
	}, pack); err == nil || events != nil {
		t.Fatalf("voluntary helper coexisted with forced helper: %#v", events)
	}

	for _, actorID := range []string{"player-b", "player-c"} {
		passEvents, err := Handle(state, Command{
			Type:                CommandPassInteraction,
			ActorID:             actorID,
			InteractionID:       state.InteractionWindow.ID,
			InteractionAt:       openedAt.Add(36 * time.Second),
			InteractionRevision: state.InteractionWindow.DeadlineRevision,
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
		InteractionID:          state.InteractionWindow.ID,
		InteractionAt:          openedAt.Add(37 * time.Second),
		InteractionCloseReason: InteractionCloseAllResponded,
	}, pack)
	if err != nil {
		t.Fatal(err)
	}
	state, envelopes = applyForTest(t, state, closed)
	all = append(all, envelopes...)
	if state.Players[0].Level != 7 ||
		state.Turn.Encounter != nil ||
		state.Players[2].Hand == nil {
		t.Fatalf("multi-monster settlement outcome: %#v", state)
	}
	replayed, err := ReplayFrom(base, all)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(replayed, state) {
		t.Fatalf("advanced replay mismatch\nwant=%#v\ngot=%#v", state, replayed)
	}
}
