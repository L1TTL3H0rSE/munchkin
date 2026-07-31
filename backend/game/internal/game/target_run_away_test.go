package game

import (
	"encoding/json"
	"reflect"
	"strings"
	"testing"
	"time"
)

func addTargetEffectFixture(
	t *testing.T,
	state *State,
	pack *Pack,
) string {
	t.Helper()
	card := Card{
		ID:               "test-target-discard",
		Name:             "Test target discard",
		Deck:             DeckDoor,
		Kind:             CardCurse,
		Copies:           1,
		InteractionScope: InteractionOtherPlayers,
		Effects: []Effect{{
			Kind:     EffectDiscard,
			Selector: SelectorOwnedCard,
			Count:    1,
		}},
	}
	pack.Cards = append(pack.Cards, card)
	pack.index[card.ID] = card
	instanceID := card.ID + "-1"
	state.Instances[instanceID] = CardInstance{
		ID:           instanceID,
		DefinitionID: card.ID,
	}
	state.Players[0].Hand = append(state.Players[0].Hand, instanceID)
	if err := state.Validate(); err != nil {
		t.Fatal(err)
	}
	return instanceID
}

func targetActionForTest(
	t *testing.T,
	projection Projection,
	sourceInstanceID string,
) ActionView {
	t.Helper()
	for _, action := range projection.Turn.AvailableActions {
		if action.Type == CommandPlayTargetEffect &&
			action.SourceInstanceID == sourceInstanceID {
			return action
		}
	}
	t.Fatalf(
		"target action for %s is missing: %#v",
		sourceInstanceID,
		projection.Turn.AvailableActions,
	)
	return ActionView{}
}

func interactionActionBySource(
	t *testing.T,
	projection Projection,
	sourceInstanceID string,
) InteractionActionView {
	t.Helper()
	if projection.Interaction == nil {
		t.Fatal("interaction is missing")
	}
	for _, action := range projection.Interaction.Actions {
		if action.SourceInstanceID == sourceInstanceID {
			return action
		}
	}
	t.Fatalf(
		"interaction source %s is missing: %#v",
		sourceInstanceID,
		projection.Interaction.Actions,
	)
	return InteractionActionView{}
}

func passInteractionForTest(
	t *testing.T,
	state State,
	pack Pack,
	actorID string,
	acceptedAt time.Time,
) State {
	t.Helper()
	events, err := Handle(state, Command{
		Type:                CommandPassInteraction,
		ActorID:             actorID,
		InteractionID:       state.InteractionWindow.ID,
		InteractionIntent:   InteractionIntentPass,
		InteractionAt:       acceptedAt,
		InteractionRevision: state.InteractionWindow.DeadlineRevision,
	}, pack)
	if err != nil {
		t.Fatal(err)
	}
	next, _ := applyForTest(t, state, events)
	return next
}

func TestTargetEffectProjectionPrivateChoiceAndCounterAreActorSafe(
	t *testing.T,
) {
	state, pack := advancedCombatState(t)
	setTurnPhase(&state, PhasePreparation)
	if err := discardEncounterSet(&state, pack); err != nil {
		t.Fatal(err)
	}
	sourceID := addTargetEffectFixture(t, &state, &pack)
	ownerProjection, err := ProjectForActor(state, "player-a", pack)
	if err != nil {
		t.Fatal(err)
	}
	targetAction := targetActionForTest(t, ownerProjection, sourceID)
	if !reflect.DeepEqual(
		targetAction.TargetPlayerIDs,
		[]string{"player-b", "player-c"},
	) {
		t.Fatalf("server target roster: %#v", targetAction)
	}

	openedAt := time.Date(2026, time.July, 31, 7, 0, 0, 0, time.UTC)
	events, err := Handle(state, Command{
		Type:           CommandPlayTargetEffect,
		ActorID:        "player-a",
		InstanceID:     sourceID,
		TargetPlayerID: "player-b",
		InteractionID:  "interaction-target",
		InteractionAt:  openedAt,
	}, pack)
	if err != nil {
		t.Fatal(err)
	}
	if len(events) != 1 || events[0].Type != EventTargetEffectStarted {
		t.Fatalf("target open events: %#v", events)
	}
	state, _ = applyForTest(t, state, events)

	targetProjection, err := ProjectForActor(state, "player-b", pack)
	if err != nil {
		t.Fatal(err)
	}
	counterProjection, err := ProjectForActor(state, "player-c", pack)
	if err != nil {
		t.Fatal(err)
	}
	if targetProjection.Interaction == nil ||
		targetProjection.Interaction.PublicKind != "target_response" ||
		targetProjection.Interaction.TargetPlayerID != "player-b" {
		t.Fatalf("target response projection: %#v", targetProjection.Interaction)
	}
	rawTarget, err := json.Marshal(targetProjection)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(rawTarget), "test-combat-counter-1") {
		t.Fatalf("counter source leaked to target: %s", rawTarget)
	}
	counter := interactionActionBySource(
		t,
		counterProjection,
		"test-combat-counter-1",
	)
	if counter.TargetEffectID != state.Turn.TargetEffect.ID ||
		counter.CombatCapability != CombatCapabilityCounter {
		t.Fatalf("opaque counter descriptor: %#v", counter)
	}

	state = passInteractionForTest(
		t,
		state,
		pack,
		"player-b",
		openedAt.Add(time.Second),
	)
	state = passInteractionForTest(
		t,
		state,
		pack,
		"player-c",
		openedAt.Add(2*time.Second),
	)
	closeEvents, err := Handle(state, Command{
		Type:                   CommandCloseInteractionWindow,
		ActorID:                "player-a",
		InteractionID:          state.InteractionWindow.ID,
		InteractionAt:          openedAt.Add(3 * time.Second),
		InteractionCloseReason: InteractionCloseAllResponded,
	}, pack)
	if err != nil {
		t.Fatal(err)
	}
	if len(closeEvents) != 2 ||
		closeEvents[0].Type != EventInteractionWindowClosed ||
		closeEvents[1].Type != EventTargetEffectResolved {
		t.Fatalf("target continuation events: %#v", closeEvents)
	}
	state, _ = applyForTest(t, state, closeEvents)
	if state.Turn.Pending == nil ||
		state.Turn.Pending.ActorID != "player-b" ||
		state.Turn.Phase != PhaseResolveEffect {
		t.Fatalf("target private decision: %#v", state.Turn)
	}

	policy := AddressedInteractionDeadlinePolicy()
	privateWindow := &InteractionWindow{
		ID:   "interaction-target-choice",
		Kind: InteractionKindPrivateChoice,
		Parent: InteractionParent{
			Phase:       PhaseResolveEffect,
			SubjectKind: InteractionSubjectTurn,
			SubjectID:   state.Turn.PlayerID,
		},
		InitiatorActorID:  "player-b",
		EligibilityPolicy: InteractionEligibilityActorPrivate,
		AllowedIntents: []InteractionIntent{
			InteractionIntentRespond,
			InteractionIntentAutoResolve,
		},
		EligibleActorIDs: []string{"player-b"},
		OpenedAt:         openedAt.Add(3 * time.Second),
		DeadlineAt: openedAt.Add(
			time.Duration(3+policy.BaseSeconds) * time.Second,
		),
		DeadlineRevision: 1,
		DeadlinePolicy:   policy,
		Responses: map[string]InteractionResponse{
			"player-b": {
				Requirement:   InteractionResponseMandatory,
				TimeoutIntent: InteractionIntentAutoResolve,
				State:         InteractionResponsePending,
			},
		},
		Status: InteractionWindowOpen,
	}
	openChoice, err := Handle(state, Command{
		Type:              CommandOpenInteractionWindow,
		ActorID:           "player-b",
		InteractionWindow: privateWindow,
	}, pack)
	if err != nil {
		t.Fatal(err)
	}
	state, _ = applyForTest(t, state, openChoice)
	targetProjection, err = ProjectForActor(state, "player-b", pack)
	if err != nil {
		t.Fatal(err)
	}
	observerProjection, err := ProjectForActor(state, "player-c", pack)
	if err != nil {
		t.Fatal(err)
	}
	if targetProjection.Interaction == nil ||
		targetProjection.Interaction.PublicKind != "private_choice" ||
		len(targetProjection.Interaction.Actions) !=
			len(state.Turn.Pending.Options) {
		t.Fatalf("private choice descriptor: %#v", targetProjection.Interaction)
	}
	rawObserver, err := json.Marshal(observerProjection.Interaction)
	if err != nil {
		t.Fatal(err)
	}
	for _, optionID := range state.Turn.Pending.Options {
		if strings.Contains(string(rawObserver), optionID) {
			t.Fatalf(
				"private option %s leaked to observer: %s",
				optionID,
				rawObserver,
			)
		}
	}
}

func TestTargetEffectCounterCancelsWithoutApplyingPrivateEffect(t *testing.T) {
	state, pack := advancedCombatState(t)
	setTurnPhase(&state, PhasePreparation)
	if err := discardEncounterSet(&state, pack); err != nil {
		t.Fatal(err)
	}
	sourceID := addTargetEffectFixture(t, &state, &pack)
	openedAt := time.Date(2026, time.July, 31, 7, 30, 0, 0, time.UTC)
	events, err := Handle(state, Command{
		Type:           CommandPlayTargetEffect,
		ActorID:        "player-a",
		InstanceID:     sourceID,
		TargetPlayerID: "player-b",
		InteractionID:  "interaction-target-counter",
		InteractionAt:  openedAt,
	}, pack)
	if err != nil {
		t.Fatal(err)
	}
	state, _ = applyForTest(t, state, events)
	targetEffectID := state.Turn.TargetEffect.ID
	counterEvents, err := Handle(state, Command{
		Type:                CommandCounterTargetEffect,
		ActorID:             "player-c",
		InstanceID:          "test-combat-counter-1",
		TargetEffectID:      targetEffectID,
		InteractionID:       state.InteractionWindow.ID,
		InteractionAt:       openedAt.Add(time.Second),
		InteractionRevision: 1,
	}, pack)
	if err != nil {
		t.Fatal(err)
	}
	state, _ = applyForTest(t, state, counterEvents)
	closeEvents, err := Handle(state, Command{
		Type:                   CommandCloseInteractionWindow,
		ActorID:                "player-a",
		InteractionID:          state.InteractionWindow.ID,
		InteractionAt:          openedAt.Add(2 * time.Second),
		InteractionCloseReason: InteractionCloseAllResponded,
	}, pack)
	if err != nil {
		t.Fatal(err)
	}
	state, _ = applyForTest(t, state, closeEvents)
	if state.Turn.TargetEffect != nil ||
		state.Turn.Pending != nil ||
		state.Turn.Phase != PhasePreparation ||
		!slicesContains(state.DoorDiscard, sourceID) ||
		!slicesContains(
			state.TreasureDiscard,
			"test-combat-counter-1",
		) {
		t.Fatalf("countered target outcome: %#v", state)
	}
}

func addRunAwayMonster(
	state *State,
	pack *Pack,
	id string,
) string {
	card := Card{
		ID:               id,
		Name:             id,
		Deck:             DeckDoor,
		Kind:             CardMonster,
		Copies:           1,
		InteractionScope: InteractionNone,
		Monster: &MonsterSpec{
			Strength:  40,
			Treasures: 1,
			Levels:    1,
			BadStuff: []Effect{{
				Kind:   EffectLoseLevel,
				Amount: 1,
			}},
		},
	}
	pack.Cards = append(pack.Cards, card)
	pack.index[card.ID] = card
	instanceID := id + "-1"
	state.Instances[instanceID] = CardInstance{
		ID:           instanceID,
		DefinitionID: id,
	}
	return instanceID
}

func addRunAwayDeathMonster(
	state *State,
	pack *Pack,
	id string,
) string {
	card := Card{
		ID:               id,
		Name:             id,
		Deck:             DeckDoor,
		Kind:             CardMonster,
		Copies:           1,
		InteractionScope: InteractionNone,
		Monster: &MonsterSpec{
			Strength:  40,
			Treasures: 1,
			Levels:    1,
			BadStuff: []Effect{{
				Kind: EffectDeath,
			}},
		},
	}
	pack.Cards = append(pack.Cards, card)
	pack.index[card.ID] = card
	instanceID := id + "-1"
	state.Instances[instanceID] = CardInstance{
		ID:           instanceID,
		DefinitionID: id,
	}
	return instanceID
}

func addRunAwayModifier(
	state *State,
	pack *Pack,
) string {
	card := Card{
		ID:               "test-run-away-modifier",
		Name:             "Test Run Away modifier",
		Deck:             DeckTreasure,
		Kind:             CardOneShot,
		Copies:           1,
		InteractionScope: InteractionSelf,
		Effects: []Effect{{
			Kind:   EffectModifyEscape,
			Amount: 2,
		}},
	}
	pack.Cards = append(pack.Cards, card)
	pack.index[card.ID] = card
	instanceID := card.ID + "-1"
	state.Instances[instanceID] = CardInstance{
		ID:           instanceID,
		DefinitionID: card.ID,
	}
	state.Players[0].Hand = append(state.Players[0].Hand, instanceID)
	return instanceID
}

func openRunAwayWindowForTest(
	t *testing.T,
	state State,
	pack Pack,
	id string,
	openedAt time.Time,
) State {
	t.Helper()
	sequence := state.Turn.RunAway
	participants := make([]string, 0, len(state.Players))
	responses := make(map[string]InteractionResponse)
	for _, player := range state.Players {
		if player.Dead {
			continue
		}
		participants = append(participants, player.ID)
		responses[player.ID] = InteractionResponse{
			Requirement:   InteractionResponseOptional,
			TimeoutIntent: InteractionIntentPass,
			State:         InteractionResponsePending,
		}
	}
	policy := AddressedInteractionDeadlinePolicy()
	window := &InteractionWindow{
		ID:   id,
		Kind: InteractionKindRunAwayResponse,
		Parent: InteractionParent{
			Phase:       PhaseRunAway,
			SubjectKind: InteractionSubjectEncounter,
			SubjectID:   sequence.MonsterInstanceIDs[sequence.MonsterIndex],
		},
		InitiatorActorID:  sequence.ParticipantPlayerIDs[sequence.ParticipantIndex],
		EligibilityPolicy: InteractionEligibilityOpaquePublicSet,
		AllowedIntents: []InteractionIntent{
			InteractionIntentPass,
			InteractionIntentRespond,
		},
		EligibleActorIDs: participants,
		OpenedAt:         openedAt,
		DeadlineAt: openedAt.Add(
			time.Duration(policy.BaseSeconds) * time.Second,
		),
		DeadlineRevision: 1,
		DeadlinePolicy:   policy,
		Responses:        responses,
		Status:           InteractionWindowOpen,
	}
	events, err := Handle(state, Command{
		Type:              CommandOpenInteractionWindow,
		ActorID:           window.InitiatorActorID,
		InteractionWindow: window,
	}, pack)
	if err != nil {
		t.Fatal(err)
	}
	next, _ := applyForTest(t, state, events)
	return next
}

func TestRunAwayUsesStableParticipantMonsterStepsAndPersistedRolls(
	t *testing.T,
) {
	state, pack := advancedCombatState(t)
	if err := discardEncounterSet(&state, pack); err != nil {
		t.Fatal(err)
	}
	firstMonster := addRunAwayMonster(&state, &pack, "test-escape-monster-a")
	secondMonster := addRunAwayMonster(&state, &pack, "test-escape-monster-b")
	modifierID := addRunAwayModifier(&state, &pack)
	state.Turn.Encounter = &Encounter{
		MonsterInstanceID: firstMonster,
		AdditionalMonsterInstanceIDs: []string{
			secondMonster,
		},
		CombatClosed: true,
		CombatHelp: &CombatHelpAgreement{
			HelperPlayerID:  "player-b",
			RewardTreasures: 1,
			RewardStatus:    CombatHelpRewardVoided,
		},
	}
	setTurnPhase(&state, PhaseRunAway)
	if err := initializeRunAwaySequence(&state); err != nil {
		t.Fatal(err)
	}
	if err := state.Validate(); err != nil {
		t.Fatal(err)
	}

	openedAt := time.Date(2026, time.July, 31, 8, 0, 0, 0, time.UTC)
	state = openRunAwayWindowForTest(
		t,
		state,
		pack,
		"interaction-run-away-0",
		openedAt,
	)
	playerProjection, err := ProjectForActor(state, "player-a", pack)
	if err != nil {
		t.Fatal(err)
	}
	modifier := interactionActionBySource(
		t,
		playerProjection,
		modifierID,
	)
	if modifier.EscapeDelta != 2 {
		t.Fatalf("Run Away modifier descriptor: %#v", modifier)
	}
	modifierEvents, err := Handle(state, Command{
		Type:                CommandPlayRunAwayModifier,
		ActorID:             "player-a",
		InstanceID:          modifierID,
		InteractionID:       state.InteractionWindow.ID,
		InteractionAt:       openedAt.Add(time.Second),
		InteractionRevision: 1,
	}, pack)
	if err != nil {
		t.Fatal(err)
	}
	state, _ = applyForTest(t, state, modifierEvents)
	if state.InteractionWindow.DeadlineRevision != 2 {
		t.Fatalf("Run Away material revision: %#v", state.InteractionWindow)
	}
	if _, err := Handle(state, Command{
		Type:                CommandPassInteraction,
		ActorID:             "player-b",
		InteractionID:       state.InteractionWindow.ID,
		InteractionIntent:   InteractionIntentPass,
		InteractionAt:       openedAt.Add(2 * time.Second),
		InteractionRevision: 1,
	}, pack); err == nil {
		t.Fatal("stale Run Away response revision was accepted")
	}

	for step := 0; step < 4; step++ {
		if step > 0 {
			openedAt = openedAt.Add(time.Minute)
			state = openRunAwayWindowForTest(
				t,
				state,
				pack,
				"interaction-run-away-"+string(rune('0'+step)),
				openedAt,
			)
		}
		for index, player := range state.Players {
			if player.Dead {
				continue
			}
			state = passInteractionForTest(
				t,
				state,
				pack,
				player.ID,
				openedAt.Add(
					time.Duration(index+2)*time.Second,
				),
			)
		}
		beforeClose := state.Clone()
		closeEvents, err := Handle(state, Command{
			Type:                   CommandCloseInteractionWindow,
			ActorID:                state.InteractionWindow.InitiatorActorID,
			InteractionID:          state.InteractionWindow.ID,
			InteractionAt:          openedAt.Add(10 * time.Second),
			InteractionCloseReason: InteractionCloseAllResponded,
		}, pack)
		if err != nil {
			t.Fatal(err)
		}
		if len(closeEvents) != 2 ||
			closeEvents[1].Type != EventRunAwayStepResolved {
			t.Fatalf("Run Away step events: %#v", closeEvents)
		}
		state, _ = applyForTest(t, state, closeEvents)
		replayed := beforeClose
		for _, event := range closeEvents {
			replayed, err = Apply(replayed, event)
			if err != nil {
				t.Fatal(err)
			}
		}
		if !reflect.DeepEqual(state, replayed) {
			t.Fatal("Run Away event replay diverged")
		}
	}
	wantOrder := [][2]string{
		{"player-a", firstMonster},
		{"player-a", secondMonster},
		{"player-b", firstMonster},
		{"player-b", secondMonster},
	}
	if state.Turn.RunAway == nil ||
		!state.Turn.RunAway.Completed ||
		len(state.Turn.RunAway.Attempts) != len(wantOrder) ||
		state.Turn.Encounter != nil ||
		state.Turn.Phase != PhaseCharity {
		t.Fatalf("terminal Run Away state: %#v", state.Turn)
	}
	for index, expected := range wantOrder {
		attempt := state.Turn.RunAway.Attempts[index]
		if attempt.PlayerID != expected[0] ||
			attempt.MonsterInstanceID != expected[1] ||
			attempt.Roll < 1 ||
			attempt.Roll > 6 {
			t.Fatalf("Run Away attempt %d: %#v", index, attempt)
		}
	}
}

func TestRunAwayDeathSkipsRemainingMonstersForDeadParticipant(
	t *testing.T,
) {
	state, pack := advancedCombatState(t)
	if err := discardEncounterSet(&state, pack); err != nil {
		t.Fatal(err)
	}
	deathMonster := addRunAwayDeathMonster(
		&state,
		&pack,
		"test-escape-death-monster",
	)
	secondMonster := addRunAwayMonster(
		&state,
		&pack,
		"test-escape-followup-monster",
	)
	state.Turn.Encounter = &Encounter{
		MonsterInstanceID: deathMonster,
		AdditionalMonsterInstanceIDs: []string{
			secondMonster,
		},
		CombatClosed: true,
		CombatHelp: &CombatHelpAgreement{
			HelperPlayerID:  "player-b",
			RewardTreasures: 1,
			RewardStatus:    CombatHelpRewardVoided,
		},
	}
	setTurnPhase(&state, PhaseRunAway)
	if err := initializeRunAwaySequence(&state); err != nil {
		t.Fatal(err)
	}
	for seed := uint64(1); ; seed++ {
		roll, _ := rollD6(seed)
		if roll < 5 {
			state.RNGState = seed
			break
		}
	}
	openedAt := time.Date(2026, time.July, 31, 8, 30, 0, 0, time.UTC)
	state = openRunAwayWindowForTest(
		t,
		state,
		pack,
		"interaction-run-away-death",
		openedAt,
	)
	for index, player := range state.Players {
		state = passInteractionForTest(
			t,
			state,
			pack,
			player.ID,
			openedAt.Add(time.Duration(index+1)*time.Second),
		)
	}
	events, err := Handle(state, Command{
		Type:                   CommandCloseInteractionWindow,
		ActorID:                "player-a",
		InteractionID:          state.InteractionWindow.ID,
		InteractionAt:          openedAt.Add(5 * time.Second),
		InteractionCloseReason: InteractionCloseAllResponded,
	}, pack)
	if err != nil {
		t.Fatal(err)
	}
	state, _ = applyForTest(t, state, events)
	if !state.Players[0].Dead ||
		state.Turn.RunAway == nil ||
		len(state.Turn.RunAway.Attempts) != 1 ||
		state.Turn.RunAway.Attempts[0].Escaped ||
		state.Turn.RunAway.ParticipantIndex != 1 ||
		state.Turn.RunAway.MonsterIndex != 0 ||
		state.Turn.RunAway.ParticipantPlayerIDs[1] != "player-b" ||
		state.Turn.RunAway.MonsterInstanceIDs[0] != deathMonster ||
		state.Turn.Phase != PhaseRunAway {
		t.Fatalf("Run Away death continuation: %#v", state)
	}
}
